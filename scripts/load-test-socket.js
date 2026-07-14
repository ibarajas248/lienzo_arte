const { performance } = require('perf_hooks');
const { io } = require('socket.io-client');

if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Socket.io load test

Environment variables:
  TARGET_URL=http://168.231.67.54
  CLIENTS=50
  DURATION_MS=30000
  BATCHES_PER_SECOND=2
  SEGMENTS_PER_BATCH=3
  TILE_X_VALUES=0,1
  TILE_Y=1
  LOAD_INITIAL_TILES=1
  TEST_COLOR=#ff00ff
`);
    process.exit(0);
}

const config = {
    targetUrl: process.env.TARGET_URL || 'http://168.231.67.54',
    clients: Number(process.env.CLIENTS || 50),
    durationMs: Number(process.env.DURATION_MS || 30000),
    batchesPerSecond: Number(process.env.BATCHES_PER_SECOND || 2),
    segmentsPerBatch: Number(process.env.SEGMENTS_PER_BATCH || 3),
    connectTimeoutMs: Number(process.env.CONNECT_TIMEOUT_MS || 15000),
    tileXValues: String(process.env.TILE_X_VALUES || '0,1').split(',').map(Number),
    tileY: Number(process.env.TILE_Y || 1),
    loadInitialTiles: process.env.LOAD_INITIAL_TILES !== '0',
    color: process.env.TEST_COLOR || '#ff00ff',
    size: Number(process.env.TEST_SIZE || 5)
};

const sentOrders = new Map();
const uniqueDeliveredOrders = new Set();
const clients = [];
const timers = [];
let world = { width: 1280, tileSize: 1024 };
let globalOrder = Math.max(Date.now() * 1000, 1);
let globalSegmentId = 0;

const metrics = {
    connectStarted: 0,
    connected: 0,
    connectErrors: 0,
    disconnected: 0,
    initialTileFetches: 0,
    initialTileFetchErrors: 0,
    initialTileFetchMsTotal: 0,
    initialTileFetchMsMax: 0,
    sentBatches: 0,
    sentSegments: 0,
    receivedBatches: 0,
    receivedSegments: 0,
    latencyCount: 0,
    latencySumMs: 0,
    latencyMinMs: Infinity,
    latencyMaxMs: 0
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function nextOrder() {
    globalOrder += 1;
    return globalOrder;
}

function percentile(values, pct) {
    if (values.length === 0) return 0;
    const index = Math.min(values.length - 1, Math.floor((values.length - 1) * pct));
    return values[index];
}

const latencySamples = [];

function recordLatency(order) {
    const sentAt = sentOrders.get(Number(order));
    if (!sentAt) return;

    const latencyMs = performance.now() - sentAt;
    metrics.latencyCount += 1;
    metrics.latencySumMs += latencyMs;
    metrics.latencyMinMs = Math.min(metrics.latencyMinMs, latencyMs);
    metrics.latencyMaxMs = Math.max(metrics.latencyMaxMs, latencyMs);
    latencySamples.push(latencyMs);
    uniqueDeliveredOrders.add(Number(order));
}

function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

function makeSegment(clientId) {
    const tileX = config.tileXValues[Math.floor(Math.random() * config.tileXValues.length)];
    const tileLeft = tileX * world.tileSize;
    const tileRight = Math.min(tileLeft + world.tileSize, world.width);
    const tileTop = config.tileY * world.tileSize;
    const tileBottom = tileTop + world.tileSize;
    const horizontalMargin = Math.min(80, Math.max(8, (tileRight - tileLeft) * 0.2));
    const verticalMargin = 80;
    const minX = tileLeft + horizontalMargin;
    const maxX = tileRight - horizontalMargin;
    const minY = tileTop + verticalMargin;
    const maxY = tileBottom - verticalMargin;
    const x0 = randomBetween(minX, maxX);
    const y0 = randomBetween(minY, maxY);
    const x1 = Math.min(Math.max(x0 + randomBetween(-80, 80), minX), maxX);
    const y1 = Math.min(Math.max(y0 + randomBetween(-80, 80), minY), maxY);
    const order = nextOrder();

    globalSegmentId += 1;
    sentOrders.set(order, performance.now());

    return {
        kind: 'line',
        x0,
        y0,
        x1,
        y1,
        color: config.color,
        size: config.size,
        order,
        clientId,
        testSegmentId: globalSegmentId
    };
}

function connectClient(clientId) {
    metrics.connectStarted += 1;

    return new Promise(resolve => {
        const socket = io(config.targetUrl, {
            autoConnect: true,
            forceNew: true,
            reconnection: false,
            transports: ['websocket', 'polling'],
            tryAllTransports: true,
            timeout: config.connectTimeoutMs
        });

        let resolved = false;

        function done(result) {
            if (resolved) return;
            resolved = true;
            resolve(result);
        }

        socket.on('connect', () => {
            metrics.connected += 1;
            const tiles = config.tileXValues.map(tileX => `${tileX}:${config.tileY}`);
            socket.emit('viewport-tiles', { tiles });
            clients.push({ id: clientId, socket });
            done({ ok: true, socket });
        });

        socket.on('connect_error', error => {
            metrics.connectErrors += 1;
            done({ ok: false, error: error.message });
        });

        socket.on('disconnect', () => {
            metrics.disconnected += 1;
        });

        socket.on('tile-draw-batch', payload => {
            const segments = payload && Array.isArray(payload.segments) ? payload.segments : [];
            metrics.receivedBatches += 1;
            metrics.receivedSegments += segments.length;
            for (const segment of segments) recordLatency(segment.order);
        });
    });
}

async function fetchInitialTiles(clientId) {
    const tiles = config.tileXValues.map(tileX => `${tileX}:${config.tileY}`).join(',');
    const url = `${config.targetUrl}/api/tiles?tiles=${encodeURIComponent(tiles)}`;
    const startedAt = performance.now();

    try {
        const response = await fetch(url, {
            headers: { 'Accept-Encoding': 'gzip' }
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        await response.arrayBuffer();
        const elapsed = performance.now() - startedAt;
        metrics.initialTileFetches += 1;
        metrics.initialTileFetchMsTotal += elapsed;
        metrics.initialTileFetchMsMax = Math.max(metrics.initialTileFetchMsMax, elapsed);
    } catch (error) {
        metrics.initialTileFetchErrors += 1;
        console.error(`[client ${clientId}] initial tile fetch failed: ${error.message}`);
    }
}

async function loadWorldConfig() {
    try {
        const response = await fetch(`${config.targetUrl}/api/canvas-control`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const control = await response.json();
        const width = Number(control.width);
        const tileSize = Number(control.tileSize);
        world = {
            width: Number.isFinite(width) && width > 0 ? width : world.width,
            tileSize: Number.isFinite(tileSize) && tileSize > 0 ? tileSize : world.tileSize
        };
    } catch (error) {
        console.error(`Could not load world config, using defaults: ${error.message}`);
    }
}

function startDrawing() {
    const intervalMs = Math.max(1, Math.round(1000 / config.batchesPerSecond));

    for (const client of clients) {
        const timer = setInterval(() => {
            if (!client.socket.connected) return;

            const segments = [];
            for (let index = 0; index < config.segmentsPerBatch; index += 1) {
                segments.push(makeSegment(client.id));
            }

            client.socket.emit('draw-batch', segments);
            metrics.sentBatches += 1;
            metrics.sentSegments += segments.length;
        }, intervalMs);

        timers.push(timer);
    }
}

function stopDrawing() {
    while (timers.length > 0) clearInterval(timers.pop());
}

function disconnectClients() {
    for (const client of clients) client.socket.disconnect();
}

function printProgress(startedAt) {
    const elapsedSec = ((performance.now() - startedAt) / 1000).toFixed(1);
    const avgLatency = metrics.latencyCount > 0 ? metrics.latencySumMs / metrics.latencyCount : 0;
    console.log(`[${elapsedSec}s] connected=${metrics.connected}/${config.clients} sentSegments=${metrics.sentSegments} receivedSegments=${metrics.receivedSegments} avgLatencyMs=${avgLatency.toFixed(1)}`);
}

function summarize(totalElapsedMs) {
    latencySamples.sort((a, b) => a - b);
    const avgLatency = metrics.latencyCount > 0 ? metrics.latencySumMs / metrics.latencyCount : 0;
    const initialTileFetchAvg = metrics.initialTileFetches > 0
        ? metrics.initialTileFetchMsTotal / metrics.initialTileFetches
        : 0;

    return {
        config,
        elapsedMs: Math.round(totalElapsedMs),
        connected: metrics.connected,
        connectErrors: metrics.connectErrors,
        disconnected: metrics.disconnected,
        initialTileFetches: metrics.initialTileFetches,
        initialTileFetchErrors: metrics.initialTileFetchErrors,
        initialTileFetchAvgMs: Math.round(initialTileFetchAvg),
        initialTileFetchMaxMs: Math.round(metrics.initialTileFetchMsMax),
        sentBatches: metrics.sentBatches,
        sentSegments: metrics.sentSegments,
        receivedBatches: metrics.receivedBatches,
        receivedSegments: metrics.receivedSegments,
        uniqueSentOrdersDelivered: uniqueDeliveredOrders.size,
        latency: {
            samples: metrics.latencyCount,
            avgMs: Math.round(avgLatency),
            minMs: Number.isFinite(metrics.latencyMinMs) ? Math.round(metrics.latencyMinMs) : 0,
            p50Ms: Math.round(percentile(latencySamples, 0.5)),
            p95Ms: Math.round(percentile(latencySamples, 0.95)),
            p99Ms: Math.round(percentile(latencySamples, 0.99)),
            maxMs: Math.round(metrics.latencyMaxMs)
        }
    };
}

async function main() {
    console.log('Load test config:', JSON.stringify(config));
    await loadWorldConfig();
    console.log('World config:', JSON.stringify(world));
    const startedAt = performance.now();

    const connectionResults = await Promise.all(
        Array.from({ length: config.clients }, (_, index) => connectClient(index + 1))
    );

    const failedConnections = connectionResults.filter(result => !result.ok);
    if (failedConnections.length > 0) {
        console.error('Connection failures:', failedConnections.slice(0, 10));
    }

    if (config.loadInitialTiles) {
        console.log('Fetching initial visible tiles...');
        await Promise.all(clients.map(client => fetchInitialTiles(client.id)));
    }

    console.log(`Starting drawing for ${config.durationMs}ms...`);
    startDrawing();

    const progressTimer = setInterval(() => printProgress(startedAt), 5000);
    await sleep(config.durationMs);
    stopDrawing();

    console.log('Waiting for final broadcasts...');
    await sleep(3000);
    clearInterval(progressTimer);
    disconnectClients();

    const summary = summarize(performance.now() - startedAt);
    console.log('LOAD_TEST_SUMMARY ' + JSON.stringify(summary, null, 2));
}

main().catch(error => {
    console.error(error);
    stopDrawing();
    disconnectClients();
    process.exit(1);
});
