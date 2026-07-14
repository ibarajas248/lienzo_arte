const loginOverlay = document.getElementById('login-overlay');
if (loginOverlay) loginOverlay.classList.add('hidden');
const loginStatus = document.getElementById('login-status');
const googleLoginBtn = document.getElementById('google-login-btn');
const guestLoginBtn = document.getElementById('guest-login-btn');
const toolbarLoginBtn = document.getElementById('toolbar-login-btn');
const toolbarLogoutBtn = document.getElementById('toolbar-logout-btn');
const authUserText = document.getElementById('auth-user-text');
const adminTools = document.getElementById('admin-tools');
const adminUserSelect = document.getElementById('admin-user-select');
const adminRefreshBtn = document.getElementById('admin-refresh-btn');
const adminExportSvgBtn = document.getElementById('admin-export-svg-btn');
const adminExportJpgBtn = document.getElementById('admin-export-jpg-btn');
const adminTracingInput = document.getElementById('admin-tracing-input');
const adminTracingToggleBtn = document.getElementById('admin-tracing-toggle-btn');
const adminTracingMoveBtn = document.getElementById('admin-tracing-move-btn');
const adminTracingClearBtn = document.getElementById('admin-tracing-clear-btn');
const adminTracingControls = document.getElementById('admin-tracing-controls');
const adminTracingOpacitySlider = document.getElementById('admin-tracing-opacity-slider');
const adminTracingOpacityValue = document.getElementById('admin-tracing-opacity-value');
const adminTracingScaleSlider = document.getElementById('admin-tracing-scale-slider');
const adminTracingScaleValue = document.getElementById('admin-tracing-scale-value');
const adminTracingStatus = document.getElementById('admin-tracing-status');
const adminStatus = document.getElementById('admin-status');
const adminExportStatus = document.getElementById('admin-export-status');

const FIREBASE_BROWSER_SDK_VERSION = '10.12.5';
const AUTH_MODE_STORAGE_KEY = 'lienzo:auth-mode';

let firebaseClientAuth = null;
let firebaseAuthApi = null;
let googleAuthProvider = null;
let currentFirebaseUser = null;
let selectedAnonymousMode = localStorage.getItem(AUTH_MODE_STORAGE_KEY) === 'guest';
let authObserverReady = false;

async function buildSocketAuthPayload() {
    if (!currentFirebaseUser) return {};
    const token = await currentFirebaseUser.getIdToken();
    return { token };
}

const socket = io({
    autoConnect: false,
    transports: ['websocket', 'polling'],
    tryAllTransports: true,
    auth: (callback) => {
        buildSocketAuthPayload()
            .then(payload => callback(payload))
            .catch((error) => {
                console.error('No se pudo preparar el token de autenticacion:', error);
                callback({});
            });
    }
});

const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d', { alpha: false });

const colorPicker = document.getElementById('color-picker');
const sizeSlider = document.getElementById('size-slider');
const sizeValue = document.getElementById('size-value');
const brushBtn = document.getElementById('brush-btn');
const pressureBrushBtn = document.getElementById('pressure-brush-btn');
const pressureBrushStatus = document.getElementById('pressure-brush-status');
const textToolBtn = document.getElementById('text-tool-btn');
const textControls = document.getElementById('text-controls');
const textInput = document.getElementById('text-input');
const textSizeSlider = document.getElementById('text-size-slider');
const textSizeValue = document.getElementById('text-size-value');
const textStatus = document.getElementById('text-status');
const eraserBtn = document.getElementById('eraser-btn');
const paintBucketBtn = document.getElementById('paint-bucket-btn');
const eyedropperBtn = document.getElementById('eyedropper-btn');
const undoBtn = document.getElementById('undo-btn');
const undoFloatingBtn = document.getElementById('undo-floating-btn');
const redoBtn = document.getElementById('redo-btn');
const redoFloatingBtn = document.getElementById('redo-floating-btn');
const clearBtn = document.getElementById('clear-btn');
const imageUploadBtn = document.getElementById('image-upload-btn');
const imageInput = document.getElementById('image-input');
const imageStatus = document.getElementById('image-status');
const imageSizeControls = document.getElementById('image-size-controls');
const imageSizeSlider = document.getElementById('image-size-slider');
const imageSizeValue = document.getElementById('image-size-value');
const imageSmallerBtn = document.getElementById('image-smaller-btn');
const imageLargerBtn = document.getElementById('image-larger-btn');
const brushFloatingBtn = document.getElementById('brush-floating-btn');
const handFloatingBtn = document.getElementById('hand-floating-btn');
const panBtn = document.getElementById('pan-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const resetViewBtn = document.getElementById('reset-view-btn');
const zoomValue = document.getElementById('zoom-value');
const statusDot = document.getElementById('connection-status');
const statusText = document.getElementById('status-text');
const tileText = document.getElementById('tile-text');
const toolbar = document.getElementById('toolbar');
const menuToggle = document.getElementById('menu-toggle');
const menuClose = document.getElementById('menu-close');
const toolbarBackdrop = document.getElementById('toolbar-backdrop');
const minimap = document.getElementById('canvas-minimap');
const minimapToggle = document.getElementById('minimap-toggle');
const minimapScroll = document.getElementById('minimap-scroll');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapTrack = document.getElementById('minimap-track');
const minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d', { alpha: false }) : null;
const minimapPosition = document.getElementById('minimap-position');

const DEFAULT_WORLD = { width: 1280, height: 2400, entryScrollY: 0, tileSize: 1024, minY: 0, canvasId: 'main' };
const MIN_POINT_DISTANCE = 0.75;
const OUTBOUND_FLUSH_MS = 33;
const OUTBOUND_MAX_BATCH = 160;
const TILE_PADDING = 1;
const TILE_LOAD_LIMIT = 120;
const TILE_FETCH_ROWS_PER_BATCH = 1;
const TILE_FETCH_CONCURRENCY = 3;
const MIN_ZOOM = 0.12;
const MAX_ZOOM = 5;
const MAX_RENDER_DPR = 1.5;
const MAX_MINIMAP_DPR = 1.25;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const IMAGE_MAX_WIDTH = 760;
const IMAGE_MAX_HEIGHT = 1400;
const IMAGE_MIN_SCALE_PERCENT = 20;
const IMAGE_MAX_SCALE_PERCENT = 240;
const IMAGE_SCALE_STEP_PERCENT = 10;
const IMAGE_CELL_SIZE = 3;
const IMAGE_COLOR_COUNT = 24;
const IMAGE_KMEANS_ITERATIONS = 4;
const IMAGE_PALETTE_SAMPLE_LIMIT = 9000;
const IMAGE_SEND_CHUNK_SIZE = 500;
const VECTOR_RECT_BLEED = 0.45;
const FILL_SAMPLE_STEP = 4;
const FILL_COLOR_TOLERANCE = 34;
const FILL_MAX_CELLS = 140000;
const FILL_MIN_SCREEN_AREA = 1;
const ADMIN_HIGHLIGHT_VEIL_ALPHA = 0.68;
const ADMIN_TILE_FETCH_CONCURRENCY = 2;
const TILE_RASTER_CACHE_SCALE = 1;
const TILE_RASTER_CACHE_MAX_DESKTOP = 28;
const TILE_RASTER_CACHE_MAX_MOBILE = 12;
const MINIMAP_OVERVIEW_REFRESH_MS = 45000;
const MINIMAP_RENDER_INTERVAL_MS = 140;
const MINIMAP_AUTO_SCROLL_IDLE_MS = 900;
const MOBILE_MINIMAP_MEDIA_QUERY = '(max-width: 768px)';
const MAX_UNDO_ACTIONS = 80;
const UNDO_SEND_CHUNK_SIZE = 5000;
const MIN_PINCH_DISTANCE = 18;
const EXPORT_MIN_SELECTION_SIZE = 8;
const TRACING_MIN_SCALE_PERCENT = 20;
const TRACING_MAX_SCALE_PERCENT = 300;
const TRACING_DEFAULT_OPACITY_PERCENT = 40;
const PRESSURE_MIN_SIZE_MULTIPLIER = 0.35;
const PRESSURE_MAX_SIZE_MULTIPLIER = 2.6;
const PRESSURE_MIN_OPACITY = 0.72;
const PRESSURE_SMOOTHING = 0.38;
const DRAW_INTERPOLATION_MAX_STEPS = 32;
const DRAW_COALESCED_EVENT_LIMIT = 16;
const TEXT_MAX_LENGTH = 240;
const TEXT_MAX_LINES = 32;
const TEXT_DEFAULT_FONT = 'Inter, Arial, sans-serif';
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/x-png', 'image/webp']);
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

let worldConfig = { ...DEFAULT_WORLD };
let camera = { x: DEFAULT_WORLD.width / 2, y: 500, zoom: 1 };
let canvasSize = { width: 0, height: 0, dpr: 1 };
let isDrawing = false;
let isPanning = false;
let isEraser = false;
let isPanMode = true;
let isFillMode = false;
let isEyedropperMode = false;
let isPressureBrushMode = false;
let isTextMode = false;
let isFilling = false;
let currentX = 0;
let currentY = 0;
let currentBrushSize = 1;
let currentBrushOpacity = 1;
let currentPressure = 1;
let panStart = null;
let activeCanvasPointers = new Map();
let pinchState = null;
let outboundSegments = [];
let outboundFlushTimer = null;
let undoStack = [];
let redoStack = [];
let activeUndoAction = null;
let isUndoing = false;
let loadedTiles = new Set();
let loadingTiles = new Set();
let visibleTiles = new Set();
let tileSegments = new Map();
let tileSegmentIdentitySets = new Map();
let tileSnapshots = new Map();
let tileSnapshotImages = new Map();
let tileRasterCache = new Map();
let tileRasterRevision = new Map();
let tileRasterCacheUseCounter = 0;
let renderQueued = false;
let tileSyncTimer = null;
let pendingImagePlacement = null;
let isCommittingImage = false;
let clientSegmentOrder = Date.now() * 1000;
let segmentCacheId = 0;
let renderSegments = [];
let renderSegmentsDirty = true;
let tileLoadGeneration = 0;
let activeTileLoadAbort = null;
let activeTileLoadKeys = new Set();
let lastHudZoomText = '';
let lastHudTileText = '';
let minimapOverview = {
    width: DEFAULT_WORLD.width,
    height: DEFAULT_WORLD.height,
    tileSize: DEFAULT_WORLD.tileSize,
    rows: [],
    minimapSnapshot: null,
    snapshotTiles: []
};
let minimapSnapshotImages = new Map();
let minimapRasterImage = null;
let minimapMetrics = null;
let isMinimapDragging = false;
let isMinimapAutoScrolling = false;
let lastMinimapManualScrollAt = 0;
let minimapRefreshTimer = null;
let minimapRenderQueued = false;
let minimapRenderTimer = null;
let lastMinimapRenderAt = 0;
let isCurrentUserAdmin = false;
let selectedAdminUserEmail = '';
let adminContributors = [];
let adminTileSegments = new Map();
let adminLoadedTiles = new Set();
let adminLoadingTiles = new Set();
let adminTileLoadGeneration = 0;
let activeAdminTileLoadAbort = null;
let adminTileLoadKeys = new Set();
let isExportSelectionMode = false;
let isExportSelecting = false;
let isExportingSvg = false;
let activeExportFormat = 'svg';
let exportSelectionStart = null;
let exportSelection = null;
let tracingOverlay = null;
let isTracingMoveMode = false;
let isDraggingTracingOverlay = false;
let tracingDragStart = null;

function setToolbarOpen(isOpen) {
    toolbar.classList.toggle('open', isOpen);
    toolbarBackdrop.classList.toggle('open', isOpen);
    toolbar.setAttribute('aria-hidden', String(!isOpen));
    menuToggle.setAttribute('aria-expanded', String(isOpen));
}

function isTextEntryTarget(target) {
    if (!target) return false;
    const tagName = String(target.tagName || '').toLowerCase();
    return tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select'
        || Boolean(target.isContentEditable);
}

menuToggle.addEventListener('click', () => setToolbarOpen(!toolbar.classList.contains('open')));
menuClose.addEventListener('click', () => setToolbarOpen(false));
toolbarBackdrop.addEventListener('click', () => setToolbarOpen(false));
document.addEventListener('keydown', (event) => {
    if (isTextEntryTarget(event.target)) {
        if (event.key === 'Escape') event.target.blur();
        return;
    }

    if ((event.ctrlKey || event.metaKey) && ((event.key.toLowerCase() === 'z' && event.shiftKey) || event.key.toLowerCase() === 'y')) {
        event.preventDefault();
        redoLastAction();
        return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoLastAction();
        return;
    }

    if (event.key === 'Escape') {
        if (pendingImagePlacement) {
            cancelPendingImagePlacement();
        } else if (isExportSelectionMode) {
            cancelExportSelectionMode();
        } else if (isTracingMoveMode) {
            setTracingMoveMode(false);
        } else {
            setToolbarOpen(false);
        }
    }
    if (event.code === 'Space' && !event.repeat) {
        event.preventDefault();
        setPanMode(true);
    }
});
document.addEventListener('keyup', (event) => {
    if (isTextEntryTarget(event.target)) return;
    if (event.code === 'Space') {
        event.preventDefault();
        setPanMode(false);
    }
});

function normalizeWorldConfig(control) {
    const width = Number(control.width);
    const height = Number(control.height);
    const entryScrollY = Number(control.entryScrollY);
    const tileSize = Number(control.tileSize);
    const normalizedTileSize = Number.isFinite(tileSize) && tileSize > 0 ? Math.round(tileSize) : DEFAULT_WORLD.tileSize;
    const minY = Number(control.minY);

    return {
        width: Number.isFinite(width) && width > 0 ? Math.round(width) : DEFAULT_WORLD.width,
        height: Number.isFinite(height) && height > 0 ? Math.round(height) : DEFAULT_WORLD.height,
        entryScrollY: Number.isFinite(entryScrollY) ? Math.round(entryScrollY) : DEFAULT_WORLD.entryScrollY,
        tileSize: normalizedTileSize,
        minY: Number.isFinite(minY) ? Math.max(0, Math.round(minY)) : DEFAULT_WORLD.minY,
        canvasId: String(control.canvasId || DEFAULT_WORLD.canvasId)
    };
}

async function loadWorldConfig() {
    try {
        const response = await fetch('/api/canvas-control', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        worldConfig = normalizeWorldConfig(await response.json());
    } catch (error) {
        console.error('No se pudo cargar la configuracion del mundo:', error);
        worldConfig = { ...DEFAULT_WORLD };
    }

    resetCamera(false);
}

function updateToolButtons() {
    if (panBtn) panBtn.classList.toggle('active', isPanMode);
    if (canvas) {
        canvas.classList.toggle('is-panning-mode', isPanMode);
        canvas.classList.toggle('is-fill-mode', isFillMode);
        canvas.classList.toggle('is-eyedropper-mode', isEyedropperMode);
        canvas.classList.toggle('is-export-select-mode', isExportSelectionMode);
        canvas.classList.toggle('is-tracing-move-mode', isTracingMoveMode);
    }
    if (brushFloatingBtn) {
        const isBrushActive = !isPressureBrushMode && !isTextMode && !isExportSelectionMode && !isPanMode && !isFillMode && !isEyedropperMode && !isEraser;
        brushFloatingBtn.classList.toggle('active', isBrushActive);
        brushFloatingBtn.setAttribute('aria-pressed', String(isBrushActive));
    }
    if (brushBtn) {
        const isBrushActive = !isPressureBrushMode && !isTextMode && !isExportSelectionMode && !isPanMode && !isFillMode && !isEyedropperMode && !isEraser;
        brushBtn.classList.toggle('active', isBrushActive);
    }
    if (pressureBrushBtn) {
        pressureBrushBtn.classList.toggle('active', isPressureBrushMode);
    }
    if (textToolBtn) textToolBtn.classList.toggle('active', isTextMode);
    if (textControls) textControls.hidden = !isTextMode;
    if (handFloatingBtn) {
        handFloatingBtn.classList.toggle('active', isPanMode);
        handFloatingBtn.setAttribute('aria-pressed', String(isPanMode));
    }
    if (paintBucketBtn) paintBucketBtn.classList.toggle('active', isFillMode);
    if (eyedropperBtn) eyedropperBtn.classList.toggle('active', isEyedropperMode);
    if (eraserBtn) eraserBtn.classList.toggle('active', isEraser);
    if (adminExportSvgBtn) {
        adminExportSvgBtn.classList.toggle('active', isExportSelectionMode && activeExportFormat === 'svg');
        adminExportSvgBtn.disabled = !isCurrentUserAdmin || isExportingSvg;
    }
    if (adminExportJpgBtn) {
        adminExportJpgBtn.classList.toggle('active', isExportSelectionMode && activeExportFormat === 'jpg');
        adminExportJpgBtn.disabled = !isCurrentUserAdmin || isExportingSvg;
    }
    if (adminTracingToggleBtn) {
        adminTracingToggleBtn.classList.toggle('active', Boolean(tracingOverlay && tracingOverlay.visible));
        adminTracingToggleBtn.disabled = !isCurrentUserAdmin;
    }
    if (adminTracingMoveBtn) {
        adminTracingMoveBtn.classList.toggle('active', isTracingMoveMode);
        adminTracingMoveBtn.disabled = !isCurrentUserAdmin || !tracingOverlay || !tracingOverlay.visible;
    }
    if (adminTracingClearBtn) {
        adminTracingClearBtn.disabled = !isCurrentUserAdmin || !tracingOverlay;
    }
}

function setPanMode(nextPanMode) {
    if (nextPanMode) cancelExportSelectionMode();
    if (nextPanMode) setTracingMoveMode(false);
    isPanMode = nextPanMode;
    if (nextPanMode) {
        isFillMode = false;
        isEyedropperMode = false;
        isEraser = false;
        isPressureBrushMode = false;
        isTextMode = false;
    }
    updateToolButtons();
}

function setBrushMode() {
    cancelExportSelectionMode();
    setTracingMoveMode(false);
    isPanMode = false;
    isFillMode = false;
    isEyedropperMode = false;
    isEraser = false;
    isPressureBrushMode = false;
    isTextMode = false;
    updateToolButtons();
}

function setPressureBrushMode() {
    if (!canEditCanvas()) {
        setLoginOverlayVisible(true);
        setLoginStatus('Inicia sesion con Google para usar pincel de presion.');
        return;
    }

    cancelExportSelectionMode();
    setTracingMoveMode(false);
    isPanMode = false;
    isFillMode = false;
    isEyedropperMode = false;
    isEraser = false;
    isPressureBrushMode = true;
    isTextMode = false;
    if (pressureBrushStatus) pressureBrushStatus.innerText = 'Listo: usa lapiz/tableta con presion.';
    updateToolButtons();
}

function setTextMode(nextTextMode = !isTextMode) {
    if (nextTextMode && !canEditCanvas()) {
        setLoginOverlayVisible(true);
        setLoginStatus('Inicia sesion con Google para agregar texto.');
        return;
    }

    isTextMode = Boolean(nextTextMode);
    if (isTextMode) {
        cancelExportSelectionMode();
        setTracingMoveMode(false);
        isPanMode = false;
        isFillMode = false;
        isEyedropperMode = false;
        isEraser = false;
        isPressureBrushMode = false;
        if (textInput && !normalizeTextValue(textInput.value)) textInput.focus();
    }
    updateToolButtons();
}

function setFillMode(nextFillMode) {
    if (nextFillMode && !canEditCanvas()) {
        setLoginOverlayVisible(true);
        setLoginStatus('Inicia sesion con Google para usar el bote de pintura.');
        return;
    }

    isFillMode = nextFillMode;
    if (isFillMode) {
        cancelExportSelectionMode();
        setTracingMoveMode(false);
        isPanMode = false;
        isEyedropperMode = false;
        isEraser = false;
        isPressureBrushMode = false;
        isTextMode = false;
        setToolbarOpen(false);
    }
    updateToolButtons();
}

function setEyedropperMode(nextEyedropperMode) {
    if (nextEyedropperMode && !canEditCanvas()) {
        setLoginOverlayVisible(true);
        setLoginStatus('Inicia sesion con Google para usar el cuentagotas.');
        return;
    }

    isEyedropperMode = nextEyedropperMode;
    if (isEyedropperMode) {
        cancelExportSelectionMode();
        setTracingMoveMode(false);
        isPanMode = false;
        isFillMode = false;
        isEraser = false;
        isPressureBrushMode = false;
        isTextMode = false;
        setToolbarOpen(false);
    }
    updateToolButtons();
}

function resetCamera(shouldRender = true) {
    camera = {
        x: worldConfig.width / 2,
        y: Math.max(0, worldConfig.entryScrollY) + Math.min(window.innerHeight, worldConfig.height) / 2,
        zoom: 1
    };
    clampCamera();

    if (shouldRender) {
        requestRender();
        syncVisibleTiles();
    }
}

function setLoginOverlayVisible(isVisible) {
    if (!loginOverlay) return;
    loginOverlay.classList.toggle('hidden', !isVisible);
}

function setLoginStatus(message, isError = false) {
    if (!loginStatus) return;
    loginStatus.innerText = message || '';
    loginStatus.classList.toggle('error', isError);
}

function setAuthBusy(isBusy) {
    if (googleLoginBtn) googleLoginBtn.disabled = isBusy;
    if (guestLoginBtn) guestLoginBtn.disabled = isBusy;
    if (toolbarLoginBtn) toolbarLoginBtn.disabled = isBusy;
    if (toolbarLogoutBtn) toolbarLogoutBtn.disabled = isBusy;
}

function canEditCanvas() {
    return Boolean(currentFirebaseUser);
}

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function getCurrentUserName() {
    if (!currentFirebaseUser) return '';
    return currentFirebaseUser.displayName || currentFirebaseUser.email || currentFirebaseUser.uid || 'Usuario';
}

function getCurrentUserEmail() {
    if (!currentFirebaseUser) return '';
    return normalizeEmail(currentFirebaseUser.email || currentFirebaseUser.uid || '');
}

function tagSegmentsWithCurrentUser(segments) {
    if (!currentFirebaseUser) return segments;

    const userEmail = getCurrentUserEmail();
    const userName = getCurrentUserName();
    const userUid = String(currentFirebaseUser.uid || '');

    for (const segment of segments || []) {
        if (!segment || typeof segment !== 'object') continue;
        segment.userEmail = userEmail;
        segment.userName = userName;
        segment.userUid = userUid;
    }

    return segments;
}

function updateCanvasPermissions() {
    const canEdit = canEditCanvas();
    const lockedTitle = 'Inicia sesion con Google para dibujar';

    if (colorPicker) colorPicker.disabled = !canEdit;
    if (sizeSlider) sizeSlider.disabled = !canEdit;
    if (eraserBtn) {
        eraserBtn.disabled = !canEdit;
        eraserBtn.title = canEdit ? 'Borrador' : lockedTitle;
    }
    if (paintBucketBtn) {
        paintBucketBtn.disabled = !canEdit || isFilling;
        paintBucketBtn.title = canEdit ? 'Bote de pintura' : lockedTitle;
    }
    if (eyedropperBtn) {
        eyedropperBtn.disabled = !canEdit;
        eyedropperBtn.title = canEdit ? 'Cuentagotas' : lockedTitle;
    }
    if (imageUploadBtn) {
        imageUploadBtn.disabled = !canEdit || isCommittingImage;
        imageUploadBtn.title = canEdit ? 'Anadir imagen vectorizada' : lockedTitle;
    }
    const canResizePendingImage = canEdit && Boolean(pendingImagePlacement) && !isCommittingImage;
    if (imageSizeSlider) imageSizeSlider.disabled = !canResizePendingImage;
    if (imageSmallerBtn) imageSmallerBtn.disabled = !canResizePendingImage;
    if (imageLargerBtn) imageLargerBtn.disabled = !canResizePendingImage;
    if (clearBtn) {
        clearBtn.disabled = !canEdit;
        clearBtn.title = canEdit ? 'Limpiar Lienzo' : lockedTitle;
    }
    if (brushFloatingBtn) {
        brushFloatingBtn.disabled = !canEdit;
        brushFloatingBtn.title = canEdit ? 'Pincel' : lockedTitle;
    }
    if (brushBtn) {
        brushBtn.disabled = !canEdit;
        brushBtn.title = canEdit ? 'Pincel' : lockedTitle;
    }
    if (pressureBrushBtn) {
        pressureBrushBtn.disabled = !canEdit;
        pressureBrushBtn.title = canEdit ? 'Pincel de presion para tableta/lapiz' : lockedTitle;
    }
    if (textToolBtn) {
        textToolBtn.disabled = !canEdit;
        textToolBtn.title = canEdit ? 'Agregar texto al lienzo' : lockedTitle;
    }
    if (textInput) textInput.disabled = !canEdit;
    if (textSizeSlider) textSizeSlider.disabled = !canEdit;
    if (adminExportSvgBtn) {
        adminExportSvgBtn.disabled = !isCurrentUserAdmin || isExportingSvg;
        adminExportSvgBtn.title = isCurrentUserAdmin
            ? 'Seleccionar area y exportar SVG'
            : 'Solo disponible para el admin';
    }
    if (adminExportJpgBtn) {
        adminExportJpgBtn.disabled = !isCurrentUserAdmin || isExportingSvg;
        adminExportJpgBtn.title = isCurrentUserAdmin
            ? 'Seleccionar area y exportar JPG rapido desde snapshots'
            : 'Solo disponible para el admin';
    }
    if (adminTracingToggleBtn) {
        adminTracingToggleBtn.disabled = !isCurrentUserAdmin;
        adminTracingToggleBtn.title = isCurrentUserAdmin
            ? 'Cargar u ocultar imagen de calco'
            : 'Solo disponible para el admin';
    }
    if (adminTracingMoveBtn) {
        adminTracingMoveBtn.disabled = !isCurrentUserAdmin || !tracingOverlay || !tracingOverlay.visible;
    }
    if (adminTracingClearBtn) {
        adminTracingClearBtn.disabled = !isCurrentUserAdmin || !tracingOverlay;
    }

    if (!canEdit && (!isPanMode || isFillMode || isEyedropperMode || isEraser || isPressureBrushMode || isTextMode || isExportSelectionMode)) {
        setPanMode(true);
    }

    updateToolButtons();
    updateImageSizeControls();
    updateTracingControls();
    updateUndoButtons();
}

function updateAuthUi(user, authAvailable) {
    if (authUserText) {
        authUserText.innerText = user
            ? (user.displayName || user.email || 'Usuario')
            : 'Invitado - solo lectura';
    }

    if (toolbarLoginBtn) toolbarLoginBtn.hidden = !authAvailable || Boolean(user);
    if (toolbarLogoutBtn) toolbarLogoutBtn.hidden = !authAvailable || !user;
    updateCanvasPermissions();
    refreshAdminContributors();
}

function setAdminStatus(message) {
    if (adminStatus) adminStatus.innerText = message || '';
}

function setAdminExportStatus(message, isVisible = Boolean(message)) {
    if (!adminExportStatus) return;
    adminExportStatus.innerText = message || '';
    adminExportStatus.hidden = !isVisible;
}

function cancelExportSelectionMode() {
    isExportSelectionMode = false;
    isExportSelecting = false;
    exportSelectionStart = null;
    exportSelection = null;
    setAdminExportStatus('', false);
    updateToolButtons();
    requestRender();
}

function setAdminTracingStatus(message) {
    if (adminTracingStatus) adminTracingStatus.innerText = message || '';
}

function clampTracingScalePercent(value) {
    const scalePercent = Number(value);
    if (!Number.isFinite(scalePercent)) return 100;
    return Math.min(Math.max(Math.round(scalePercent), TRACING_MIN_SCALE_PERCENT), TRACING_MAX_SCALE_PERCENT);
}

function clampTracingOpacityPercent(value) {
    const opacity = Number(value);
    if (!Number.isFinite(opacity)) return TRACING_DEFAULT_OPACITY_PERCENT;
    return Math.min(Math.max(Math.round(opacity), 10), 90);
}

function updateTracingControls() {
    const hasTracing = Boolean(isCurrentUserAdmin && tracingOverlay);
    if (adminTracingControls) adminTracingControls.hidden = !hasTracing;
    if (!hasTracing) return;

    const opacityPercent = clampTracingOpacityPercent(tracingOverlay.opacity * 100);
    const scalePercent = clampTracingScalePercent(tracingOverlay.scalePercent);
    if (adminTracingOpacitySlider) adminTracingOpacitySlider.value = String(opacityPercent);
    if (adminTracingOpacityValue) adminTracingOpacityValue.innerText = String(opacityPercent);
    if (adminTracingScaleSlider) adminTracingScaleSlider.value = String(scalePercent);
    if (adminTracingScaleValue) adminTracingScaleValue.innerText = String(scalePercent);
}

function getBaseTracingPlacement(image, centerPoint = { x: camera.x, y: camera.y }) {
    const source = getDrawableImageSize(image);
    const viewportWidth = canvasSize.width > 0 ? canvasSize.width / Math.max(camera.zoom, MIN_ZOOM) : worldConfig.width;
    const viewportHeight = canvasSize.height > 0 ? canvasSize.height / Math.max(camera.zoom, MIN_ZOOM) : Math.min(worldConfig.height, 1600);
    const maxWidth = Math.min(worldConfig.width * 0.92, viewportWidth * 0.82);
    const maxHeight = Math.max(120, viewportHeight * 0.82);
    const scale = Math.min(maxWidth / source.width, maxHeight / source.height, 1);
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    return {
        center: { x: centerPoint.x, y: centerPoint.y },
        baseWidth: width,
        baseHeight: height,
        scalePercent: 100
    };
}

function updateTracingPlacementFromState() {
    if (!tracingOverlay) return;

    const scale = clampTracingScalePercent(tracingOverlay.scalePercent) / 100;
    tracingOverlay.width = Math.max(1, Math.round(tracingOverlay.baseWidth * scale));
    tracingOverlay.height = Math.max(1, Math.round(tracingOverlay.baseHeight * scale));
    const center = tracingOverlay.center || { x: camera.x, y: camera.y };
    tracingOverlay.x = Math.round(Math.min(Math.max(center.x - tracingOverlay.width / 2, 0), Math.max(worldConfig.width - tracingOverlay.width, 0)));
    tracingOverlay.y = Math.round(Math.max(center.y - tracingOverlay.height / 2, 0));
    tracingOverlay.center = {
        x: tracingOverlay.x + tracingOverlay.width / 2,
        y: tracingOverlay.y + tracingOverlay.height / 2
    };
}

function setTracingMoveMode(nextMode) {
    isTracingMoveMode = Boolean(nextMode && isCurrentUserAdmin && tracingOverlay && tracingOverlay.visible);
    if (!isTracingMoveMode) {
        isDraggingTracingOverlay = false;
        tracingDragStart = null;
    } else {
        isPanMode = false;
        isFillMode = false;
        isEyedropperMode = false;
        isEraser = false;
        isTextMode = false;
        cancelExportSelectionMode();
    }
    updateToolButtons();
    requestRender();
}

function closeTracingOverlay(message = '') {
    if (tracingOverlay && tracingOverlay.image) closeImageResource(tracingOverlay.image);
    tracingOverlay = null;
    isTracingMoveMode = false;
    isDraggingTracingOverlay = false;
    tracingDragStart = null;
    if (adminTracingInput) adminTracingInput.value = '';
    setAdminTracingStatus(message || 'Calco quitado.');
    updateTracingControls();
    updateToolButtons();
    requestRender();
}

function toggleTracingOverlay() {
    if (!isCurrentUserAdmin) {
        setAdminTracingStatus('Solo el admin puede usar calco.');
        return;
    }

    if (!tracingOverlay) {
        if (adminTracingInput) adminTracingInput.click();
        return;
    }

    tracingOverlay.visible = !tracingOverlay.visible;
    if (!tracingOverlay.visible) setTracingMoveMode(false);
    setAdminTracingStatus(tracingOverlay.visible
        ? 'Calco visible. Puedes pintar encima; activa Mover para acomodarlo.'
        : 'Calco oculto. No se guarda en el lienzo.');
    updateTracingControls();
    updateToolButtons();
    requestRender();
}

async function handleTracingFile(file) {
    if (!file) return;

    if (!isCurrentUserAdmin) {
        setAdminTracingStatus('Solo el admin puede usar calco.');
        return;
    }

    if (!isSupportedImage(file)) {
        setAdminTracingStatus('Formato no soportado. Usa JPG, PNG o WebP.');
        return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
        setAdminTracingStatus('Imagen demasiado pesada. Maximo 12 MB.');
        return;
    }

    setAdminTracingStatus('Cargando calco...');

    try {
        const image = await loadDrawableImage(file);
        closeTracingOverlay('');
        const basePlacement = getBaseTracingPlacement(image);
        tracingOverlay = {
            image,
            visible: true,
            opacity: TRACING_DEFAULT_OPACITY_PERCENT / 100,
            center: basePlacement.center,
            baseWidth: basePlacement.baseWidth,
            baseHeight: basePlacement.baseHeight,
            scalePercent: basePlacement.scalePercent,
            x: 0,
            y: 0,
            width: 1,
            height: 1
        };
        updateTracingPlacementFromState();
        setAdminTracingStatus('Calco listo. Puedes pintar encima; activa Mover para acomodarlo.');
        updateTracingControls();
        updateToolButtons();
        requestRender();
    } catch (error) {
        console.error('No se pudo cargar el calco:', error);
        setAdminTracingStatus('No se pudo cargar el calco.');
    } finally {
        if (adminTracingInput) adminTracingInput.value = '';
    }
}

function setTracingOpacity(value) {
    if (!tracingOverlay) return;
    const opacityPercent = clampTracingOpacityPercent(value);
    tracingOverlay.opacity = opacityPercent / 100;
    updateTracingControls();
    requestRender();
}

function setTracingScale(value) {
    if (!tracingOverlay) return;
    tracingOverlay.scalePercent = clampTracingScalePercent(value);
    updateTracingPlacementFromState();
    updateTracingControls();
    requestRender();
}

function isPointInsideTracingOverlay(point) {
    return Boolean(tracingOverlay
        && tracingOverlay.visible
        && point.x >= tracingOverlay.x
        && point.x <= tracingOverlay.x + tracingOverlay.width
        && point.y >= tracingOverlay.y
        && point.y <= tracingOverlay.y + tracingOverlay.height);
}

function startTracingMove(event) {
    if (!isTracingMoveMode || !tracingOverlay || !tracingOverlay.visible) return false;

    const point = clampWorldPoint(getPointerWorld(event));
    if (!isPointInsideTracingOverlay(point)) return true;

    isDraggingTracingOverlay = true;
    tracingDragStart = {
        point,
        x: tracingOverlay.x,
        y: tracingOverlay.y
    };
    return true;
}

function moveTracingOverlay(event) {
    if (!isDraggingTracingOverlay || !tracingOverlay || !tracingDragStart) return false;

    const point = clampWorldPoint(getPointerWorld(event));
    const nextX = tracingDragStart.x + point.x - tracingDragStart.point.x;
    const nextY = tracingDragStart.y + point.y - tracingDragStart.point.y;
    tracingOverlay.x = Math.round(Math.min(Math.max(nextX, 0), Math.max(worldConfig.width - tracingOverlay.width, 0)));
    tracingOverlay.y = Math.round(Math.max(nextY, 0));
    tracingOverlay.center = {
        x: tracingOverlay.x + tracingOverlay.width / 2,
        y: tracingOverlay.y + tracingOverlay.height / 2
    };
    requestRender();
    return true;
}

function stopTracingMove() {
    if (!isDraggingTracingOverlay) return false;
    isDraggingTracingOverlay = false;
    tracingDragStart = null;
    return true;
}

function resetAdminState() {
    cancelExportSelectionMode();
    closeTracingOverlay('');
    isCurrentUserAdmin = false;
    selectedAdminUserEmail = '';
    adminContributors = [];
    adminTileSegments = new Map();
    adminLoadedTiles = new Set();
    adminLoadingTiles = new Set();
    if (activeAdminTileLoadAbort) activeAdminTileLoadAbort.abort();
    activeAdminTileLoadAbort = null;
    adminTileLoadKeys = new Set();
    if (adminTools) adminTools.hidden = true;
    if (adminUserSelect) {
        adminUserSelect.innerHTML = '<option value="">Ver lienzo normal</option>';
        adminUserSelect.value = '';
    }
    updateCanvasPermissions();
    markRenderSegmentsDirty();
    requestRender();
}

async function fetchAdminBlob(url, options = {}) {
    if (!currentFirebaseUser) {
        const error = new Error('auth_required');
        error.status = 401;
        throw error;
    }

    const token = await currentFirebaseUser.getIdToken();
    const response = await fetch(url, {
        ...options,
        cache: 'no-store',
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        error.body = await response.text().catch(() => '');
        throw error;
    }

    return response.blob();
}

async function fetchAdminJson(url, options = {}) {
    if (!currentFirebaseUser) {
        const error = new Error('auth_required');
        error.status = 401;
        throw error;
    }

    const token = await currentFirebaseUser.getIdToken();
    const response = await fetch(url, {
        ...options,
        cache: 'no-store',
        headers: {
            ...(options.headers || {}),
            Authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }

    return response.json();
}

function contributorLabel(contributor) {
    const email = normalizeEmail(contributor.email || 'anonymous');
    const name = String(contributor.name || '').trim();
    const segmentCount = Number(contributor.segmentCount) || 0;
    const identity = name && name !== email ? `${name} - ${email}` : email;
    return `${identity} (${segmentCount})`;
}

function populateAdminContributors(contributors) {
    if (!adminUserSelect) return;

    const previousValue = selectedAdminUserEmail || adminUserSelect.value;
    adminUserSelect.innerHTML = '<option value="">Ver lienzo normal</option>';

    for (const contributor of contributors) {
        const email = normalizeEmail(contributor.email);
        if (!email || email === 'anonymous') continue;

        const option = document.createElement('option');
        option.value = email;
        option.innerText = contributorLabel({ ...contributor, email });
        adminUserSelect.appendChild(option);
    }

    if (previousValue && contributors.some(contributor => normalizeEmail(contributor.email) === previousValue)) {
        adminUserSelect.value = previousValue;
        selectedAdminUserEmail = previousValue;
    } else {
        adminUserSelect.value = '';
        selectedAdminUserEmail = '';
    }
}

async function refreshAdminContributors() {
    if (!currentFirebaseUser) {
        resetAdminState();
        return;
    }

    try {
        const payload = await fetchAdminJson('/api/admin/contributors');
        isCurrentUserAdmin = true;
        adminContributors = Array.isArray(payload.contributors) ? payload.contributors : [];
        if (adminTools) adminTools.hidden = false;
        updateCanvasPermissions();
        populateAdminContributors(adminContributors);
        setAdminStatus(selectedAdminUserEmail
            ? 'Filtro activo. Cargando aportes visibles...'
            : 'Selecciona un usuario para resaltar sus aportes.');
        if (selectedAdminUserEmail) syncAdminVisibleTiles(true);
    } catch (error) {
        if (error.status === 401 || error.status === 403) {
            resetAdminState();
            return;
        }

        console.error('No se pudo cargar panel admin:', error);
        if (isCurrentUserAdmin) setAdminStatus('No se pudo actualizar colaboradores.');
    }
}

function setSelectedAdminUser(email) {
    selectedAdminUserEmail = normalizeEmail(email);
    adminTileSegments = new Map();
    adminLoadedTiles = new Set();
    adminLoadingTiles = new Set();
    if (activeAdminTileLoadAbort) activeAdminTileLoadAbort.abort();
    activeAdminTileLoadAbort = null;
    adminTileLoadKeys = new Set();

    if (!selectedAdminUserEmail) {
        setAdminStatus('Vista normal del lienzo.');
        requestRender();
        return;
    }

    setAdminStatus('Cargando aportes visibles...');
    syncAdminVisibleTiles(true);
    requestRender();
}

function normalizeSelectionRect(start, end) {
    if (!start || !end) return null;

    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const right = Math.max(start.x, end.x);
    const bottom = Math.max(start.y, end.y);

    return {
        x: Math.round(left),
        y: Math.round(top),
        width: Math.round(right - left),
        height: Math.round(bottom - top)
    };
}

function setExportSelectionMode(nextMode, format = activeExportFormat) {
    if (!isCurrentUserAdmin) {
        setAdminExportStatus('Solo el admin puede exportar imagenes.', true);
        return;
    }

    isExportSelectionMode = Boolean(nextMode);
    activeExportFormat = format === 'jpg' ? 'jpg' : 'svg';
    isExportSelecting = false;
    exportSelectionStart = null;
    exportSelection = null;

    if (isExportSelectionMode) {
        isPanMode = false;
        isFillMode = false;
        isEyedropperMode = false;
        isEraser = false;
        isTextMode = false;
        pendingImagePlacement = null;
        setAdminExportStatus(activeExportFormat === 'jpg'
            ? 'Arrastra el area para exportar una captura JPG rapida desde snapshots.'
            : 'Arrastra sobre el lienzo el area que quieres exportar en SVG.', true);
        setToolbarOpen(false);
    } else {
        setAdminExportStatus('', false);
    }

    updateImageSizeControls();
    updateToolButtons();
    requestRender();
}

function startExportSelection(event) {
    if (!isCurrentUserAdmin || isExportingSvg) return false;

    const point = clampWorldPoint(getPointerWorld(event));
    isExportSelecting = true;
    exportSelectionStart = point;
    exportSelection = { x: Math.round(point.x), y: Math.round(point.y), width: 0, height: 0 };
    setAdminExportStatus('Seleccionando area...', true);
    requestRender();
    return true;
}

function updateExportSelection(event) {
    if (!isExportSelecting || !exportSelectionStart) return false;

    const point = clampWorldPoint(getPointerWorld(event));
    exportSelection = normalizeSelectionRect(exportSelectionStart, point);
    requestRender();
    return true;
}

async function finishExportSelection(event) {
    if (!isExportSelecting) return false;

    if (event) updateExportSelection(event);
    isExportSelecting = false;
    const area = exportSelection;

    if (!area || area.width < EXPORT_MIN_SELECTION_SIZE || area.height < EXPORT_MIN_SELECTION_SIZE) {
        exportSelection = null;
        exportSelectionStart = null;
        setAdminExportStatus('Seleccion demasiado pequena. Intenta de nuevo.', true);
        requestRender();
        return true;
    }

    await exportSelectedArea(area);
    exportSelectionStart = null;
    return true;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 15000);
}

async function exportSelectedArea(area) {
    if (!area || isExportingSvg) return;

    const format = activeExportFormat === 'jpg' ? 'jpg' : 'svg';
    const upperFormat = format.toUpperCase();
    isExportingSvg = true;
    updateToolButtons();
    setAdminExportStatus(`Exportando ${upperFormat} ${area.width} x ${area.height}px...`, true);

    try {
        const blob = await fetchAdminBlob(`/api/admin/export-${format}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ area })
        });
        const filename = `lienzo-x${area.x}-y${area.y}-w${area.width}-h${area.height}.${format}`;
        downloadBlob(blob, filename);
        setAdminExportStatus(format === 'jpg'
            ? `${upperFormat} snapshot exportado: ${area.width} x ${area.height}px.`
            : `${upperFormat} exportado: ${area.width} x ${area.height}px.`, true);
        isExportSelectionMode = false;
    } catch (error) {
        console.error(`No se pudo exportar ${upperFormat}:`, error);
        const tooLarge = error.status === 413;
        let payload = null;
        try {
            payload = error.body ? JSON.parse(error.body) : null;
        } catch (parseError) {
            payload = null;
        }
        const estimatedSegments = Number(payload && (payload.estimatedSegments || payload.actualSegments));
        const maxSegments = Number(payload && payload.limits && (payload.limits.maxSegments || payload.limits.maxTileSegments));
        const segmentText = Number.isFinite(estimatedSegments) && estimatedSegments > 0 && Number.isFinite(maxSegments) && maxSegments > 0
            ? ` Esta zona tiene aprox. ${estimatedSegments.toLocaleString()} segmentos; el limite rapido es ${maxSegments.toLocaleString()}.`
            : '';
        const pixelCount = Number(payload && payload.pixelCount);
        const maxRasterPixels = Number(payload && payload.limits && payload.limits.maxRasterPixels);
        const pixelText = Number.isFinite(pixelCount) && pixelCount > 0 && Number.isFinite(maxRasterPixels) && maxRasterPixels > 0
            ? ` La imagen tendria ${pixelCount.toLocaleString()} pixeles; el limite JPG es ${maxRasterPixels.toLocaleString()}.`
            : '';
        setAdminExportStatus(tooLarge
            ? `Area demasiado pesada para ${upperFormat} directo.${segmentText}${pixelText} Selecciona una zona mas pequena o menos densa.`
            : `No se pudo exportar el ${upperFormat}. Revisa tu sesion e intenta de nuevo.`, true);
    } finally {
        isExportingSvg = false;
        exportSelection = null;
        updateToolButtons();
        requestRender();
    }
}

function connectSocketWithCurrentAuth(forceReconnect = false) {
    if (forceReconnect && socket.connected) socket.disconnect();
    if (!socket.connected) socket.connect();
}

async function fetchFirebaseClientConfig() {
    const response = await fetch('/api/firebase-config', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

async function loadFirebaseBrowserSdk() {
    const sdkBase = `https://www.gstatic.com/firebasejs/${FIREBASE_BROWSER_SDK_VERSION}`;
    const [appModule, authModule] = await Promise.all([
        import(`${sdkBase}/firebase-app.js`),
        import(`${sdkBase}/firebase-auth.js`)
    ]);
    return { appModule, authModule };
}

async function signInWithGoogle() {
    if (!firebaseClientAuth || !firebaseAuthApi || !googleAuthProvider) {
        setLoginOverlayVisible(true);
        setLoginStatus('Firebase todavia no esta configurado en el servidor.', true);
        return;
    }

    selectedAnonymousMode = false;
    localStorage.setItem(AUTH_MODE_STORAGE_KEY, 'google');
    setAuthBusy(true);
    setLoginStatus('Abriendo Google...');

    try {
        await firebaseAuthApi.signInWithPopup(firebaseClientAuth, googleAuthProvider);
    } catch (error) {
        const code = error && error.code ? error.code : '';
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
            await firebaseAuthApi.signInWithRedirect(firebaseClientAuth, googleAuthProvider);
            return;
        }

        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
            setLoginStatus('Inicio cancelado.');
        } else if (code === 'auth/unauthorized-domain') {
            setLoginStatus('Este dominio no esta autorizado en Firebase.', true);
        } else {
            console.error('Error iniciando sesion con Google:', error);
            setLoginStatus('No se pudo iniciar sesion con Google.', true);
        }
    } finally {
        setAuthBusy(false);
    }
}

function continueAsGuest() {
    selectedAnonymousMode = true;
    localStorage.setItem(AUTH_MODE_STORAGE_KEY, 'guest');
    setLoginOverlayVisible(false);
    setLoginStatus('');
    updateAuthUi(currentFirebaseUser, Boolean(firebaseClientAuth));
    connectSocketWithCurrentAuth(true);
}

async function signOutToGuest() {
    selectedAnonymousMode = true;
    localStorage.setItem(AUTH_MODE_STORAGE_KEY, 'guest');
    setAuthBusy(true);

    try {
        if (firebaseClientAuth && firebaseAuthApi) {
            await firebaseAuthApi.signOut(firebaseClientAuth);
        } else {
            currentFirebaseUser = null;
            updateAuthUi(null, false);
            connectSocketWithCurrentAuth(true);
        }
    } catch (error) {
        console.error('No se pudo cerrar sesion:', error);
        setLoginStatus('No se pudo cerrar sesion.', true);
    } finally {
        setAuthBusy(false);
    }
}

async function setupAuth() {
    try {
        const firebaseConfig = await fetchFirebaseClientConfig();
        if (!firebaseConfig.enabled) {
            updateAuthUi(null, false);
            setLoginOverlayVisible(false);
            connectSocketWithCurrentAuth(false);
            return;
        }

        const { appModule, authModule } = await loadFirebaseBrowserSdk();
        const firebaseApp = appModule.initializeApp(firebaseConfig.config);
        firebaseAuthApi = authModule;
        firebaseClientAuth = authModule.getAuth(firebaseApp);
        googleAuthProvider = new authModule.GoogleAuthProvider();
        googleAuthProvider.setCustomParameters({ prompt: 'select_account' });

        const initialAuthReady = new Promise((resolve) => {
            authModule.onAuthStateChanged(firebaseClientAuth, async (user) => {
                currentFirebaseUser = user;
                updateAuthUi(user, true);

                if (user) {
                    selectedAnonymousMode = false;
                    localStorage.setItem(AUTH_MODE_STORAGE_KEY, 'google');
                    setLoginOverlayVisible(false);
                    setLoginStatus('');
                    connectSocketWithCurrentAuth(true);
                } else {
                    selectedAnonymousMode = true;
                    localStorage.setItem(AUTH_MODE_STORAGE_KEY, 'guest');
                    setLoginOverlayVisible(false);
                    setLoginStatus('');
                    connectSocketWithCurrentAuth(true);
                }

                if (!authObserverReady) {
                    authObserverReady = true;
                    resolve();
                }
            });
        });

        try {
            await authModule.getRedirectResult(firebaseClientAuth);
        } catch (error) {
            console.error('No se pudo completar el redirect de Google:', error);
            setLoginStatus('No se pudo completar el inicio con Google.', true);
        }

        await initialAuthReady;
    } catch (error) {
        console.error('Autenticacion Firebase no disponible:', error);
        updateAuthUi(null, false);
        setLoginOverlayVisible(false);
        connectSocketWithCurrentAuth(false);
    }
}

function resizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, MAX_RENDER_DPR));

    canvasSize = { width, height, dpr };
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    clampCamera();
    requestRender();
    syncVisibleTiles();
    resizeMinimap();
}

function setMinimapCollapsed(isCollapsed) {
    if (!minimap || !minimapToggle) return;

    minimap.classList.toggle('collapsed', isCollapsed);
    minimapToggle.setAttribute('aria-expanded', String(!isCollapsed));
    minimapToggle.setAttribute('aria-label', isCollapsed ? 'Mostrar navegador' : 'Ocultar navegador');
    minimapToggle.setAttribute('title', isCollapsed ? 'Mostrar navegador' : 'Ocultar navegador');

    if (!isCollapsed) resizeMinimap();
}

function applyInitialMinimapState() {
    if (!minimap || !minimapToggle) return;
    setMinimapCollapsed(window.matchMedia(MOBILE_MINIMAP_MEDIA_QUERY).matches);
}

function normalizeMinimapOverview(payload) {
    const tileSize = Number(payload && payload.tileSize);
    const height = Number(payload && payload.height);
    const width = Number(payload && payload.width);
    const rawMinimapSnapshot = payload && payload.minimapSnapshot;
    const minimapSnapshot = rawMinimapSnapshot && String(rawMinimapSnapshot.url || '').startsWith('/snapshots/')
        ? {
            url: String(rawMinimapSnapshot.url),
            width: Number(rawMinimapSnapshot.width) || 0,
            height: Number(rawMinimapSnapshot.height) || 0,
            worldWidth: Number(rawMinimapSnapshot.worldWidth) || 0,
            worldHeight: Number(rawMinimapSnapshot.worldHeight) || 0,
            byteSize: Number(rawMinimapSnapshot.byteSize) || 0,
            generatedAt: rawMinimapSnapshot.generatedAt || null
        }
        : null;
    const rows = Array.isArray(payload && payload.rows)
        ? payload.rows
            .map(row => ({
                tileY: Number(row.tileY),
                tileCount: Number(row.tileCount) || 0,
                segmentCount: Number(row.segmentCount) || 0,
                byteSize: Number(row.byteSize) || 0
            }))
            .filter(row => Number.isInteger(row.tileY) && row.tileY >= 0)
        : [];
    const snapshotTiles = Array.isArray(payload && payload.snapshotTiles)
        ? payload.snapshotTiles
            .map(tile => ({
                tileX: Number(tile.tileX),
                tileY: Number(tile.tileY),
                url: String(tile.url || ''),
                width: Number(tile.width) || (Number.isFinite(tileSize) && tileSize > 0 ? tileSize : worldConfig.tileSize),
                height: Number(tile.height) || (Number.isFinite(tileSize) && tileSize > 0 ? tileSize : worldConfig.tileSize),
                segmentCount: Number(tile.segmentCount) || 0,
                byteSize: Number(tile.byteSize) || 0
            }))
            .filter(tile => Number.isInteger(tile.tileX) && tile.tileX >= 0
                && Number.isInteger(tile.tileY) && tile.tileY >= 0
                && tile.url.startsWith('/snapshots/'))
            .sort((a, b) => (a.tileY - b.tileY) || (a.tileX - b.tileX))
        : [];

    return {
        width: Number.isFinite(width) && width > 0 ? width : worldConfig.width,
        height: Number.isFinite(height) && height > 0 ? Math.max(height, worldConfig.height) : worldConfig.height,
        tileSize: Number.isFinite(tileSize) && tileSize > 0 ? tileSize : worldConfig.tileSize,
        rows,
        minimapSnapshot,
        snapshotTiles,
        truncatedSnapshots: Boolean(payload && payload.truncatedSnapshots),
        truncated: Boolean(payload && payload.truncated)
    };
}

function refreshMinimapRasterImage() {
    const snapshot = minimapOverview.minimapSnapshot;
    if (!snapshot || !snapshot.url) {
        minimapRasterImage = null;
        return false;
    }

    if (minimapRasterImage && minimapRasterImage.url === snapshot.url) return true;

    const image = new Image();
    const state = { url: snapshot.url, image, loaded: false, error: false };
    image.decoding = 'async';
    image.onload = () => {
        state.loaded = true;
        requestMinimapRender(true);
    };
    image.onerror = () => {
        state.error = true;
        requestMinimapRender(true);
    };
    image.src = snapshot.url;
    minimapRasterImage = state;
    return true;
}

function minimapSnapshotKey(tile) {
    return `${tile.tileX}:${tile.tileY}:${tile.url}`;
}

function refreshMinimapSnapshotImages() {
    if (refreshMinimapRasterImage()) {
        minimapSnapshotImages = new Map();
        return;
    }

    const wantedKeys = new Set();

    for (const tile of minimapOverview.snapshotTiles || []) {
        const key = minimapSnapshotKey(tile);
        wantedKeys.add(key);
        if (minimapSnapshotImages.has(key)) continue;

        const image = new Image();
        const state = { image, loaded: false, error: false };
        image.decoding = 'async';
        image.onload = () => {
            state.loaded = true;
            requestMinimapRender();
        };
        image.onerror = () => {
            state.error = true;
            requestMinimapRender();
        };
        image.src = tile.url;
        minimapSnapshotImages.set(key, state);
    }

    for (const key of minimapSnapshotImages.keys()) {
        if (!wantedKeys.has(key)) minimapSnapshotImages.delete(key);
    }
}

async function loadMinimapOverview() {
    if (!minimapCanvas) return;

    try {
        const response = await fetch('/api/canvas-overview', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        minimapOverview = normalizeMinimapOverview(await response.json());
        refreshMinimapSnapshotImages();
    } catch (error) {
        console.error('No se pudo cargar el navegador del lienzo:', error);
        minimapOverview = normalizeMinimapOverview({ height: worldConfig.height, tileSize: worldConfig.tileSize, rows: [] });
        refreshMinimapSnapshotImages();
    }

    requestMinimapRender(true);
}

function getViewportWorldBounds() {
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(canvasSize.width, canvasSize.height);
    return {
        top: Math.max(0, Math.min(topLeft.y, bottomRight.y)),
        bottom: Math.max(0, Math.max(topLeft.y, bottomRight.y))
    };
}

function getMaxCachedTileY() {
    let maxTileY = -1;
    const maps = [tileSegments, tileSnapshots];

    for (const map of maps) {
        for (const key of map.keys()) {
            const { tileY } = parseTileKey(key);
            if (Number.isInteger(tileY)) maxTileY = Math.max(maxTileY, tileY);
        }
    }

    return maxTileY;
}

function getMinimapContentHeight() {
    const viewport = getViewportWorldBounds();
    const cachedTileY = getMaxCachedTileY();
    const cachedHeight = cachedTileY >= 0 ? (cachedTileY + 1) * worldConfig.tileSize : 0;

    return Math.max(
        worldConfig.height,
        minimapOverview.height || 0,
        cachedHeight,
        viewport.bottom + worldConfig.tileSize,
        DEFAULT_WORLD.height
    );
}

function getMinimapRows() {
    const rows = new Map();

    for (const row of minimapOverview.rows || []) {
        rows.set(row.tileY, {
            tileY: row.tileY,
            tileCount: row.tileCount,
            segmentCount: row.segmentCount,
            byteSize: row.byteSize,
            live: false
        });
    }

    for (const [key, segments] of tileSegments) {
        const { tileY } = parseTileKey(key);
        if (!Number.isInteger(tileY) || tileY < 0) continue;

        if (!rows.has(tileY)) {
            rows.set(tileY, { tileY, tileCount: 0, segmentCount: 0, byteSize: 0, live: true });
        }

        const row = rows.get(tileY);
        row.tileCount += 1;
        row.segmentCount += Array.isArray(segments) ? segments.length : 0;
        row.live = true;
    }

    return Array.from(rows.values()).sort((a, b) => a.tileY - b.tileY);
}

function formatMinimapPosition(value) {
    const y = Math.max(0, Math.round(value));
    if (y >= 1000000) return `${(y / 1000000).toFixed(1)}M px`;
    if (y >= 10000) return `${Math.round(y / 1000)}k px`;
    return `${y} px`;
}

function resizeMinimap() {
    if (!minimapCanvas || !minimapCtx) return;

    const target = minimapScroll || minimapCanvas;
    const rect = target.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, MAX_MINIMAP_DPR));
    const nextWidth = Math.round(rect.width * dpr);
    const nextHeight = Math.round(rect.height * dpr);

    if (minimapCanvas.width !== nextWidth || minimapCanvas.height !== nextHeight) {
        minimapCanvas.width = nextWidth;
        minimapCanvas.height = nextHeight;
    }

    minimapCanvas.style.width = `${Math.round(rect.width)}px`;
    minimapCanvas.style.height = `${Math.round(rect.height)}px`;
    requestMinimapRender(true);
}

function drawRoundedRect(targetCtx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    targetCtx.beginPath();
    targetCtx.moveTo(x + r, y);
    targetCtx.lineTo(x + width - r, y);
    targetCtx.quadraticCurveTo(x + width, y, x + width, y + r);
    targetCtx.lineTo(x + width, y + height - r);
    targetCtx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    targetCtx.lineTo(x + r, y + height);
    targetCtx.quadraticCurveTo(x, y + height, x, y + height - r);
    targetCtx.lineTo(x, y + r);
    targetCtx.quadraticCurveTo(x, y, x + r, y);
    targetCtx.closePath();
}

function drawMinimapDensityRows(mapX, mapY, mapWidth, visibleHeight, scaleY, rows) {
    const maxDensity = rows.reduce((max, row) => Math.max(max, row.segmentCount, row.byteSize / 48), 1);

    for (const row of rows) {
        const rowTop = mapY + row.tileY * worldConfig.tileSize * scaleY;
        const rowHeight = Math.max(1, worldConfig.tileSize * scaleY);
        if (rowTop > visibleHeight || rowTop + rowHeight < 0) continue;

        const strength = Math.min(1, Math.log1p(Math.max(row.segmentCount, row.byteSize / 48)) / Math.log1p(maxDensity));
        const alpha = 0.04 + strength * 0.13;
        minimapCtx.fillStyle = `rgba(15, 23, 42, ${alpha.toFixed(3)})`;
        minimapCtx.fillRect(mapX + 2, rowTop, mapWidth - 4, rowHeight);

        if (row.live) {
            minimapCtx.fillStyle = 'rgba(0, 255, 204, 0.42)';
            minimapCtx.fillRect(mapX + 1, rowTop, 2, rowHeight);
        }
    }
}

function drawMinimapRasterSnapshot(width, height, mapHeight) {
    if (!minimapRasterImage || !minimapRasterImage.loaded || minimapRasterImage.error) return false;

    const image = minimapRasterImage.image;
    const imageWidth = image.naturalWidth || image.width;
    const imageHeight = image.naturalHeight || image.height;
    if (!imageWidth || !imageHeight) return false;

    const scrollTop = minimapScroll ? minimapScroll.scrollTop : 0;
    const sourceY = Math.min(
        Math.max((scrollTop / mapHeight) * imageHeight, 0),
        Math.max(0, imageHeight - 1)
    );
    const sourceHeight = Math.min(
        Math.max((height / mapHeight) * imageHeight, 1),
        imageHeight - sourceY
    );

    minimapCtx.imageSmoothingEnabled = true;
    minimapCtx.imageSmoothingQuality = 'low';
    minimapCtx.drawImage(
        image,
        0,
        sourceY,
        imageWidth,
        sourceHeight,
        0,
        0,
        width,
        height
    );
    return true;
}

function drawMinimapSnapshotTiles(mapX, mapY, mapWidth, visibleHeight, scaleX, scaleY) {
    let drawnCount = 0;
    const tileSize = minimapOverview.tileSize || worldConfig.tileSize;
    const snapshotTiles = minimapOverview.snapshotTiles || [];

    minimapCtx.imageSmoothingEnabled = true;
    minimapCtx.imageSmoothingQuality = 'medium';

    for (const tile of snapshotTiles) {
        const state = minimapSnapshotImages.get(minimapSnapshotKey(tile));
        if (!state || !state.loaded || state.error) continue;

        const x = mapX + tile.tileX * tileSize * scaleX;
        const y = mapY + tile.tileY * tileSize * scaleY;
        const width = tile.width * scaleX;
        const height = tile.height * scaleY;

        if (x > mapX + mapWidth || x + width < mapX || y > visibleHeight || y + height < 0) continue;
        minimapCtx.drawImage(state.image, x, y, width, height);
        drawnCount += 1;
    }

    return drawnCount;
}

function syncMinimapScrollToViewport(scale, viewportHeight, mapHeight) {
    if (!minimapScroll || !Number.isFinite(scale) || scale <= 0) return;
    if (Date.now() - lastMinimapManualScrollAt < MINIMAP_AUTO_SCROLL_IDLE_MS) return;

    const viewport = getViewportWorldBounds();
    const viewTop = viewport.top * scale;
    const viewBottom = viewport.bottom * scale;
    const visibleTop = minimapScroll.scrollTop;
    const visibleBottom = visibleTop + viewportHeight;
    const margin = Math.min(48, viewportHeight * 0.18);

    if (viewTop >= visibleTop + margin && viewBottom <= visibleBottom - margin) return;

    const maxScroll = Math.max(0, mapHeight - viewportHeight);
    const nextScroll = Math.min(Math.max(viewTop - viewportHeight * 0.34, 0), maxScroll);
    if (Math.abs(nextScroll - minimapScroll.scrollTop) < 1) return;

    isMinimapAutoScrolling = true;
    minimapScroll.scrollTop = nextScroll;
    requestAnimationFrame(() => {
        isMinimapAutoScrolling = false;
    });
}

function requestMinimapRender(immediate = false) {
    if (!minimapCanvas || !minimapCtx || (minimap && minimap.classList.contains('collapsed'))) return;

    if (immediate) {
        if (minimapRenderTimer) {
            clearTimeout(minimapRenderTimer);
            minimapRenderTimer = null;
        }

        if (!minimapRenderQueued) {
            minimapRenderQueued = true;
            requestAnimationFrame(() => {
                minimapRenderQueued = false;
                renderMinimap();
            });
        }
        return;
    }

    const now = performance.now();
    const elapsed = now - lastMinimapRenderAt;
    if (elapsed >= MINIMAP_RENDER_INTERVAL_MS) {
        if (!minimapRenderQueued) {
            minimapRenderQueued = true;
            requestAnimationFrame(() => {
                minimapRenderQueued = false;
                renderMinimap();
            });
        }
        return;
    }

    if (!minimapRenderTimer) {
        minimapRenderTimer = setTimeout(() => {
            minimapRenderTimer = null;
            requestMinimapRender(true);
        }, MINIMAP_RENDER_INTERVAL_MS - elapsed);
    }
}

function renderMinimap() {
    if (!minimapCanvas || !minimapCtx || (minimap && minimap.classList.contains('collapsed'))) return;
    lastMinimapRenderAt = performance.now();

    const scrollTarget = minimapScroll || minimapCanvas;
    const rect = scrollTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || canvasSize.width <= 0 || canvasSize.height <= 0) return;

    const width = minimapScroll ? minimapScroll.clientWidth : rect.width;
    const height = minimapScroll ? minimapScroll.clientHeight : rect.height;
    if (width <= 0 || height <= 0) return;

    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, MAX_MINIMAP_DPR));
    if (minimapCanvas.width !== Math.round(width * dpr) || minimapCanvas.height !== Math.round(height * dpr)) {
        minimapCanvas.width = Math.round(width * dpr);
        minimapCanvas.height = Math.round(height * dpr);
    }

    minimapCanvas.style.width = `${Math.round(width)}px`;
    minimapCanvas.style.height = `${Math.round(height)}px`;

    const contentHeight = getMinimapContentHeight();
    const contentWidth = Math.max(worldConfig.width, minimapOverview.width || 0);
    const uniformScale = width / contentWidth;
    const mapWidth = width;
    const mapHeight = Math.max(height, contentHeight * uniformScale);
    if (minimapTrack) {
        minimapTrack.style.height = `${Math.max(0, mapHeight - height)}px`;
    }

    syncMinimapScrollToViewport(uniformScale, height, mapHeight);

    const scrollTop = minimapScroll ? minimapScroll.scrollTop : 0;
    const mapX = 0;
    const mapY = -scrollTop;
    const scaleX = uniformScale;
    const scaleY = uniformScale;
    const rows = getMinimapRows();

    minimapMetrics = {
        x: mapX,
        y: mapY,
        width: mapWidth,
        height: mapHeight,
        contentHeight,
        scale: uniformScale,
        scrollTop
    };

    minimapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    minimapCtx.clearRect(0, 0, width, height);
    minimapCtx.fillStyle = '#ffffff';
    minimapCtx.fillRect(0, 0, width, height);

    minimapCtx.save();
    drawRoundedRect(minimapCtx, 0, 0, width, height, 5);
    minimapCtx.clip();
    const didDrawRasterSnapshot = drawMinimapRasterSnapshot(width, height, mapHeight);
    if (!didDrawRasterSnapshot) {
        drawMinimapDensityRows(mapX, mapY, mapWidth, height, scaleY, rows);
        drawMinimapSnapshotTiles(mapX, mapY, mapWidth, height, scaleX, scaleY);
    }
    minimapCtx.restore();

    const configuredBottom = Math.min(worldConfig.height, contentHeight);
    if (configuredBottom > 0 && configuredBottom < contentHeight) {
        const markerY = mapY + configuredBottom * scaleY;
        minimapCtx.strokeStyle = 'rgba(15, 23, 42, 0.18)';
        minimapCtx.lineWidth = 1;
        minimapCtx.beginPath();
        minimapCtx.moveTo(mapX + 2, markerY);
        minimapCtx.lineTo(mapX + mapWidth - 2, markerY);
        minimapCtx.stroke();
    }

    const viewport = getViewportWorldBounds();
    const viewY = mapY + viewport.top * scaleY;
    const viewHeight = Math.max(14, (viewport.bottom - viewport.top) * scaleY);
    const clampedY = viewY;

    if (clampedY < height && clampedY + viewHeight > 0) {
        minimapCtx.fillStyle = 'rgba(0, 255, 204, 0.15)';
        minimapCtx.strokeStyle = '#00ffcc';
        minimapCtx.lineWidth = 2;
        drawRoundedRect(minimapCtx, mapX + 1, clampedY, mapWidth - 2, Math.min(viewHeight, mapHeight), 4);
        minimapCtx.fill();
        minimapCtx.stroke();
    }

    minimapCtx.strokeStyle = 'rgba(15, 23, 42, 0.22)';
    minimapCtx.lineWidth = 1;
    drawRoundedRect(minimapCtx, 0.5, 0.5, width - 1, height - 1, 5);
    minimapCtx.stroke();

    if (minimapPosition) minimapPosition.innerText = formatMinimapPosition(viewport.top);
}

function moveCameraFromMinimapEvent(event) {
    if (!minimapCanvas || !minimapMetrics) return;

    const rect = minimapCanvas.getBoundingClientRect();
    const pointerY = event.clientY - rect.top;
    const scale = minimapMetrics.scale || (minimapMetrics.height / minimapMetrics.contentHeight);
    const scrollTop = minimapScroll ? minimapScroll.scrollTop : (minimapMetrics.scrollTop || 0);
    const targetY = Math.min(
        Math.max((scrollTop + pointerY) / scale, 0),
        minimapMetrics.contentHeight
    );

    camera.y = targetY;
    clampCamera();
    requestRender();
    syncVisibleTiles();
}

function startMinimapNavigation(event) {
    if (!minimapCanvas) return;

    event.preventDefault();
    event.stopPropagation();
    isMinimapDragging = true;
    if (minimapCanvas.setPointerCapture && event.pointerId !== undefined) {
        minimapCanvas.setPointerCapture(event.pointerId);
    }

    if (!minimapMetrics) renderMinimap();
    moveCameraFromMinimapEvent(event);
}

function moveMinimapNavigation(event) {
    if (!isMinimapDragging) return;

    event.preventDefault();
    event.stopPropagation();
    moveCameraFromMinimapEvent(event);
}

function stopMinimapNavigation(event) {
    if (!isMinimapDragging) return;

    isMinimapDragging = false;
    if (event && minimapCanvas && minimapCanvas.releasePointerCapture && event.pointerId !== undefined) {
        try {
            minimapCanvas.releasePointerCapture(event.pointerId);
        } catch (error) {
            // Pointer capture may already be released by the browser.
        }
    }
}

function worldToScreen(x, y) {
    return {
        x: (x - camera.x) * camera.zoom + canvasSize.width / 2,
        y: (y - camera.y) * camera.zoom + canvasSize.height / 2
    };
}

function screenToWorld(x, y) {
    return {
        x: (x - canvasSize.width / 2) / camera.zoom + camera.x,
        y: (y - canvasSize.height / 2) / camera.zoom + camera.y
    };
}

function getPointerScreen(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
}

function trackCanvasPointer(event) {
    if (event.pointerId === undefined) return;
    activeCanvasPointers.set(event.pointerId, getPointerScreen(event));
}

function releaseCanvasPointer(event) {
    if (event && event.pointerId !== undefined) {
        activeCanvasPointers.delete(event.pointerId);
    }
}

function getPinchGesture() {
    const pointers = Array.from(activeCanvasPointers.values());
    if (pointers.length < 2) return null;

    const first = pointers[0];
    const second = pointers[1];
    const dx = second.x - first.x;
    const dy = second.y - first.y;
    const distance = Math.hypot(dx, dy);
    if (distance < MIN_PINCH_DISTANCE) return null;

    return {
        centerX: (first.x + second.x) / 2,
        centerY: (first.y + second.y) / 2,
        distance
    };
}

function isTouchMultiPointerGesture(event) {
    return event.pointerType === 'touch' && activeCanvasPointers.size >= 2;
}

function shouldUsePinchZoom(event) {
    return event.pointerType === 'touch' && (activeCanvasPointers.size >= 2 || isPanMode || !canEditCanvas());
}

function cancelActiveDrawingForGesture() {
    if (!activeUndoAction) return;

    const action = createUndoActionFromSets(activeUndoAction.orders, activeUndoAction.tiles, activeUndoAction.segments);
    activeUndoAction = null;

    if (!action || action.orders.length === 0) return;

    const orderSet = new Set(action.orders);
    outboundSegments = outboundSegments.filter(segment => !orderSet.has(getSegmentOrder(segment)));
    removeSegmentsFromCacheByOrders(action.orders);
    emitUndoAction(action);
    updateUndoButtons();
}

function startPinchGesture() {
    const gesture = getPinchGesture();
    if (!gesture) return false;

    cancelActiveDrawingForGesture();
    pinchState = {
        startDistance: gesture.distance,
        startZoom: camera.zoom,
        worldCenter: screenToWorld(gesture.centerX, gesture.centerY)
    };
    isDrawing = false;
    isPanning = false;
    panStart = null;
    return true;
}

function updatePinchGesture() {
    if (!pinchState) return false;

    const gesture = getPinchGesture();
    if (!gesture) return true;

    camera.zoom = clampZoom(pinchState.startZoom * (gesture.distance / pinchState.startDistance));
    camera.x = pinchState.worldCenter.x - (gesture.centerX - canvasSize.width / 2) / camera.zoom;
    camera.y = pinchState.worldCenter.y - (gesture.centerY - canvasSize.height / 2) / camera.zoom;
    clampCamera();
    requestRender();
    syncVisibleTiles();
    return true;
}

function resumePanFromRemainingPointer() {
    if (!(isPanMode || !canEditCanvas()) || activeCanvasPointers.size !== 1) return;

    const pointer = Array.from(activeCanvasPointers.values())[0];
    isPanning = true;
    panStart = {
        screenX: pointer.x,
        screenY: pointer.y,
        cameraX: camera.x,
        cameraY: camera.y
    };
}

function getPointerWorld(e) {
    const screen = getPointerScreen(e);
    return screenToWorld(screen.x, screen.y);
}

function clampZoom(zoom) {
    return Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM);
}

function clampCamera() {
    const halfWorldWidth = canvasSize.width > 0 ? canvasSize.width / (2 * camera.zoom) : 0;
    const halfWorldHeight = canvasSize.height > 0 ? canvasSize.height / (2 * camera.zoom) : 0;

    if (worldConfig.width <= halfWorldWidth * 2) {
        camera.x = worldConfig.width / 2;
    } else {
        camera.x = Math.min(Math.max(camera.x, halfWorldWidth), worldConfig.width - halfWorldWidth);
    }

    camera.y = Math.max(camera.y, halfWorldHeight);
}

function isInsideWorld(point) {
    return point.x >= 0 && point.x <= worldConfig.width && point.y >= 0;
}

function clampWorldPoint(point) {
    return {
        x: Math.min(Math.max(point.x, 0), worldConfig.width),
        y: Math.max(point.y, 0)
    };
}

function zoomAt(screenX, screenY, nextZoom) {
    const before = screenToWorld(screenX, screenY);
    camera.zoom = clampZoom(nextZoom);
    const after = screenToWorld(screenX, screenY);
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
    clampCamera();
    requestRender();
    syncVisibleTiles();
}

function zoomBy(factor) {
    zoomAt(canvasSize.width / 2, canvasSize.height / 2, camera.zoom * factor);
}

function tileKey(tileX, tileY) {
    return `${tileX}:${tileY}`;
}

function parseTileKey(key) {
    const [tileX, tileY] = key.split(':').map(Number);
    return { tileX, tileY };
}

function getTileRasterRevision(key) {
    return tileRasterRevision.get(key) || 0;
}

function invalidateTileRaster(key) {
    tileRasterRevision.set(key, getTileRasterRevision(key) + 1);
    tileRasterCache.delete(key);
}

function invalidateAllTileRasters() {
    tileRasterCache = new Map();
    tileRasterRevision = new Map();
}

function getTileWorldBounds(key) {
    const { tileX, tileY } = parseTileKey(key);
    const x = tileX * worldConfig.tileSize;
    const y = tileY * worldConfig.tileSize;
    const width = Math.max(1, Math.min(worldConfig.tileSize, worldConfig.width - x));
    const height = worldConfig.tileSize;
    return { tileX, tileY, x, y, width, height };
}

function createTileRasterCanvas(width, height) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);

    const rasterCanvas = document.createElement('canvas');
    rasterCanvas.width = width;
    rasterCanvas.height = height;
    return rasterCanvas;
}

function getMaxTileRasterCacheItems() {
    return window.matchMedia(MOBILE_MINIMAP_MEDIA_QUERY).matches
        ? TILE_RASTER_CACHE_MAX_MOBILE
        : TILE_RASTER_CACHE_MAX_DESKTOP;
}

function pruneTileRasterCache() {
    const maxItems = getMaxTileRasterCacheItems();
    if (tileRasterCache.size <= maxItems) return;

    const visibleKeys = new Set(visibleTiles);
    const removable = Array.from(tileRasterCache.entries())
        .filter(([key]) => !visibleKeys.has(key))
        .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    for (const [key] of removable) {
        if (tileRasterCache.size <= maxItems) return;
        tileRasterCache.delete(key);
    }

    if (tileRasterCache.size <= maxItems) return;

    const allEntries = Array.from(tileRasterCache.entries())
        .sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    for (const [key] of allEntries) {
        if (tileRasterCache.size <= maxItems) return;
        tileRasterCache.delete(key);
    }
}

function compareTileKeysTopFirst(a, b) {
    const tileA = parseTileKey(a);
    const tileB = parseTileKey(b);
    const rowDelta = tileA.tileY - tileB.tileY;
    if (rowDelta !== 0) return rowDelta;
    return tileA.tileX - tileB.tileX;
}

function releaseActiveTileLoadKeys() {
    for (const key of activeTileLoadKeys) {
        if (!loadedTiles.has(key)) loadingTiles.delete(key);
    }
    activeTileLoadKeys = new Set();
}

function cancelActiveTileLoad() {
    if (activeTileLoadAbort) activeTileLoadAbort.abort();
    activeTileLoadAbort = null;
    releaseActiveTileLoadKeys();
}

function buildTopFirstTileBatches(tileKeys) {
    const sortedKeys = Array.from(tileKeys).sort(compareTileKeysTopFirst);
    const batches = [];
    let currentBatch = [];
    let currentRows = new Set();

    for (const key of sortedKeys) {
        const { tileY } = parseTileKey(key);
        if (
            currentBatch.length > 0
            && !currentRows.has(tileY)
            && currentRows.size >= TILE_FETCH_ROWS_PER_BATCH
        ) {
            batches.push(currentBatch);
            currentBatch = [];
            currentRows = new Set();
        }

        currentBatch.push(key);
        currentRows.add(tileY);
    }

    if (currentBatch.length > 0) batches.push(currentBatch);
    return batches;
}

function applyFetchedTiles(tiles) {
    for (const tile of tiles || []) {
        const key = tileKey(tile.tileX, tile.tileY);
        invalidateTileRaster(key);
        if (tile.snapshot && tile.snapshot.url) {
            tileSnapshots.set(key, tile.snapshot);
            ensureTileSnapshotImage(key, tile.snapshot);
        } else {
            tileSnapshots.delete(key);
            tileSnapshotImages.delete(key);
        }

        const fetchedSegments = assignSegmentOrders(Array.isArray(tile.segments) ? tile.segments : []);
        addSegmentsToCache(fetchedSegments);
        loadedTiles.add(key);
        loadingTiles.delete(key);
        activeTileLoadKeys.delete(key);
    }
}

function ensureTileSnapshotImage(key, snapshot) {
    const existing = tileSnapshotImages.get(key);
    if (existing && existing.url === snapshot.url) return existing;

    const image = new Image();
    const state = { url: snapshot.url, image, loaded: false, error: false };
    image.decoding = 'async';
    image.onload = () => {
        state.loaded = true;
        invalidateTileRaster(key);
        requestRender();
    };
    image.onerror = () => {
        state.error = true;
        requestRender();
    };
    image.src = snapshot.url;
    tileSnapshotImages.set(key, state);
    return state;
}

function tileForPoint(x, y) {
    return {
        tileX: Math.min(Math.max(Math.floor(x / worldConfig.tileSize), 0), Math.ceil(worldConfig.width / worldConfig.tileSize) - 1),
        tileY: Math.max(Math.floor(y / worldConfig.tileSize), 0)
    };
}

function tileForSegment(segment) {
    if (segment.kind === 'rect') {
        return tileForPoint(segment.x + segment.width / 2, segment.y + segment.height / 2);
    }

    if (segment.kind === 'text') {
        return tileForPoint(Number(segment.x) + (Number(segment.width) || 0) / 2, Number(segment.y) + (Number(segment.height) || 0) / 2);
    }

    return tileForPoint((segment.x0 + segment.x1) / 2, (segment.y0 + segment.y1) / 2);
}

function segmentBoundsForTiles(segment) {
    if (!segment || typeof segment !== 'object') return null;

    if (segment.kind === 'rect') {
        const x = Number(segment.x);
        const y = Number(segment.y);
        const width = Number(segment.width);
        const height = Number(segment.height);
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
        return { left: x, top: y, right: x + width, bottom: y + height };
    }

    if (segment.kind === 'text') {
        const x = Number(segment.x);
        const y = Number(segment.y);
        if (![x, y].every(Number.isFinite)) return null;
        const size = clampTextSize(segment.size);
        const metrics = {
            width: Math.max(1, Number(segment.width) || measureTextSegment(segment.text, size).width),
            height: Math.max(1, Number(segment.height) || measureTextSegment(segment.text, size).height)
        };
        return { left: x, top: y, right: x + metrics.width, bottom: y + metrics.height };
    }

    const x0 = Number(segment.x0);
    const y0 = Number(segment.y0);
    const x1 = Number(segment.x1);
    const y1 = Number(segment.y1);
    const size = Math.max(1, Number(segment.size) || 1);
    if (![x0, y0, x1, y1].every(Number.isFinite)) return null;
    const radius = (segment.color === 'eraser' ? size * 2 : size) / 2 + 2;
    return {
        left: Math.min(x0, x1) - radius,
        top: Math.min(y0, y1) - radius,
        right: Math.max(x0, x1) + radius,
        bottom: Math.max(y0, y1) + radius
    };
}

function tileKeysForSegment(segment) {
    const bounds = segmentBoundsForTiles(segment);
    if (!bounds) {
        const tile = tileForSegment(segment);
        return [tileKey(tile.tileX, tile.tileY)];
    }

    const maxTileX = Math.ceil(worldConfig.width / worldConfig.tileSize) - 1;
    const minTileX = Math.min(Math.max(Math.floor(Math.max(bounds.left, 0) / worldConfig.tileSize), 0), maxTileX);
    const maxSegmentTileX = Math.min(Math.max(Math.floor(Math.max(bounds.right - 0.001, bounds.left) / worldConfig.tileSize), minTileX), maxTileX);
    const minTileY = Math.max(Math.floor(Math.max(bounds.top, 0) / worldConfig.tileSize), 0);
    const maxTileY = Math.max(Math.floor(Math.max(bounds.bottom - 0.001, bounds.top) / worldConfig.tileSize), minTileY);
    const keys = [];

    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
        for (let tileX = minTileX; tileX <= maxSegmentTileX; tileX += 1) {
            keys.push(tileKey(tileX, tileY));
            if (keys.length >= TILE_LOAD_LIMIT) return keys;
        }
    }

    return keys.length > 0 ? keys : [tileKey(minTileX, minTileY)];
}

function numberIdentity(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(3) : '0';
}

function getSegmentIdentity(segment) {
    if (segment && typeof segment === 'object' && segment._identity) return segment._identity;

    const order = getSegmentOrder(segment);
    let identity;
    if (segment.kind === 'rect') {
        identity = [
            order,
            'rect',
            numberIdentity(segment.x),
            numberIdentity(segment.y),
            numberIdentity(segment.width),
            numberIdentity(segment.height),
            segment.color || ''
        ].join('|');
    } else if (segment.kind === 'text') {
        identity = [
            order,
            'text',
            numberIdentity(segment.x),
            numberIdentity(segment.y),
            numberIdentity(segment.size),
            numberIdentity(segment.width),
            numberIdentity(segment.height),
            segment.color || '',
            normalizeTextValue(segment.text)
        ].join('|');
    } else {
        identity = [
            order,
            'line',
            numberIdentity(segment.x0),
            numberIdentity(segment.y0),
            numberIdentity(segment.x1),
            numberIdentity(segment.y1),
            numberIdentity(segment.size),
            numberIdentity(segment.opacity),
            segment.color || ''
        ].join('|');
    }

    if (segment && typeof segment === 'object' && !Object.prototype.hasOwnProperty.call(segment, '_identity')) {
        Object.defineProperty(segment, '_identity', {
            value: identity,
            enumerable: false
        });
    }

    return identity;
}

function getTileSegmentIdentitySet(key) {
    let identitySet = tileSegmentIdentitySets.get(key);
    if (identitySet) return identitySet;

    identitySet = new Set((tileSegments.get(key) || []).map(getSegmentIdentity));
    tileSegmentIdentitySets.set(key, identitySet);
    return identitySet;
}

function rebuildTileSegmentIdentitySet(key) {
    tileSegmentIdentitySets.set(key, new Set((tileSegments.get(key) || []).map(getSegmentIdentity)));
}

function dedupeSegmentsByIdentity(segments) {
    const seen = new Set();
    const deduped = [];
    for (const segment of segments || []) {
        const identity = getSegmentIdentity(segment);
        if (seen.has(identity)) continue;
        seen.add(identity);
        deduped.push(segment);
    }
    return deduped;
}

function nextSegmentOrder() {
    clientSegmentOrder = Math.max(clientSegmentOrder + 1, Date.now() * 1000);
    return clientSegmentOrder;
}

function assignSegmentOrders(segments) {
    for (const segment of segments) {
        if (!Number.isFinite(Number(segment.order))) {
            segment.order = nextSegmentOrder();
        } else {
            const order = Number(segment.order);
            clientSegmentOrder = Math.max(clientSegmentOrder, order);
            segment.order = order;
        }
    }

    return segments;
}

function prepareSegmentForCache(segment) {
    if (!Number.isFinite(Number(segment.order))) segment.order = nextSegmentOrder();
    if (!Object.prototype.hasOwnProperty.call(segment, '_cacheId')) {
        Object.defineProperty(segment, '_cacheId', {
            value: ++segmentCacheId,
            enumerable: false
        });
    }
    return segment;
}

function markRenderSegmentsDirty() {
    renderSegmentsDirty = true;
}

function updateUndoButtons() {
    const canEdit = canEditCanvas();
    const undoDisabled = !canEdit || undoStack.length === 0 || isUndoing || isCommittingImage || isFilling;
    const redoDisabled = !canEdit || redoStack.length === 0 || isUndoing || isCommittingImage || isFilling;
    if (undoBtn) undoBtn.disabled = undoDisabled;
    if (undoFloatingBtn) undoFloatingBtn.disabled = undoDisabled;
    if (redoBtn) redoBtn.disabled = redoDisabled;
    if (redoFloatingBtn) redoFloatingBtn.disabled = redoDisabled;
}

function getSegmentOrder(segment) {
    return Number.isFinite(Number(segment.order)) ? Number(segment.order) : 0;
}

function getSegmentTileKey(segment) {
    const keys = tileKeysForSegment(segment);
    return keys[0];
}

function getSegmentTileKeys(segment) {
    return tileKeysForSegment(segment);
}

function cloneSegmentForHistory(segment) {
    const order = getSegmentOrder(segment);
    const color = String(segment.color || '');
    if (!Number.isFinite(order) || order <= 0 || !color) return null;

    if (segment.kind === 'rect') {
        const x = Number(segment.x);
        const y = Number(segment.y);
        const width = Number(segment.width);
        const height = Number(segment.height);
        if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return null;
        return { kind: 'rect', x, y, width, height, color, order };
    }

    if (segment.kind === 'text') {
        const x = Number(segment.x);
        const y = Number(segment.y);
        const size = clampTextSize(segment.size);
        const text = normalizeTextValue(segment.text);
        const width = Number(segment.width);
        const height = Number(segment.height);
        if (![x, y, size].every(Number.isFinite) || !text) return null;
        const metrics = measureTextSegment(text, size);
        return {
            kind: 'text',
            x,
            y,
            text,
            color,
            size,
            fontFamily: segment.fontFamily || TEXT_DEFAULT_FONT,
            width: Number.isFinite(width) && width > 0 ? width : metrics.width,
            height: Number.isFinite(height) && height > 0 ? height : metrics.height,
            order
        };
    }

    const x0 = Number(segment.x0);
    const y0 = Number(segment.y0);
    const x1 = Number(segment.x1);
    const y1 = Number(segment.y1);
    const size = Number(segment.size);
    if (![x0, y0, x1, y1, size].every(Number.isFinite) || size <= 0) return null;
    const opacity = Number(segment.opacity);
    const historySegment = { kind: 'line', x0, y0, x1, y1, color, size, order };
    if (Number.isFinite(opacity) && opacity >= 0.05 && opacity <= 1 && color !== 'eraser') {
        historySegment.opacity = opacity;
    }
    return historySegment;
}

function createUndoActionFromSets(orderSet, tileKeySet, actionSegments = []) {
    const orders = Array.from(orderSet)
        .map(Number)
        .filter(order => Number.isFinite(order) && order > 0)
        .sort((a, b) => a - b);
    const tiles = Array.from(tileKeySet).filter(Boolean).sort(compareTileKeysTopFirst);
    const segments = actionSegments
        .map(cloneSegmentForHistory)
        .filter(Boolean)
        .sort((a, b) => getSegmentOrder(a) - getSegmentOrder(b));
    if (orders.length === 0) return null;
    return {
        id: `${Date.now()}:${orders[0]}:${orders.length}`,
        orders,
        tiles,
        segments
    };
}

function pushUndoAction(action, options = {}) {
    if (!action || action.orders.length === 0) return;
    const shouldClearRedo = options.clearRedo !== false;
    if (shouldClearRedo) redoStack = [];
    undoStack.push(action);
    if (undoStack.length > MAX_UNDO_ACTIONS) {
        undoStack = undoStack.slice(undoStack.length - MAX_UNDO_ACTIONS);
    }
    updateUndoButtons();
}

function pushUndoActionFromSegments(segments) {
    const orderSet = new Set();
    const tileKeySet = new Set();
    const actionSegments = [];

    for (const segment of segments || []) {
        const historySegment = cloneSegmentForHistory(segment);
        if (!historySegment) continue;
        const order = getSegmentOrder(segment);
        if (order > 0) orderSet.add(order);
        for (const key of getSegmentTileKeys(segment)) tileKeySet.add(key);
        actionSegments.push(historySegment);
    }

    pushUndoAction(createUndoActionFromSets(orderSet, tileKeySet, actionSegments));
}

function beginUndoAction() {
    activeUndoAction = {
        orders: new Set(),
        tiles: new Set(),
        segments: []
    };
}

function trackUndoSegment(segment) {
    if (!activeUndoAction) return;
    const historySegment = cloneSegmentForHistory(segment);
    if (!historySegment) return;
    const order = getSegmentOrder(segment);
    if (order > 0) activeUndoAction.orders.add(order);
    for (const key of getSegmentTileKeys(segment)) activeUndoAction.tiles.add(key);
    activeUndoAction.segments.push(historySegment);
}

function finishUndoAction() {
    if (!activeUndoAction) return;
    const action = createUndoActionFromSets(activeUndoAction.orders, activeUndoAction.tiles, activeUndoAction.segments);
    activeUndoAction = null;
    pushUndoAction(action);
}

function cancelUndoAction() {
    activeUndoAction = null;
}

function normalizeUndoOrders(rawOrders) {
    if (!Array.isArray(rawOrders)) return [];
    const seen = new Set();
    const orders = [];

    for (const rawOrder of rawOrders) {
        const order = Number(rawOrder);
        if (!Number.isFinite(order) || order <= 0 || seen.has(order)) continue;
        seen.add(order);
        orders.push(order);
    }

    return orders;
}

function removeSegmentsFromAdminCacheByOrders(rawOrders) {
    const orders = normalizeUndoOrders(rawOrders);
    if (orders.length === 0) return 0;

    const orderSet = new Set(orders);
    let removedCount = 0;

    for (const [key, segments] of adminTileSegments) {
        const nextSegments = segments.filter(segment => {
            const shouldRemove = orderSet.has(getSegmentOrder(segment));
            if (shouldRemove) removedCount += 1;
            return !shouldRemove;
        });

        if (nextSegments.length === 0) {
            adminTileSegments.set(key, []);
        } else if (nextSegments.length !== segments.length) {
            adminTileSegments.set(key, nextSegments);
        }
    }

    if (removedCount > 0) requestRender();
    return removedCount;
}

function removeSegmentsFromCacheByOrders(rawOrders) {
    const orders = normalizeUndoOrders(rawOrders);
    if (orders.length === 0) return 0;

    const orderSet = new Set(orders);
    let removedCount = 0;

    for (const [key, segments] of tileSegments) {
        const nextSegments = segments.filter(segment => {
            const shouldRemove = orderSet.has(getSegmentOrder(segment));
            if (shouldRemove) removedCount += 1;
            return !shouldRemove;
        });

        if (nextSegments.length === 0) {
            tileSegments.delete(key);
            tileSegmentIdentitySets.delete(key);
            invalidateTileRaster(key);
        } else if (nextSegments.length !== segments.length) {
            tileSegments.set(key, nextSegments);
            rebuildTileSegmentIdentitySet(key);
            invalidateTileRaster(key);
        }
    }

    if (removedCount > 0) {
        markRenderSegmentsDirty();
        removeSegmentsFromAdminCacheByOrders(orders);
        requestRender();
    }

    return removedCount;
}

function pruneUndoStackByOrders(rawOrders) {
    const orderSet = new Set(normalizeUndoOrders(rawOrders));
    if (orderSet.size === 0) return;

    undoStack = undoStack
        .map(action => ({
            ...action,
            orders: action.orders.filter(order => !orderSet.has(order))
        }))
        .filter(action => action.orders.length > 0);
    redoStack = redoStack
        .map(action => ({
            ...action,
            orders: action.orders.filter(order => !orderSet.has(order)),
            segments: action.segments.filter(segment => !orderSet.has(getSegmentOrder(segment)))
        }))
        .filter(action => action.orders.length > 0 && action.segments.length > 0);
    updateUndoButtons();
}

function emitUndoAction(action) {
    if (!socket.connected || !action || action.orders.length === 0) return;

    for (let index = 0; index < action.orders.length; index += UNDO_SEND_CHUNK_SIZE) {
        socket.emit('undo-segments', {
            actionId: action.id,
            orders: action.orders.slice(index, index + UNDO_SEND_CHUNK_SIZE),
            tiles: action.tiles
        });
    }
}

function undoLastAction() {
    if (!canEditCanvas()) return;

    if (pendingImagePlacement) {
        cancelPendingImagePlacement();
        return;
    }

    if (isUndoing || isCommittingImage || isFilling || undoStack.length === 0) return;

    flushOutboundSegments();
    const action = undoStack.pop();
    isUndoing = true;
    updateUndoButtons();

    removeSegmentsFromCacheByOrders(action.orders);
    emitUndoAction(action);
    if (action.segments && action.segments.length > 0) {
        redoStack.push(action);
        if (redoStack.length > MAX_UNDO_ACTIONS) {
            redoStack = redoStack.slice(redoStack.length - MAX_UNDO_ACTIONS);
        }
    }

    isUndoing = false;
    updateUndoButtons();
}

async function redoLastAction() {
    if (!canEditCanvas()) return;
    if (pendingImagePlacement || isUndoing || isCommittingImage || isFilling || redoStack.length === 0) return;
    if (!socket.connected) return;

    flushOutboundSegments();
    const action = redoStack.pop();
    const segments = (action.segments || [])
        .map(cloneSegmentForHistory)
        .filter(Boolean);

    if (segments.length === 0) {
        updateUndoButtons();
        return;
    }

    isUndoing = true;
    updateUndoButtons();

    try {
        tagSegmentsWithCurrentUser(segments);
        addSegmentsToCache(segments);
        requestRender();
        await sendSegmentsInChunks(segments);
        pushUndoAction({
            ...action,
            segments
        }, { clearRedo: false });
    } finally {
        isUndoing = false;
        updateUndoButtons();
    }
}

function getRenderSegments() {
    if (!renderSegmentsDirty) return renderSegments;

    const nextRenderSegments = [];
    for (const key of visibleTiles) {
        const segments = tileSegments.get(key);
        if (segments) nextRenderSegments.push(...segments);
    }

    const dedupedSegments = dedupeSegmentsByIdentity(nextRenderSegments);
    dedupedSegments.sort((a, b) => {
        const orderDelta = getSegmentOrder(a) - getSegmentOrder(b);
        if (orderDelta !== 0) return orderDelta;
        return (a._cacheId || 0) - (b._cacheId || 0);
    });

    renderSegments = dedupedSegments;
    renderSegmentsDirty = false;
    return renderSegments;
}

function getVisibleTileKeys() {
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(canvasSize.width, canvasSize.height);
    const maxAllowedTileX = Math.ceil(worldConfig.width / worldConfig.tileSize) - 1;
    const minTileX = Math.max(Math.floor(Math.min(topLeft.x, bottomRight.x) / worldConfig.tileSize) - TILE_PADDING, 0);
    const maxTileX = Math.min(Math.floor(Math.max(topLeft.x, bottomRight.x) / worldConfig.tileSize) + TILE_PADDING, maxAllowedTileX);
    const minTileY = Math.max(Math.floor(Math.min(topLeft.y, bottomRight.y) / worldConfig.tileSize) - TILE_PADDING, 0);
    const maxTileY = Math.floor(Math.max(topLeft.y, bottomRight.y) / worldConfig.tileSize) + TILE_PADDING;
    const keys = [];

    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
        for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
            keys.push(tileKey(tileX, tileY));
            if (keys.length >= TILE_LOAD_LIMIT) return keys;
        }
    }

    return keys;
}

function syncVisibleTiles() {
    if (tileSyncTimer) clearTimeout(tileSyncTimer);
    tileSyncTimer = setTimeout(() => {
        const nextTileKeys = getVisibleTileKeys();
        const tilesChanged = nextTileKeys.length !== visibleTiles.size
            || nextTileKeys.some(key => !visibleTiles.has(key));
        const nextVisibleTiles = new Set(nextTileKeys);

        if (tilesChanged) {
            visibleTiles = nextVisibleTiles;
            markRenderSegmentsDirty();
        }

        if (socket.connected) {
            socket.emit('viewport-tiles', { tiles: nextTileKeys });
        }

        loadMissingTiles(nextVisibleTiles);
        syncAdminVisibleTiles(false);
        updateHud();
    }, 80);
}

async function loadMissingTiles(tileKeys) {
    const missingTiles = Array.from(tileKeys)
        .filter(key => !loadedTiles.has(key) && !loadingTiles.has(key))
        .sort(compareTileKeysTopFirst);

    if (missingTiles.length === 0) return;

    cancelActiveTileLoad();

    const generation = tileLoadGeneration + 1;
    tileLoadGeneration = generation;
    const abortController = new AbortController();
    activeTileLoadAbort = abortController;
    activeTileLoadKeys = new Set(missingTiles);

    for (const key of missingTiles) loadingTiles.add(key);

    try {
        const batches = buildTopFirstTileBatches(missingTiles);
        const pendingResults = new Map();
        let nextFetchIndex = 0;
        let nextApplyIndex = 0;

        function applyReadyBatches() {
            let applied = false;
            while (pendingResults.has(nextApplyIndex)) {
                applyFetchedTiles(pendingResults.get(nextApplyIndex));
                pendingResults.delete(nextApplyIndex);
                nextApplyIndex += 1;
                applied = true;
            }

            if (applied) {
                markRenderSegmentsDirty();
                requestRender();
                updateHud();
            }
        }

        async function fetchWorker() {
            while (nextFetchIndex < batches.length && generation === tileLoadGeneration) {
                const batchIndex = nextFetchIndex;
                nextFetchIndex += 1;
                const batch = batches[batchIndex];

                const response = await fetch(`/api/tiles?tiles=${encodeURIComponent(batch.join(','))}`, {
                    cache: 'no-store',
                    signal: abortController.signal
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const payload = await response.json();
                if (generation !== tileLoadGeneration) return;

                pendingResults.set(batchIndex, payload.tiles || []);
                applyReadyBatches();
            }
        }

        const workerCount = Math.min(TILE_FETCH_CONCURRENCY, batches.length);
        await Promise.all(Array.from({ length: workerCount }, fetchWorker));
        applyReadyBatches();
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('No se pudieron cargar tiles:', error);
        }
    } finally {
        if (activeTileLoadAbort === abortController) {
            activeTileLoadAbort = null;
            releaseActiveTileLoadKeys();
        }
    }

    requestRender();
    updateHud();
}

function isAdminHighlightActive() {
    return Boolean(isCurrentUserAdmin && selectedAdminUserEmail);
}

function cancelActiveAdminTileLoad() {
    if (activeAdminTileLoadAbort) activeAdminTileLoadAbort.abort();
    activeAdminTileLoadAbort = null;

    for (const key of adminTileLoadKeys) {
        if (!adminLoadedTiles.has(key)) adminLoadingTiles.delete(key);
    }
    adminTileLoadKeys = new Set();
}

function applyAdminFetchedTiles(tiles) {
    for (const tile of tiles || []) {
        const key = tileKey(tile.tileX, tile.tileY);
        const fetchedSegments = assignSegmentOrders(Array.isArray(tile.segments) ? tile.segments : []);
        fetchedSegments.forEach(prepareSegmentForCache);
        adminTileSegments.set(key, fetchedSegments);
        adminLoadedTiles.add(key);
        adminLoadingTiles.delete(key);
        adminTileLoadKeys.delete(key);
    }
}

function syncAdminVisibleTiles(force = false) {
    if (!isAdminHighlightActive()) return;

    const nextTileKeys = Array.from(visibleTiles).sort(compareTileKeysTopFirst);
    if (nextTileKeys.length === 0) return;

    const missingTiles = nextTileKeys
        .filter(key => force || (!adminLoadedTiles.has(key) && !adminLoadingTiles.has(key)))
        .sort(compareTileKeysTopFirst);

    if (missingTiles.length === 0) {
        requestRender();
        return;
    }

    loadMissingAdminTiles(missingTiles);
}

async function loadMissingAdminTiles(missingTiles) {
    if (!isAdminHighlightActive() || missingTiles.length === 0) return;

    cancelActiveAdminTileLoad();

    const generation = adminTileLoadGeneration + 1;
    adminTileLoadGeneration = generation;
    const abortController = new AbortController();
    activeAdminTileLoadAbort = abortController;
    adminTileLoadKeys = new Set(missingTiles);

    for (const key of missingTiles) adminLoadingTiles.add(key);

    try {
        const batches = buildTopFirstTileBatches(missingTiles);
        const pendingResults = new Map();
        let nextFetchIndex = 0;
        let nextApplyIndex = 0;

        function applyReadyBatches() {
            let applied = false;
            while (pendingResults.has(nextApplyIndex)) {
                applyAdminFetchedTiles(pendingResults.get(nextApplyIndex));
                pendingResults.delete(nextApplyIndex);
                nextApplyIndex += 1;
                applied = true;
            }

            if (applied) requestRender();
        }

        async function fetchWorker() {
            while (nextFetchIndex < batches.length && generation === adminTileLoadGeneration) {
                const batchIndex = nextFetchIndex;
                nextFetchIndex += 1;
                const batch = batches[batchIndex];
                const payload = await fetchAdminJson(`/api/admin/tiles?tiles=${encodeURIComponent(batch.join(','))}`, {
                    signal: abortController.signal
                });
                if (generation !== adminTileLoadGeneration) return;

                pendingResults.set(batchIndex, payload.tiles || []);
                applyReadyBatches();
            }
        }

        const workerCount = Math.min(ADMIN_TILE_FETCH_CONCURRENCY, batches.length);
        await Promise.all(Array.from({ length: workerCount }, fetchWorker));
        applyReadyBatches();
        setAdminStatus(`Resaltando aportes de ${selectedAdminUserEmail}.`);
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('No se pudieron cargar tiles admin:', error);
            setAdminStatus('No se pudieron cargar aportes visibles.');
        }
    } finally {
        if (activeAdminTileLoadAbort === abortController) {
            activeAdminTileLoadAbort = null;
            cancelActiveAdminTileLoad();
        }
    }

    requestRender();
}

function addSegmentsToCache(segments) {
    for (const segment of assignSegmentOrders(segments)) {
        prepareSegmentForCache(segment);
        const order = getSegmentOrder(segment);
        const identity = getSegmentIdentity(segment);
        for (const key of tileKeysForSegment(segment)) {
            const snapshot = tileSnapshots.get(key);
            const snapshotOrder = Number(snapshot && snapshot.upToOrder) || 0;
            if (order > 0 && snapshotOrder >= order) continue;

            if (!tileSegments.has(key)) tileSegments.set(key, []);
            const segmentsForTile = tileSegments.get(key);
            const identitySet = getTileSegmentIdentitySet(key);
            if (identitySet.has(identity)) continue;

            segmentsForTile.push(segment);
            identitySet.add(identity);
            if (appendSegmentToTileRasterCache(key, segment)) continue;
            invalidateTileRaster(key);
        }
    }
    markRenderSegmentsDirty();
}

function queueOutboundSegment(segment) {
    if (!socket.connected || !canEditCanvas()) return;

    outboundSegments.push(segment);
    if (outboundSegments.length >= OUTBOUND_MAX_BATCH) {
        flushOutboundSegments();
        return;
    }

    if (!outboundFlushTimer) outboundFlushTimer = setTimeout(flushOutboundSegments, OUTBOUND_FLUSH_MS);
}

function flushOutboundSegments() {
    if (outboundFlushTimer) {
        clearTimeout(outboundFlushTimer);
        outboundFlushTimer = null;
    }

    if (outboundSegments.length === 0) return;

    const segments = outboundSegments;
    outboundSegments = [];
    if (socket.connected && canEditCanvas()) socket.emit('draw-batch', segments);
}

function setImageStatus(message) {
    if (imageStatus) imageStatus.innerText = message;
}

function isSupportedImage(file) {
    if (!file) return false;
    const mimeType = String(file.type || '').toLowerCase();
    if (SUPPORTED_IMAGE_TYPES.has(mimeType)) return true;

    const extension = String(file.name || '').split('.').pop().toLowerCase();
    return SUPPORTED_IMAGE_EXTENSIONS.has(extension);
}

function loadImageElementFromFile(file) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);
        image.decoding = 'async';
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('image_load_failed'));
        };
        image.src = objectUrl;
    });
}

async function loadDrawableImage(file) {
    if ('createImageBitmap' in window) {
        try {
            return await createImageBitmap(file, {
                premultiplyAlpha: 'default',
                colorSpaceConversion: 'default'
            });
        } catch (error) {
            console.warn('createImageBitmap fallo; usando carga por elemento img:', error);
        }
    }

    return loadImageElementFromFile(file);
}

function getDrawableImageSize(image) {
    return {
        width: image.width || image.naturalWidth || 1,
        height: image.height || image.naturalHeight || 1
    };
}

function clampImageScalePercent(value) {
    const scalePercent = Number(value);
    if (!Number.isFinite(scalePercent)) return 100;
    return Math.min(Math.max(Math.round(scalePercent), IMAGE_MIN_SCALE_PERCENT), IMAGE_MAX_SCALE_PERCENT);
}

function getBaseImagePlacement(image, centerPoint = { x: camera.x, y: camera.y }) {
    const source = getDrawableImageSize(image);
    const maxWidth = Math.min(worldConfig.width * 0.86, IMAGE_MAX_WIDTH);
    const scale = Math.min(maxWidth / source.width, IMAGE_MAX_HEIGHT / source.height, 1);
    return {
        center: { x: centerPoint.x, y: centerPoint.y },
        baseWidth: Math.max(IMAGE_CELL_SIZE, Math.round(source.width * scale)),
        baseHeight: Math.max(IMAGE_CELL_SIZE, Math.round(source.height * scale)),
        scalePercent: 100
    };
}

function getImagePlacementFromState(state) {
    const scale = clampImageScalePercent(state.scalePercent) / 100;
    const width = Math.max(IMAGE_CELL_SIZE, Math.round(state.baseWidth * scale));
    const height = Math.max(IMAGE_CELL_SIZE, Math.round(state.baseHeight * scale));
    const centerPoint = state.center || { x: camera.x, y: camera.y };
    const x = Math.round(Math.min(Math.max(centerPoint.x - width / 2, 0), Math.max(worldConfig.width - width, 0)));
    const y = Math.round(Math.max(centerPoint.y - height / 2, 0));

    return { width, height, x, y };
}

function updatePendingImagePlacement(point) {
    if (!pendingImagePlacement || isCommittingImage) return;
    pendingImagePlacement.center = { x: point.x, y: point.y };
    pendingImagePlacement.placement = getImagePlacementFromState(pendingImagePlacement);
    requestRender();
}

function updateImageSizeControls() {
    const hasPendingImage = Boolean(pendingImagePlacement && !isCommittingImage);
    if (imageSizeControls) imageSizeControls.hidden = !hasPendingImage;
    if (!hasPendingImage) return;

    const scalePercent = clampImageScalePercent(pendingImagePlacement.scalePercent);
    if (imageSizeSlider) imageSizeSlider.value = String(scalePercent);
    if (imageSizeValue) imageSizeValue.innerText = String(scalePercent);
}

function setPendingImageScale(scalePercent) {
    if (!pendingImagePlacement || isCommittingImage) return;
    pendingImagePlacement.scalePercent = clampImageScalePercent(scalePercent);
    pendingImagePlacement.placement = getImagePlacementFromState(pendingImagePlacement);
    updateImageSizeControls();
    requestRender();
}

function closeImageResource(image) {
    if (image && typeof image.close === 'function') image.close();
}

function cancelPendingImagePlacement(message = 'Imagen cancelada.') {
    if (!pendingImagePlacement) return;
    closeImageResource(pendingImagePlacement.image);
    pendingImagePlacement = null;
    isCommittingImage = false;
    imageUploadBtn.disabled = false;
    setImageStatus(message);
    updateImageSizeControls();
    requestRender();
}

function rgbToHex(r, g, b) {
    return `#${[r, g, b].map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')).join('')}`;
}

function colorDistance(a, b) {
    const r = a.r - b.r;
    const g = a.g - b.g;
    const blue = a.b - b.b;
    return r * r + g * g + blue * blue;
}

function getNearestPaletteIndex(pixel, palette) {
    let bestIndex = 0;
    let bestDistance = Infinity;

    for (let index = 0; index < palette.length; index += 1) {
        const distance = colorDistance(pixel, palette[index]);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    }

    return bestIndex;
}

function getPaletteSamples(samples) {
    if (samples.length <= IMAGE_PALETTE_SAMPLE_LIMIT) return samples;

    const selected = [];
    const step = samples.length / IMAGE_PALETTE_SAMPLE_LIMIT;
    for (let index = 0; index < IMAGE_PALETTE_SAMPLE_LIMIT; index += 1) {
        selected.push(samples[Math.floor(index * step)]);
    }
    return selected;
}

function buildImagePalette(samples) {
    const paletteSamples = getPaletteSamples(samples);
    const unique = new Map();
    for (const sample of paletteSamples) {
        const key = `${sample.r},${sample.g},${sample.b}`;
        if (!unique.has(key)) unique.set(key, sample);
        if (unique.size >= IMAGE_COLOR_COUNT * 6) break;
    }

    const seedPixels = unique.size > 0 ? Array.from(unique.values()) : paletteSamples;
    const paletteSize = Math.min(IMAGE_COLOR_COUNT, seedPixels.length);
    if (paletteSize === 0) return [];

    let palette = [];
    const step = Math.max(1, Math.floor(seedPixels.length / paletteSize));
    for (let index = 0; index < paletteSize; index += 1) {
        const seed = seedPixels[Math.min(index * step, seedPixels.length - 1)];
        palette.push({ r: seed.r, g: seed.g, b: seed.b });
    }

    for (let iteration = 0; iteration < IMAGE_KMEANS_ITERATIONS; iteration += 1) {
        const buckets = palette.map(() => ({ r: 0, g: 0, b: 0, count: 0 }));

        for (const sample of paletteSamples) {
            const paletteIndex = getNearestPaletteIndex(sample, palette);
            const bucket = buckets[paletteIndex];
            bucket.r += sample.r;
            bucket.g += sample.g;
            bucket.b += sample.b;
            bucket.count += 1;
        }

        palette = palette.map((color, index) => {
            const bucket = buckets[index];
            if (bucket.count === 0) return color;
            return {
                r: bucket.r / bucket.count,
                g: bucket.g / bucket.count,
                b: bucket.b / bucket.count
            };
        });
    }

    return palette;
}

function finalizeImageRect(rect, placement, segments) {
    const localX = rect.xCells * IMAGE_CELL_SIZE;
    const localY = rect.yCells * IMAGE_CELL_SIZE;
    const width = Math.min(rect.widthCells * IMAGE_CELL_SIZE, placement.width - localX);
    const height = Math.min(rect.heightCells * IMAGE_CELL_SIZE, placement.height - localY);

    if (width <= 0 || height <= 0) return;

    segments.push({
        kind: 'rect',
        x: placement.x + localX,
        y: placement.y + localY,
        width,
        height,
        color: rect.color,
        order: nextSegmentOrder()
    });
}

function buildVectorRects(cellColors, cols, rows, placement) {
    const segments = [];
    let active = new Map();

    for (let row = 0; row < rows; row += 1) {
        const nextActive = new Map();
        let col = 0;

        while (col < cols) {
            const color = cellColors[row * cols + col];
            if (!color) {
                col += 1;
                continue;
            }

            const startCol = col;
            while (col < cols && cellColors[row * cols + col] === color) col += 1;

            const widthCells = col - startCol;
            const key = `${startCol}:${widthCells}:${color}`;
            const current = active.get(key) || {
                xCells: startCol,
                yCells: row,
                widthCells,
                heightCells: 0,
                color
            };
            current.heightCells += 1;
            nextActive.set(key, current);
        }

        for (const [key, rect] of active) {
            if (!nextActive.has(key)) finalizeImageRect(rect, placement, segments);
        }

        active = nextActive;
    }

    for (const rect of active.values()) finalizeImageRect(rect, placement, segments);
    return segments;
}

function splitRectSegmentForTiles(segment) {
    if (segment.kind !== 'rect') return [segment];

    const result = [];
    const maxX = Math.min(segment.x + segment.width, worldConfig.width);
    const maxY = segment.y + segment.height;
    let y = segment.y;

    while (y < maxY) {
        const nextY = Math.min(maxY, (Math.floor(y / worldConfig.tileSize) + 1) * worldConfig.tileSize);
        let x = segment.x;

        while (x < maxX) {
            const nextX = Math.min(maxX, (Math.floor(x / worldConfig.tileSize) + 1) * worldConfig.tileSize);
            const width = nextX - x;
            const height = nextY - y;

            if (width > 0 && height > 0) {
                result.push({
                    kind: 'rect',
                    x,
                    y,
                    width,
                    height,
                    color: segment.color,
                    order: Number.isFinite(Number(segment.order)) ? Number(segment.order) : nextSegmentOrder()
                });
            }

            x = nextX;
        }

        y = nextY;
    }

    return result;
}

function splitSegmentsForTiles(segments) {
    return segments.flatMap(splitRectSegmentForTiles);
}

function vectorizeImage(image, placement) {
    const cols = Math.max(1, Math.ceil(placement.width / IMAGE_CELL_SIZE));
    const rows = Math.max(1, Math.ceil(placement.height / IMAGE_CELL_SIZE));
    const sampler = document.createElement('canvas');
    sampler.width = cols;
    sampler.height = rows;

    const sampleCtx = sampler.getContext('2d', { willReadFrequently: true });
    sampleCtx.clearRect(0, 0, cols, rows);
    sampleCtx.drawImage(image, 0, 0, cols, rows);

    const imageData = sampleCtx.getImageData(0, 0, cols, rows);
    const samples = [];
    const cellPixels = new Array(cols * rows).fill(null);

    for (let index = 0; index < cellPixels.length; index += 1) {
        const offset = index * 4;
        const alpha = imageData.data[offset + 3];
        const opacity = alpha / 255;
        const pixel = {
            r: Math.round(imageData.data[offset] * opacity + 255 * (1 - opacity)),
            g: Math.round(imageData.data[offset + 1] * opacity + 255 * (1 - opacity)),
            b: Math.round(imageData.data[offset + 2] * opacity + 255 * (1 - opacity))
        };

        samples.push(pixel);
        cellPixels[index] = pixel;
    }

    const palette = buildImagePalette(samples);
    if (palette.length === 0) return [];

    const cellColors = cellPixels.map(pixel => {
        if (!pixel) return null;
        const paletteColor = palette[getNearestPaletteIndex(pixel, palette)];
        return rgbToHex(paletteColor.r, paletteColor.g, paletteColor.b);
    });

    return buildVectorRects(cellColors, cols, rows, placement);
}

function hexToRgb(hex) {
    const normalized = String(hex || '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return { r: 0, g: 0, b: 0 };

    return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16)
    };
}

function isColorWithinTolerance(data, offset, target, tolerance) {
    return Math.abs(data[offset] - target.r) <= tolerance
        && Math.abs(data[offset + 1] - target.g) <= tolerance
        && Math.abs(data[offset + 2] - target.b) <= tolerance;
}

function isScreenPointInsideWorld(screenX, screenY) {
    return isInsideWorld(screenToWorld(screenX, screenY));
}

function finalizeFillRect(rect, cols, rows, screenWidth, screenHeight, color, order, segments) {
    const x0Screen = rect.x * screenWidth / cols;
    const y0Screen = rect.y * screenHeight / rows;
    const x1Screen = (rect.x + rect.width) * screenWidth / cols;
    const y1Screen = (rect.y + rect.height) * screenHeight / rows;
    const topLeft = screenToWorld(x0Screen, y0Screen);
    const bottomRight = screenToWorld(x1Screen, y1Screen);
    const minX = Math.max(0, Math.min(topLeft.x, bottomRight.x));
    const maxX = Math.min(worldConfig.width, Math.max(topLeft.x, bottomRight.x));
    const minY = Math.max(0, Math.min(topLeft.y, bottomRight.y));
    const maxY = Math.max(topLeft.y, bottomRight.y);
    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0 || height <= 0) return;
    if ((width * camera.zoom) * (height * camera.zoom) < FILL_MIN_SCREEN_AREA) return;

    segments.push({
        kind: 'rect',
        x: minX,
        y: minY,
        width,
        height,
        color,
        order
    });
}

function buildFillRectsFromMask(mask, cols, rows, screenWidth, screenHeight, color, order) {
    const segments = [];
    let active = new Map();

    for (let row = 0; row < rows; row += 1) {
        const nextActive = new Map();
        let col = 0;

        while (col < cols) {
            if (!mask[row * cols + col]) {
                col += 1;
                continue;
            }

            const startCol = col;
            while (col < cols && mask[row * cols + col]) col += 1;

            const widthCols = col - startCol;
            const key = `${startCol}:${widthCols}`;
            const current = active.get(key) || {
                x: startCol,
                y: row,
                width: widthCols,
                height: 0
            };
            current.height += 1;
            nextActive.set(key, current);
        }

        for (const [key, rect] of active) {
            if (!nextActive.has(key)) {
                finalizeFillRect(rect, cols, rows, screenWidth, screenHeight, color, order, segments);
            }
        }

        active = nextActive;
    }

    for (const rect of active.values()) {
        finalizeFillRect(rect, cols, rows, screenWidth, screenHeight, color, order, segments);
    }

    return splitSegmentsForTiles(segments);
}

function buildBucketFillSegments(screenPoint) {
    const seedWorld = screenToWorld(screenPoint.x, screenPoint.y);
    if (!isInsideWorld(seedWorld)) return [];

    const screenWidth = canvasSize.width;
    const screenHeight = canvasSize.height;
    if (screenWidth <= 0 || screenHeight <= 0) return [];

    const cols = Math.max(1, Math.ceil(screenWidth / FILL_SAMPLE_STEP));
    const rows = Math.max(1, Math.ceil(screenHeight / FILL_SAMPLE_STEP));
    const sampler = document.createElement('canvas');
    sampler.width = cols;
    sampler.height = rows;

    const sampleCtx = sampler.getContext('2d', { willReadFrequently: true });
    sampleCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, cols, rows);

    const imageData = sampleCtx.getImageData(0, 0, cols, rows);
    const data = imageData.data;
    const seedCol = Math.min(Math.max(Math.floor(screenPoint.x * cols / screenWidth), 0), cols - 1);
    const seedRow = Math.min(Math.max(Math.floor(screenPoint.y * rows / screenHeight), 0), rows - 1);
    const seedIndex = seedRow * cols + seedCol;
    const seedOffset = seedIndex * 4;
    const target = {
        r: data[seedOffset],
        g: data[seedOffset + 1],
        b: data[seedOffset + 2]
    };
    const fillColor = colorPicker.value;
    const fillRgb = hexToRgb(fillColor);

    if (
        Math.abs(target.r - fillRgb.r) <= 3
        && Math.abs(target.g - fillRgb.g) <= 3
        && Math.abs(target.b - fillRgb.b) <= 3
    ) {
        return [];
    }

    const visited = new Uint8Array(cols * rows);
    const mask = new Uint8Array(cols * rows);
    const queue = [seedIndex];
    visited[seedIndex] = 1;
    let filled = 0;

    while (queue.length > 0) {
        const index = queue.pop();
        const row = Math.floor(index / cols);
        const col = index - row * cols;
        const screenX = (col + 0.5) * screenWidth / cols;
        const screenY = (row + 0.5) * screenHeight / rows;
        const offset = index * 4;

        if (
            !isScreenPointInsideWorld(screenX, screenY)
            || !isColorWithinTolerance(data, offset, target, FILL_COLOR_TOLERANCE)
        ) {
            continue;
        }

        mask[index] = 1;
        filled += 1;
        if (filled > FILL_MAX_CELLS) return [];

        const left = index - 1;
        const right = index + 1;
        const up = index - cols;
        const down = index + cols;

        if (col > 0 && !visited[left]) {
            visited[left] = 1;
            queue.push(left);
        }
        if (col < cols - 1 && !visited[right]) {
            visited[right] = 1;
            queue.push(right);
        }
        if (row > 0 && !visited[up]) {
            visited[up] = 1;
            queue.push(up);
        }
        if (row < rows - 1 && !visited[down]) {
            visited[down] = 1;
            queue.push(down);
        }
    }

    if (filled === 0) return [];
    return buildFillRectsFromMask(mask, cols, rows, screenWidth, screenHeight, fillColor, nextSegmentOrder());
}

async function fillBucketAtPointer(event) {
    if (isFilling || !canEditCanvas()) return;

    const screenPoint = getPointerScreen(event);
    isFilling = true;
    updateCanvasPermissions();

    try {
        const segments = buildBucketFillSegments(screenPoint);
        if (segments.length === 0) return;

        tagSegmentsWithCurrentUser(segments);
        addSegmentsToCache(segments);
        requestRender();
        await sendSegmentsInChunks(segments);
        pushUndoActionFromSegments(segments);
        syncVisibleTiles();
    } catch (error) {
        console.error('No se pudo aplicar bote de pintura:', error);
    } finally {
        isFilling = false;
        updateCanvasPermissions();
    }
}

function sampleCanvasColorAtPointer(event) {
    const screenPoint = getPointerScreen(event);
    const pixelX = Math.min(Math.max(Math.floor(screenPoint.x * canvasSize.dpr), 0), Math.max(canvas.width - 1, 0));
    const pixelY = Math.min(Math.max(Math.floor(screenPoint.y * canvasSize.dpr), 0), Math.max(canvas.height - 1, 0));
    const pixel = ctx.getImageData(pixelX, pixelY, 1, 1).data;

    return rgbToHex(pixel[0], pixel[1], pixel[2]);
}

function pickColorAtPointer(event) {
    if (!canEditCanvas()) return;

    try {
        colorPicker.value = sampleCanvasColorAtPointer(event);
        isEyedropperMode = false;
        setBrushMode();
    } catch (error) {
        console.error('No se pudo tomar el color del lienzo:', error);
        isEyedropperMode = false;
        updateToolButtons();
    }
}

async function sendSegmentsInChunks(segments) {
    if (!canEditCanvas()) return;

    for (let index = 0; index < segments.length; index += IMAGE_SEND_CHUNK_SIZE) {
        if (!canEditCanvas()) return;
        socket.emit('draw-batch', segments.slice(index, index + IMAGE_SEND_CHUNK_SIZE));
        if (index % (IMAGE_SEND_CHUNK_SIZE * 4) === 0) {
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    }
}

async function handleImageFile(file) {
    if (!file) return;

    if (!canEditCanvas()) {
        setImageStatus('Inicia sesion con Google para subir imagenes.');
        updateCanvasPermissions();
        return;
    }

    if (!isSupportedImage(file)) {
        setImageStatus('Formato no soportado. Usa JPG, PNG o WebP.');
        return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
        setImageStatus('Imagen demasiado pesada. Maximo 12 MB.');
        return;
    }

    if (!socket.connected) {
        setImageStatus('Conecta primero antes de guardar la imagen.');
        return;
    }

    imageUploadBtn.disabled = true;
    setImageStatus('Cargando imagen...');

    try {
        if (pendingImagePlacement) cancelPendingImagePlacement('');
        imageUploadBtn.disabled = true;
        const image = await loadDrawableImage(file);
        const basePlacement = getBaseImagePlacement(image);
        pendingImagePlacement = {
            image,
            center: basePlacement.center,
            baseWidth: basePlacement.baseWidth,
            baseHeight: basePlacement.baseHeight,
            scalePercent: basePlacement.scalePercent,
            placement: getImagePlacementFromState(basePlacement)
        };

        setBrushMode();
        setToolbarOpen(true);
        updateImageSizeControls();
        setImageStatus('Ajusta tamano, mueve la imagen y haz click para soltarla. Escape cancela.');
        requestRender();
    } catch (error) {
        console.error('No se pudo cargar la imagen:', error);
        setImageStatus('No se pudo cargar la imagen.');
    } finally {
        if (imageInput) imageInput.value = '';
        updateCanvasPermissions();
    }
}

async function commitPendingImagePlacement() {
    if (!pendingImagePlacement || isCommittingImage) return;
    if (!canEditCanvas()) {
        cancelPendingImagePlacement('Inicia sesion con Google para guardar imagenes.');
        return;
    }

    const pending = pendingImagePlacement;
    isCommittingImage = true;
    updateUndoButtons();
    imageUploadBtn.disabled = true;
    setImageStatus('Vectorizando imagen...');
    requestRender();

    try {
        const vectorSegments = splitSegmentsForTiles(vectorizeImage(pending.image, pending.placement));

        if (vectorSegments.length === 0) {
            setImageStatus('No se detectaron colores utiles.');
            return;
        }

        tagSegmentsWithCurrentUser(vectorSegments);
        addSegmentsToCache(vectorSegments);
        requestRender();
        setImageStatus(`Guardando ${vectorSegments.length} bloques...`);
        await sendSegmentsInChunks(vectorSegments);
        pushUndoActionFromSegments(vectorSegments);
        syncVisibleTiles();
        setImageStatus(`Imagen lista: ${vectorSegments.length} bloques.`);
    } catch (error) {
        console.error('No se pudo vectorizar la imagen:', error);
        setImageStatus('No se pudo procesar la imagen.');
    } finally {
        closeImageResource(pending.image);
        if (pendingImagePlacement === pending) pendingImagePlacement = null;
        isCommittingImage = false;
        updateImageSizeControls();
        updateCanvasPermissions();
        requestRender();
    }
}

function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(renderScene);
}

function renderScene() {
    renderQueued = false;
    const { width, height, dpr } = canvasSize;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    drawWorldBackground();

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    if (isTracingOverlayVisible()) {
        drawTileSnapshots();
        drawTracingOverlay();
        if (isAdminHighlightActive() && isAdminHighlightReady()) {
            drawAdminHighlightedSegments(getAdminRenderSegments(), selectedAdminUserEmail);
        } else {
            drawWorldSegments(getRenderSegments());
        }
    } else if (isAdminHighlightActive() && isAdminHighlightReady()) {
        drawAdminHighlightedSegments(getAdminRenderSegments(), selectedAdminUserEmail);
    } else {
        drawTileRasterCaches();
    }

    drawPendingImagePlacement();
    drawExportSelectionOverlay();

    ctx.restore();
    updateHud();
    requestMinimapRender();
}

function isTracingOverlayVisible() {
    return Boolean(isCurrentUserAdmin && tracingOverlay && tracingOverlay.visible);
}

function drawWorldBackground() {
    const { width, height } = canvasSize;
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(width, height);
    const visibleTop = Math.max(Math.min(topLeft.y, bottomRight.y), 0);
    const visibleBottom = Math.max(Math.max(topLeft.y, bottomRight.y), 0);
    if (visibleBottom <= visibleTop) return;

    const leftTop = worldToScreen(0, visibleTop);
    const rightBottom = worldToScreen(worldConfig.width, visibleBottom);
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(leftTop.x, leftTop.y, rightBottom.x - leftTop.x, rightBottom.y - leftTop.y);
    ctx.restore();
}

function drawGrid() {
    const { width, height } = canvasSize;
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(width, height);
    const gridStep = camera.zoom < 0.35 ? worldConfig.tileSize : 256;
    const startX = Math.max(Math.floor(Math.min(topLeft.x, bottomRight.x) / gridStep) * gridStep, 0);
    const endX = Math.min(Math.ceil(Math.max(topLeft.x, bottomRight.x) / gridStep) * gridStep, worldConfig.width);
    const startY = Math.max(Math.floor(Math.min(topLeft.y, bottomRight.y) / gridStep) * gridStep, 0);
    const endY = Math.ceil(bottomRight.y / gridStep) * gridStep;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
    ctx.lineWidth = 1;

    for (let x = startX; x <= endX; x += gridStep) {
        const screen = worldToScreen(x, 0);
        ctx.moveTo(screen.x, 0);
        ctx.lineTo(screen.x, height);
    }

    for (let y = startY; y <= endY; y += gridStep) {
        const screen = worldToScreen(0, y);
        const left = worldToScreen(0, y);
        const right = worldToScreen(worldConfig.width, y);
        ctx.moveTo(left.x, screen.y);
        ctx.lineTo(right.x, screen.y);
    }

    ctx.stroke();
    ctx.restore();
}

function getSegmentOpacity(segment) {
    if (!segment || segment.color === 'eraser') return 1;
    const opacity = Number(segment.opacity);
    if (!Number.isFinite(opacity)) return 1;
    return Math.min(Math.max(opacity, 0.05), 1);
}

function drawWorldSegmentOnContext(targetCtx, segment, zoomForBleed = camera.zoom) {
    if (segment.kind === 'rect') {
        const bleed = Math.min(VECTOR_RECT_BLEED, 0.5 / zoomForBleed);
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.fillStyle = segment.color;
        targetCtx.fillRect(
            segment.x - bleed,
            segment.y - bleed,
            segment.width + bleed * 2,
            segment.height + bleed * 2
        );
        return;
    }

    if (segment.kind === 'text') {
        const lines = getTextLines(segment.text);
        if (lines.length === 0) return;

        const size = clampTextSize(segment.size);
        const lineHeight = getTextLineHeight(size);
        targetCtx.save();
        targetCtx.globalAlpha = getSegmentOpacity(segment);
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.fillStyle = isHexColor(segment.color) ? segment.color : '#000000';
        targetCtx.font = getTextCanvasFont(size, segment.fontFamily);
        targetCtx.textAlign = 'left';
        targetCtx.textBaseline = 'top';
        for (let index = 0; index < lines.length; index += 1) {
            targetCtx.fillText(lines[index], Number(segment.x), Number(segment.y) + index * lineHeight);
        }
        targetCtx.restore();
        return;
    }

    targetCtx.save();
    targetCtx.globalAlpha = getSegmentOpacity(segment);
    targetCtx.beginPath();
    targetCtx.moveTo(segment.x0, segment.y0);
    targetCtx.lineTo(segment.x1, segment.y1);

    if (segment.color === 'eraser') {
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.lineWidth = Number(segment.size) * 2;
        targetCtx.strokeStyle = '#ffffff';
    } else {
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.strokeStyle = segment.color;
        targetCtx.lineWidth = Number(segment.size);
    }

    targetCtx.lineCap = 'round';
    targetCtx.lineJoin = 'round';
    targetCtx.stroke();
    targetCtx.closePath();
    targetCtx.restore();
}

function drawWorldSegment(segment) {
    drawWorldSegmentOnContext(ctx, segment, camera.zoom);
}

function drawTileSnapshots() {
    const keys = Array.from(visibleTiles).sort(compareTileKeysTopFirst);
    drawTileSnapshotsForKeys(keys);
}

function drawTileSnapshotsForKeys(keys) {
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;

    for (const key of keys) {
        const snapshot = tileSnapshots.get(key);
        const state = tileSnapshotImages.get(key);
        if (!snapshot || !state || !state.loaded || state.error) continue;

        const { tileX, tileY } = parseTileKey(key);
        const x = tileX * worldConfig.tileSize;
        const y = tileY * worldConfig.tileSize;
        const width = Number(snapshot.width) || worldConfig.tileSize;
        const height = Number(snapshot.height) || worldConfig.tileSize;
        ctx.drawImage(state.image, x, y, width, height);
    }

    ctx.restore();
}

function drawWorldSegments(segments, targetCtx = ctx, zoomForBleed = camera.zoom) {
    let index = 0;

    while (index < segments.length) {
        const segment = segments[index];
        if (segment.kind !== 'rect') {
            drawWorldSegmentOnContext(targetCtx, segment, zoomForBleed);
            index += 1;
            continue;
        }

        const color = segment.color;
        const bleed = Math.min(VECTOR_RECT_BLEED, 0.5 / zoomForBleed);
        targetCtx.globalCompositeOperation = 'source-over';
        targetCtx.fillStyle = color;
        targetCtx.beginPath();

        while (index < segments.length && segments[index].kind === 'rect' && segments[index].color === color) {
            const rect = segments[index];
            targetCtx.rect(
                rect.x - bleed,
                rect.y - bleed,
                rect.width + bleed * 2,
                rect.height + bleed * 2
            );
            index += 1;
        }

        targetCtx.fill();
        targetCtx.closePath();
    }
}

function getSortedTileSegments(key) {
    const segments = tileSegments.get(key) || [];
    return segments.slice().sort((a, b) => {
        const orderDelta = getSegmentOrder(a) - getSegmentOrder(b);
        if (orderDelta !== 0) return orderDelta;
        return (a._cacheId || 0) - (b._cacheId || 0);
    });
}

function buildTileRasterCache(key) {
    const bounds = getTileWorldBounds(key);
    if (bounds.width <= 0 || bounds.height <= 0) return null;

    const scale = TILE_RASTER_CACHE_SCALE;
    const rasterWidth = Math.max(1, Math.ceil(bounds.width * scale));
    const rasterHeight = Math.max(1, Math.ceil(bounds.height * scale));
    const rasterCanvas = createTileRasterCanvas(rasterWidth, rasterHeight);
    const rasterCtx = rasterCanvas.getContext('2d', { alpha: true });
    if (!rasterCtx) return null;

    const snapshot = tileSnapshots.get(key);
    const snapshotState = tileSnapshotImages.get(key);
    if (snapshot && (!snapshotState || !snapshotState.loaded || snapshotState.error)) {
        return null;
    }

    rasterCtx.setTransform(1, 0, 0, 1, 0, 0);
    rasterCtx.clearRect(0, 0, rasterWidth, rasterHeight);
    rasterCtx.imageSmoothingEnabled = true;
    rasterCtx.imageSmoothingQuality = 'medium';
    rasterCtx.setTransform(scale, 0, 0, scale, -bounds.x * scale, -bounds.y * scale);

    if (snapshot && snapshotState && snapshotState.loaded && !snapshotState.error) {
        const snapshotWidth = Number(snapshot.width) || worldConfig.tileSize;
        const snapshotHeight = Number(snapshot.height) || worldConfig.tileSize;
        rasterCtx.drawImage(snapshotState.image, bounds.x, bounds.y, snapshotWidth, snapshotHeight);
    }

    const sortedSegments = getSortedTileSegments(key);
    drawWorldSegments(sortedSegments, rasterCtx, 1);

    const maxOrder = sortedSegments.reduce((max, segment) => Math.max(max, getSegmentOrder(segment)), 0);
    const cache = {
        canvas: rasterCanvas,
        ctx: rasterCtx,
        bounds,
        scale,
        revision: getTileRasterRevision(key),
        maxOrder,
        lastUsed: ++tileRasterCacheUseCounter
    };
    tileRasterCache.set(key, cache);
    return cache;
}

function getTileRasterCache(key) {
    const revision = getTileRasterRevision(key);
    const cached = tileRasterCache.get(key);
    if (cached && cached.revision === revision) {
        cached.lastUsed = ++tileRasterCacheUseCounter;
        return cached;
    }

    return buildTileRasterCache(key);
}

function appendSegmentToTileRasterCache(key, segment) {
    const cached = tileRasterCache.get(key);
    if (!cached || cached.revision !== getTileRasterRevision(key)) return false;

    const order = getSegmentOrder(segment);
    if (order > 0 && cached.maxOrder > 0 && order < cached.maxOrder) return false;

    const { bounds, scale } = cached;
    cached.ctx.setTransform(scale, 0, 0, scale, -bounds.x * scale, -bounds.y * scale);
    drawWorldSegmentOnContext(cached.ctx, segment, 1);
    cached.maxOrder = Math.max(cached.maxOrder, order);
    cached.lastUsed = ++tileRasterCacheUseCounter;
    return true;
}

function drawTileVectorFallback(key) {
    const bounds = getTileWorldBounds(key);
    if (bounds.width <= 0 || bounds.height <= 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height);
    ctx.clip();
    drawWorldSegments(getSortedTileSegments(key));
    ctx.restore();
}

function drawTileRasterCaches() {
    const keys = Array.from(visibleTiles).sort(compareTileKeysTopFirst);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    for (const key of keys) {
        const cache = getTileRasterCache(key);
        if (!cache) {
            drawTileSnapshotsForKeys([key]);
            drawTileVectorFallback(key);
            continue;
        }

        const { bounds } = cache;
        ctx.drawImage(cache.canvas, bounds.x, bounds.y, bounds.width, bounds.height);
    }

    ctx.restore();
    pruneTileRasterCache();
}

function isAdminHighlightReady() {
    if (!isAdminHighlightActive()) return false;
    if (visibleTiles.size === 0) return false;

    for (const key of visibleTiles) {
        if (!adminLoadedTiles.has(key)) return false;
    }

    return true;
}

function getAdminRenderSegments() {
    const segments = [];
    for (const key of visibleTiles) {
        const tileAdminSegments = adminTileSegments.get(key);
        if (tileAdminSegments) segments.push(...tileAdminSegments);
    }

    const dedupedSegments = dedupeSegmentsByIdentity(segments);
    dedupedSegments.sort((a, b) => {
        const orderDelta = getSegmentOrder(a) - getSegmentOrder(b);
        if (orderDelta !== 0) return orderDelta;
        return (a._cacheId || 0) - (b._cacheId || 0);
    });

    return dedupedSegments;
}

function drawAdminVeil() {
    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(canvasSize.width, canvasSize.height);
    const visibleTop = Math.max(Math.min(topLeft.y, bottomRight.y), 0);
    const visibleBottom = Math.max(Math.max(topLeft.y, bottomRight.y), 0);
    if (visibleBottom <= visibleTop) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = ADMIN_HIGHLIGHT_VEIL_ALPHA;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, visibleTop, worldConfig.width, visibleBottom - visibleTop);
    ctx.restore();
}

function drawAdminHighlightedSegments(segments, selectedEmail) {
    const normalizedSelectedEmail = normalizeEmail(selectedEmail);
    const selectedSegments = segments.filter(segment => normalizeEmail(segment.userEmail) === normalizedSelectedEmail);

    drawWorldSegments(segments);
    drawAdminVeil();
    drawWorldSegments(selectedSegments);
}

function drawPendingImagePlacement() {
    if (!pendingImagePlacement) return;

    const { image, placement } = pendingImagePlacement;
    ctx.save();
    ctx.globalAlpha = isCommittingImage ? 0.45 : 0.78;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, placement.x, placement.y, placement.width, placement.height);

    ctx.globalAlpha = 1;
    ctx.setLineDash([12 / camera.zoom, 8 / camera.zoom]);
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeStyle = '#00ffcc';
    ctx.strokeRect(placement.x, placement.y, placement.width, placement.height);
    ctx.restore();
}

function drawTracingOverlay() {
    if (!isCurrentUserAdmin || !tracingOverlay || !tracingOverlay.visible) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = Math.min(Math.max(Number(tracingOverlay.opacity) || 0.4, 0.1), 0.9);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
        tracingOverlay.image,
        tracingOverlay.x,
        tracingOverlay.y,
        tracingOverlay.width,
        tracingOverlay.height
    );
    ctx.restore();

    if (!isTracingMoveMode) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([12 / camera.zoom, 8 / camera.zoom]);
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeStyle = '#fbbf24';
    ctx.strokeRect(tracingOverlay.x, tracingOverlay.y, tracingOverlay.width, tracingOverlay.height);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.84)';
    const label = 'Mover calco';
    const labelX = tracingOverlay.x + 8 / camera.zoom;
    const labelY = Math.max(tracingOverlay.y + 22 / camera.zoom, tracingOverlay.y + 8 / camera.zoom);
    ctx.font = `${12 / camera.zoom}px Inter, sans-serif`;
    const metrics = ctx.measureText(label);
    ctx.fillRect(labelX - 5 / camera.zoom, labelY - 15 / camera.zoom, metrics.width + 10 / camera.zoom, 20 / camera.zoom);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, labelX, labelY);
    ctx.restore();
}

function drawExportSelectionOverlay() {
    if (!exportSelection) return;
    const { x, y, width, height } = exportSelection;
    if (width <= 0 || height <= 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0, 255, 204, 0.14)';
    ctx.fillRect(x, y, width, height);
    ctx.setLineDash([12 / camera.zoom, 8 / camera.zoom]);
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeStyle = '#00ffcc';
    ctx.strokeRect(x, y, width, height);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 1 / camera.zoom;
    const label = `${Math.round(width)} x ${Math.round(height)} px`;
    const labelX = x + 8 / camera.zoom;
    const labelY = Math.max(y + 22 / camera.zoom, y + 8 / camera.zoom);
    ctx.font = `${12 / camera.zoom}px Inter, sans-serif`;
    const metrics = ctx.measureText(label);
    ctx.fillRect(labelX - 5 / camera.zoom, labelY - 15 / camera.zoom, metrics.width + 10 / camera.zoom, 20 / camera.zoom);
    ctx.strokeRect(labelX - 5 / camera.zoom, labelY - 15 / camera.zoom, metrics.width + 10 / camera.zoom, 20 / camera.zoom);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(label, labelX, labelY);
    ctx.restore();
}

function clampTextSize(value) {
    const size = Number(value);
    if (!Number.isFinite(size)) return 36;
    return Math.min(Math.max(Math.round(size), 6), 160);
}

function isHexColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || ''));
}

function normalizeTextValue(value) {
    return String(value || '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .split('\n')
        .slice(0, TEXT_MAX_LINES)
        .map(line => line.replace(/[^\S\n]+/g, ' ').trim().slice(0, 80))
        .join('\n')
        .trim()
        .slice(0, TEXT_MAX_LENGTH);
}

function getTextLines(text) {
    const normalizedText = normalizeTextValue(text);
    return normalizedText ? normalizedText.split('\n') : [];
}

function getTextLineHeight(size) {
    return Math.round(clampTextSize(size) * 1.22);
}

function getTextCanvasFont(size, fontFamily = TEXT_DEFAULT_FONT) {
    return `${clampTextSize(size)}px ${fontFamily || TEXT_DEFAULT_FONT}`;
}

function measureTextLines(lines, size) {
    const textSize = clampTextSize(size);
    const safeLines = Array.isArray(lines) ? lines : [];
    const lineHeight = getTextLineHeight(textSize);
    if (safeLines.length === 0) return { width: 0, height: 0, lineHeight };

    ctx.save();
    ctx.font = getTextCanvasFont(textSize);
    const width = Math.ceil(safeLines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 1));
    ctx.restore();

    return {
        width,
        height: Math.ceil(safeLines.length * lineHeight),
        lineHeight
    };
}

function measureTextSegment(text, size) {
    return measureTextLines(getTextLines(text), size);
}

function splitLongTextWord(word, maxWidth) {
    const chunks = [];
    let current = '';

    for (const char of word) {
        const next = current + char;
        if (current && ctx.measureText(next).width > maxWidth) {
            chunks.push(current);
            current = char;
        } else {
            current = next;
        }
    }

    if (current) chunks.push(current);
    return chunks;
}

function wrapTextToWidth(text, size, maxWidth) {
    const normalizedText = normalizeTextValue(text);
    if (!normalizedText) return '';

    const wrapWidth = Math.max(clampTextSize(size) * 4, Number(maxWidth) || 0);
    const wrappedLines = [];

    ctx.save();
    ctx.font = getTextCanvasFont(size);

    for (const paragraph of normalizedText.split('\n')) {
        const words = paragraph.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            wrappedLines.push('');
            continue;
        }

        let line = '';
        for (const word of words) {
            const candidate = line ? `${line} ${word}` : word;
            if (ctx.measureText(candidate).width <= wrapWidth) {
                line = candidate;
                continue;
            }

            if (line) {
                wrappedLines.push(line);
                line = '';
                if (wrappedLines.length >= TEXT_MAX_LINES) break;
            }

            if (ctx.measureText(word).width <= wrapWidth) {
                line = word;
            } else {
                const chunks = splitLongTextWord(word, wrapWidth);
                while (chunks.length > 1 && wrappedLines.length < TEXT_MAX_LINES) {
                    wrappedLines.push(chunks.shift());
                }
                line = chunks[0] || '';
            }
        }

        if (line && wrappedLines.length < TEXT_MAX_LINES) wrappedLines.push(line);
        if (wrappedLines.length >= TEXT_MAX_LINES) break;
    }

    ctx.restore();
    return wrappedLines.slice(0, TEXT_MAX_LINES).join('\n').slice(0, TEXT_MAX_LENGTH);
}

function createTextSegmentAtPoint(point) {
    const size = clampTextSize(textSizeSlider ? textSizeSlider.value : 36);
    const availableWidth = Math.max(size * 4, worldConfig.width - point.x - size);
    const text = wrapTextToWidth(textInput ? textInput.value : '', size, availableWidth);
    if (!text) {
        if (textStatus) textStatus.innerText = 'Texto vacio.';
        if (textInput) textInput.focus();
        return null;
    }

    const metrics = measureTextSegment(text, size);
    return {
        kind: 'text',
        x: point.x,
        y: point.y,
        text,
        color: colorPicker.value,
        size,
        fontFamily: TEXT_DEFAULT_FONT,
        width: metrics.width,
        height: metrics.height,
        order: nextSegmentOrder()
    };
}

function placeTextAtPointer(event) {
    if (!canEditCanvas()) return;
    const point = clampWorldPoint(getPointerWorld(event));
    const segment = createTextSegmentAtPoint(point);
    if (!segment) return;

    beginUndoAction();
    tagSegmentsWithCurrentUser([segment]);
    addSegmentsToCache([segment]);
    trackUndoSegment(segment);
    finishUndoAction();
    queueOutboundSegment(segment);
    requestRender();
    if (textStatus) textStatus.innerText = 'Texto agregado.';
}

function getPressureValue(event) {
    if (!event || event.pointerType !== 'pen') return null;
    const pressure = Number(event.pressure);
    if (!Number.isFinite(pressure)) return null;
    return Math.min(Math.max(pressure || 0.05, 0.05), 1);
}

function getPressureSegmentStyleFromValue(pressure) {
    const baseSize = Math.max(1, Number(sizeSlider.value) || 1);
    const multiplier = PRESSURE_MIN_SIZE_MULTIPLIER
        + pressure * (PRESSURE_MAX_SIZE_MULTIPLIER - PRESSURE_MIN_SIZE_MULTIPLIER);
    const opacity = PRESSURE_MIN_OPACITY + pressure * (1 - PRESSURE_MIN_OPACITY);

    return {
        size: Math.max(0.5, baseSize * multiplier),
        opacity: Math.min(Math.max(opacity, PRESSURE_MIN_OPACITY), 1)
    };
}

function getPressureSegmentStyle(event) {
    const pressure = getPressureValue(event);
    if (pressure === null) return null;
    return getPressureSegmentStyleFromValue(pressure);
}

function getSmoothedPressureSegmentStyle(event) {
    const pressure = getPressureValue(event);
    if (pressure === null) return null;
    currentPressure += (pressure - currentPressure) * PRESSURE_SMOOTHING;
    return getPressureSegmentStyleFromValue(currentPressure);
}

function getDefaultBrushStyle() {
    return {
        size: Math.max(1, Number(sizeSlider.value) || 1),
        opacity: 1
    };
}

function setCurrentBrushStyle(style) {
    currentBrushSize = Math.max(0.5, Number(style && style.size) || 1);
    currentBrushOpacity = Math.min(Math.max(Number(style && style.opacity) || 1, 0.05), 1);
}

function getDrawingEvents(event) {
    if (!event || typeof event.getCoalescedEvents !== 'function') return [event];

    const events = event.getCoalescedEvents()
        .filter(coalescedEvent => Number.isFinite(coalescedEvent.clientX) && Number.isFinite(coalescedEvent.clientY));
    if (events.length === 0) return [event];

    const limitedEvents = events.slice(Math.max(0, events.length - DRAW_COALESCED_EVENT_LIMIT));
    const lastEvent = limitedEvents[limitedEvents.length - 1];
    if (!lastEvent || lastEvent.clientX !== event.clientX || lastEvent.clientY !== event.clientY) {
        limitedEvents.push(event);
    }
    return limitedEvents;
}

function lerpNumber(from, to, amount) {
    return from + (to - from) * amount;
}

function getBrushInterpolationStep(size) {
    const numericSize = Math.max(0.5, Number(size) || 1);
    return Math.max(2.5, Math.min(10, numericSize * 0.45));
}

function createLineSegment(fromX, fromY, toX, toY, style) {
    return {
        kind: 'line',
        x0: fromX,
        y0: fromY,
        x1: toX,
        y1: toY,
        color: isEraser ? 'eraser' : colorPicker.value,
        size: Math.max(0.5, Number(style && style.size) || Number(sizeSlider.value) || 1),
        opacity: isEraser ? 1 : Math.min(Math.max(Number(style && style.opacity) || 1, 0.05), 1),
        order: nextSegmentOrder()
    };
}

function appendInterpolatedDrawSegments(targetPoint, targetStyle, segments) {
    const distanceX = targetPoint.x - currentX;
    const distanceY = targetPoint.y - currentY;
    const distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);
    if (distanceSquared < MIN_POINT_DISTANCE * MIN_POINT_DISTANCE) return false;

    const distance = Math.sqrt(distanceSquared);
    const startX = currentX;
    const startY = currentY;
    const startSize = Math.max(0.5, Number(currentBrushSize) || Number(targetStyle.size) || 1);
    const startOpacity = Math.min(Math.max(Number(currentBrushOpacity) || Number(targetStyle.opacity) || 1, 0.05), 1);
    const endSize = Math.max(0.5, Number(targetStyle.size) || startSize);
    const endOpacity = Math.min(Math.max(Number(targetStyle.opacity) || startOpacity, 0.05), 1);
    const step = getBrushInterpolationStep(Math.max(startSize, endSize));
    const steps = Math.max(1, Math.min(DRAW_INTERPOLATION_MAX_STEPS, Math.ceil(distance / step)));
    let fromX = currentX;
    let fromY = currentY;

    for (let index = 1; index <= steps; index += 1) {
        const amount = index / steps;
        const toX = lerpNumber(startX, targetPoint.x, amount);
        const toY = lerpNumber(startY, targetPoint.y, amount);
        const segmentStyle = {
            size: lerpNumber(startSize, endSize, amount),
            opacity: lerpNumber(startOpacity, endOpacity, amount)
        };
        segments.push(createLineSegment(fromX, fromY, toX, toY, segmentStyle));
        fromX = toX;
        fromY = toY;
    }

    currentX = targetPoint.x;
    currentY = targetPoint.y;
    currentBrushSize = endSize;
    currentBrushOpacity = endOpacity;
    return true;
}

function rejectPressureBrushPointer() {
    if (pressureBrushStatus) {
        pressureBrushStatus.innerText = 'Este modo requiere lapiz/tableta con presion.';
    }
}

function startPointer(e) {
    if (e.button !== undefined && e.button !== 0) return;

    e.preventDefault();
    if (canvas.setPointerCapture && e.pointerId !== undefined) canvas.setPointerCapture(e.pointerId);
    trackCanvasPointer(e);

    if (shouldUsePinchZoom(e) && activeCanvasPointers.size >= 2 && startPinchGesture()) {
        return;
    }

    if (isTouchMultiPointerGesture(e)) {
        cancelActiveDrawingForGesture();
        isDrawing = false;
        isPanning = false;
        panStart = null;
        return;
    }

    const screen = getPointerScreen(e);
    if (isExportSelectionMode && startExportSelection(e)) {
        return;
    }
    if (isTracingMoveMode) {
        startTracingMove(e);
        return;
    }

    if (!canEditCanvas()) {
        isPanning = true;
        panStart = {
            screenX: screen.x,
            screenY: screen.y,
            cameraX: camera.x,
            cameraY: camera.y
        };
        return;
    }

    if (pendingImagePlacement) {
        updatePendingImagePlacement(clampWorldPoint(getPointerWorld(e)));
        commitPendingImagePlacement();
        return;
    }

    if (isTextMode) {
        placeTextAtPointer(e);
        return;
    }

    if (isEyedropperMode) {
        pickColorAtPointer(e);
        return;
    }

    if (isFillMode) {
        fillBucketAtPointer(e);
        return;
    }

    if (isPressureBrushMode) {
        const pressure = getPressureValue(e);
        if (pressure === null) {
            rejectPressureBrushPointer();
            return;
        }
        currentPressure = pressure;
        const pressureStyle = getPressureSegmentStyleFromValue(currentPressure);

        const pos = getPointerWorld(e);
        if (!isInsideWorld(pos)) return;

        beginUndoAction();
        isDrawing = true;
        currentX = pos.x;
        currentY = pos.y;
        setCurrentBrushStyle(pressureStyle);
        return;
    }

    if (isPanMode) {
        isPanning = true;
        panStart = {
            screenX: screen.x,
            screenY: screen.y,
            cameraX: camera.x,
            cameraY: camera.y
        };
        return;
    }

    const pos = getPointerWorld(e);
    if (!isInsideWorld(pos)) return;

    beginUndoAction();
    isDrawing = true;
    currentX = pos.x;
    currentY = pos.y;
    setCurrentBrushStyle(getDefaultBrushStyle());
}

function movePointer(e) {
    if (e.pointerId !== undefined && activeCanvasPointers.has(e.pointerId)) {
        trackCanvasPointer(e);
        if (pinchState || (shouldUsePinchZoom(e) && activeCanvasPointers.size >= 2)) {
            e.preventDefault();
            if (!pinchState && !startPinchGesture()) {
                cancelActiveDrawingForGesture();
                isDrawing = false;
                isPanning = false;
                panStart = null;
                return;
            }
            updatePinchGesture();
            return;
        }
    }

    if (isExportSelecting) {
        e.preventDefault();
        updateExportSelection(e);
        return;
    }

    if (isDraggingTracingOverlay) {
        e.preventDefault();
        moveTracingOverlay(e);
        return;
    }

    if (pendingImagePlacement && !isCommittingImage) {
        e.preventDefault();
        updatePendingImagePlacement(clampWorldPoint(getPointerWorld(e)));
        return;
    }

    if (!isDrawing && !isPanning) return;

    e.preventDefault();

    if (isPanning && panStart) {
        const screen = getPointerScreen(e);
        camera.x = panStart.cameraX - (screen.x - panStart.screenX) / camera.zoom;
        camera.y = panStart.cameraY - (screen.y - panStart.screenY) / camera.zoom;
        clampCamera();
        requestRender();
        syncVisibleTiles();
        return;
    }

    const segments = [];
    for (const drawEvent of getDrawingEvents(e)) {
        const pos = clampWorldPoint(getPointerWorld(drawEvent));
        const brushStyle = isPressureBrushMode ? getSmoothedPressureSegmentStyle(drawEvent) : getDefaultBrushStyle();
        if (isPressureBrushMode && !brushStyle) {
            rejectPressureBrushPointer();
            return;
        }

        appendInterpolatedDrawSegments(pos, brushStyle, segments);
    }

    if (segments.length === 0) return;

    tagSegmentsWithCurrentUser(segments);
    addSegmentsToCache(segments);
    for (const segment of segments) {
        trackUndoSegment(segment);
        queueOutboundSegment(segment);
    }
    requestRender();
}

function stopPointer(e) {
    const hadTrackedPointer = e && e.pointerId !== undefined && activeCanvasPointers.has(e.pointerId);
    if (!isDrawing && !isPanning && !pinchState && !isExportSelecting && !isDraggingTracingOverlay && !hadTrackedPointer) return;

    if (e && canvas.releasePointerCapture && e.pointerId !== undefined) {
        try {
            canvas.releasePointerCapture(e.pointerId);
        } catch (error) {
            // Pointer capture may already be released by the browser.
        }
    }

    releaseCanvasPointer(e);

    if (pinchState) {
        pinchState = null;
        isDrawing = false;
        isPanning = false;
        panStart = null;
        resumePanFromRemainingPointer();
        syncVisibleTiles();
        return;
    }

    if (isExportSelecting) {
        isDrawing = false;
        isPanning = false;
        panStart = null;
        finishExportSelection(e);
        syncVisibleTiles();
        return;
    }

    if (stopTracingMove()) {
        isDrawing = false;
        isPanning = false;
        panStart = null;
        syncVisibleTiles();
        return;
    }

    const wasDrawing = isDrawing;
    isDrawing = false;
    isPanning = false;
    panStart = null;
    flushOutboundSegments();
    if (wasDrawing) {
        finishUndoAction();
    } else {
        cancelUndoAction();
    }
    syncVisibleTiles();
}

function updateHud() {
    if (zoomValue) {
        const nextZoomText = `${Math.round(camera.zoom * 100)}%`;
        if (nextZoomText !== lastHudZoomText) {
            zoomValue.innerText = nextZoomText;
            lastHudZoomText = nextZoomText;
        }
    }

    if (tileText) {
        const centerTile = tileForPoint(camera.x, camera.y);
        const nextTileText = `Tile ${centerTile.tileX}, ${centerTile.tileY}`;
        if (nextTileText !== lastHudTileText) {
            tileText.innerText = nextTileText;
            lastHudTileText = nextTileText;
        }
    }
}

canvas.addEventListener('pointerdown', startPointer);
canvas.addEventListener('pointermove', movePointer);
canvas.addEventListener('pointerup', stopPointer);
canvas.addEventListener('pointercancel', stopPointer);
canvas.addEventListener('lostpointercapture', stopPointer);
canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const screen = getPointerScreen(event);
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    zoomAt(screen.x, screen.y, camera.zoom * factor);
}, { passive: false });

window.addEventListener('resize', resizeCanvas, { passive: true });

panBtn.addEventListener('click', () => setPanMode(!isPanMode));
if (brushBtn) brushBtn.addEventListener('click', setBrushMode);
if (pressureBrushBtn) pressureBrushBtn.addEventListener('click', setPressureBrushMode);
if (textToolBtn) textToolBtn.addEventListener('click', () => setTextMode(!isTextMode));
if (textInput) {
    textInput.addEventListener('input', () => {
        if (textInput.value.length > TEXT_MAX_LENGTH) textInput.value = textInput.value.slice(0, TEXT_MAX_LENGTH);
        if (textStatus) textStatus.innerText = normalizeTextValue(textInput.value) ? 'Listo para colocar.' : 'Texto vacio.';
    });
}
if (textSizeSlider) {
    textSizeSlider.addEventListener('input', (event) => {
        if (textSizeValue) textSizeValue.innerText = String(clampTextSize(event.target.value));
    });
}
brushFloatingBtn.addEventListener('click', setBrushMode);
handFloatingBtn.addEventListener('click', () => setPanMode(true));
zoomInBtn.addEventListener('click', () => zoomBy(1.2));
zoomOutBtn.addEventListener('click', () => zoomBy(1 / 1.2));
resetViewBtn.addEventListener('click', () => resetCamera(true));
sizeSlider.addEventListener('input', (e) => { sizeValue.innerText = e.target.value; });
imageUploadBtn.addEventListener('click', () => {
    if (!canEditCanvas()) {
        setLoginOverlayVisible(true);
        setLoginStatus('Inicia sesion con Google para subir imagenes.');
        return;
    }
    imageInput.click();
});
imageInput.addEventListener('change', (event) => handleImageFile(event.target.files && event.target.files[0]));
if (imageSizeSlider) {
    imageSizeSlider.addEventListener('input', (event) => setPendingImageScale(event.target.value));
}
if (imageSmallerBtn) {
    imageSmallerBtn.addEventListener('click', () => {
        if (!pendingImagePlacement) return;
        setPendingImageScale(clampImageScalePercent(pendingImagePlacement.scalePercent) - IMAGE_SCALE_STEP_PERCENT);
    });
}
if (imageLargerBtn) {
    imageLargerBtn.addEventListener('click', () => {
        if (!pendingImagePlacement) return;
        setPendingImageScale(clampImageScalePercent(pendingImagePlacement.scalePercent) + IMAGE_SCALE_STEP_PERCENT);
    });
}
if (googleLoginBtn) googleLoginBtn.addEventListener('click', signInWithGoogle);
if (guestLoginBtn) guestLoginBtn.addEventListener('click', continueAsGuest);
if (toolbarLoginBtn) toolbarLoginBtn.addEventListener('click', () => {
    setLoginOverlayVisible(true);
    signInWithGoogle();
});
if (toolbarLogoutBtn) toolbarLogoutBtn.addEventListener('click', signOutToGuest);
if (adminUserSelect) adminUserSelect.addEventListener('change', (event) => setSelectedAdminUser(event.target.value));
if (adminRefreshBtn) adminRefreshBtn.addEventListener('click', refreshAdminContributors);
if (adminExportSvgBtn) {
    adminExportSvgBtn.addEventListener('click', () => setExportSelectionMode(!(isExportSelectionMode && activeExportFormat === 'svg'), 'svg'));
}
if (adminExportJpgBtn) {
    adminExportJpgBtn.addEventListener('click', () => setExportSelectionMode(!(isExportSelectionMode && activeExportFormat === 'jpg'), 'jpg'));
}
if (adminTracingToggleBtn) {
    adminTracingToggleBtn.addEventListener('click', toggleTracingOverlay);
}
if (adminTracingInput) {
    adminTracingInput.addEventListener('change', (event) => handleTracingFile(event.target.files && event.target.files[0]));
}
if (adminTracingMoveBtn) {
    adminTracingMoveBtn.addEventListener('click', () => setTracingMoveMode(!isTracingMoveMode));
}
if (adminTracingClearBtn) {
    adminTracingClearBtn.addEventListener('click', () => closeTracingOverlay('Calco quitado. No se guardo en el lienzo.'));
}
if (adminTracingOpacitySlider) {
    adminTracingOpacitySlider.addEventListener('input', (event) => setTracingOpacity(event.target.value));
}
if (adminTracingScaleSlider) {
    adminTracingScaleSlider.addEventListener('input', (event) => setTracingScale(event.target.value));
}
if (undoBtn) undoBtn.addEventListener('click', undoLastAction);
if (undoFloatingBtn) undoFloatingBtn.addEventListener('click', undoLastAction);
if (redoBtn) redoBtn.addEventListener('click', redoLastAction);
if (redoFloatingBtn) redoFloatingBtn.addEventListener('click', redoLastAction);
eraserBtn.addEventListener('click', () => {
    if (!canEditCanvas()) {
        setLoginOverlayVisible(true);
        setLoginStatus('Inicia sesion con Google para editar el lienzo.');
        return;
    }

    isEraser = !isEraser;
    if (isEraser) {
        cancelExportSelectionMode();
        setTracingMoveMode(false);
        isPanMode = false;
        isFillMode = false;
        isEyedropperMode = false;
        isPressureBrushMode = false;
        isTextMode = false;
    }
    updateToolButtons();
});
if (paintBucketBtn) paintBucketBtn.addEventListener('click', () => setFillMode(!isFillMode));
if (eyedropperBtn) eyedropperBtn.addEventListener('click', () => setEyedropperMode(!isEyedropperMode));
colorPicker.addEventListener('change', () => {
    cancelExportSelectionMode();
    setTracingMoveMode(false);
    isEraser = false;
    isFillMode = false;
    isEyedropperMode = false;
    isTextMode = false;
    updateToolButtons();
});
clearBtn.addEventListener('click', () => {
    if (!canEditCanvas()) {
        setLoginOverlayVisible(true);
        setLoginStatus('Inicia sesion con Google para editar el lienzo.');
        return;
    }
    if (confirm('Limpiar todo el lienzo?')) socket.emit('clear');
});

if (minimapToggle && minimap) {
    minimapToggle.addEventListener('click', () => {
        setMinimapCollapsed(!minimap.classList.contains('collapsed'));
    });
}

if (minimapCanvas) {
    minimapCanvas.addEventListener('pointerdown', startMinimapNavigation);
    minimapCanvas.addEventListener('pointermove', moveMinimapNavigation);
    minimapCanvas.addEventListener('pointerup', stopMinimapNavigation);
    minimapCanvas.addEventListener('pointercancel', stopMinimapNavigation);
    minimapCanvas.addEventListener('lostpointercapture', stopMinimapNavigation);
}

if (minimapScroll) {
    minimapScroll.addEventListener('scroll', () => {
        if (!isMinimapAutoScrolling) lastMinimapManualScrollAt = Date.now();
        requestMinimapRender(true);
    }, { passive: true });
}

socket.on('connect', () => {
    statusDot.className = 'status-dot connected';
    statusText.innerText = 'Conectado';
    syncVisibleTiles();
});

socket.on('disconnect', () => {
    statusDot.className = 'status-dot';
    statusText.innerText = 'Desconectado';
});

socket.on('connect_error', (err) => {
    console.error('Error de conexion:', err.message);
    statusText.innerText = 'Error de conexion';
    statusDot.className = 'status-dot';
});

socket.on('write-denied', () => {
    setLoginOverlayVisible(true);
    setLoginStatus('Inicia sesion con Google para colaborar en el lienzo.');
    updateCanvasPermissions();
});

socket.on('world-init', (control) => {
    worldConfig = normalizeWorldConfig(control || worldConfig);
    invalidateAllTileRasters();
    minimapOverview = normalizeMinimapOverview({ ...minimapOverview, height: Math.max(minimapOverview.height || 0, worldConfig.height) });
    resizeMinimap();
    syncVisibleTiles();
});

socket.on('tile-draw-batch', (payload) => {
    const segments = payload && Array.isArray(payload.segments) ? payload.segments : [];
    addSegmentsToCache(segments);
    if (isAdminHighlightActive()) {
        const key = tileKey(Number(payload && payload.tileX) || 0, Number(payload && payload.tileY) || 0);
        if (adminLoadedTiles.has(key)) {
            const adminSegments = adminTileSegments.get(key) || [];
            for (const segment of assignSegmentOrders(segments)) {
                prepareSegmentForCache(segment);
                adminSegments.push(segment);
            }
            adminTileSegments.set(key, adminSegments);
        }
    }
    requestRender();
});

socket.on('tile-undo-segments', (payload) => {
    const orders = payload && Array.isArray(payload.orders) ? payload.orders : [];
    removeSegmentsFromCacheByOrders(orders);
    pruneUndoStackByOrders(orders);
});

socket.on('clear', () => {
    cancelActiveTileLoad();
    loadedTiles = new Set();
    loadingTiles = new Set();
    tileSegments = new Map();
    tileSegmentIdentitySets = new Map();
    tileSnapshots = new Map();
    tileSnapshotImages = new Map();
    invalidateAllTileRasters();
    adminTileSegments = new Map();
    adminLoadedTiles = new Set();
    adminLoadingTiles = new Set();
    undoStack = [];
    redoStack = [];
    activeUndoAction = null;
    renderSegments = [];
    markRenderSegmentsDirty();
    updateUndoButtons();
    loadMinimapOverview();
    requestRender();
    syncVisibleTiles();
});

async function boot() {
    await loadWorldConfig();
    setPanMode(true);
    applyInitialMinimapState();
    resizeCanvas();
    await loadMinimapOverview();
    if (minimapRefreshTimer) clearInterval(minimapRefreshTimer);
    minimapRefreshTimer = setInterval(loadMinimapOverview, MINIMAP_OVERVIEW_REFRESH_MS);
    await setupAuth();
    syncVisibleTiles();
}

boot();
updateUndoButtons();
