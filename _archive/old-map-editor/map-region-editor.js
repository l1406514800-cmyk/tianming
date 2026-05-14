// 地图地块编辑器 JavaScript
let bgCanvas, regionCanvas, drawCanvas;
let bgCtx, regionCtx, drawCtx;
let bgImage = null;
let mapData = { id: 'custom-map', name: '自定义地图', width: 1253, height: 837, regions: [] };
let currentRegion = { points: [], name: '', color: '#64c896', terrain: 'plains' };
let selectedRegionId = null;
let mode = 'draw'; // draw, edit, select, pan
let viewOffset = { x: 0, y: 0 };
let viewScale = 1;
let isDragging = false;
let dragStart = { x: 0, y: 0 };
let showGrid = false;

// 初始化
window.addEventListener('DOMContentLoaded', () => {
    bgCanvas = document.getElementById('bg-canvas');
    regionCanvas = document.getElementById('region-canvas');
    drawCanvas = document.getElementById('draw-canvas');

    bgCtx = bgCanvas.getContext('2d');
    regionCtx = regionCanvas.getContext('2d');
    drawCtx = drawCanvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 鼠标事件
    drawCanvas.addEventListener('mousedown', onMouseDown);
    drawCanvas.addEventListener('mousemove', onMouseMove);
    drawCanvas.addEventListener('mouseup', onMouseUp);
    drawCanvas.addEventListener('wheel', onWheel);

    // 键盘快捷键
    document.addEventListener('keydown', onKeyDown);

    setMode('draw');
    updateStatus('就绪 - 请加载地图或背景图片');
});

function resizeCanvas() {
    const container = document.getElementById('canvas-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    [bgCanvas, regionCanvas, drawCanvas].forEach(canvas => {
        canvas.width = width;
        canvas.height = height;
    });

    render();
}

function setMode(newMode) {
    mode = newMode;
    ['draw', 'edit', 'select', 'pan'].forEach(m => {
        const btn = document.getElementById(`btn-${m}`);
        if (btn) btn.style.background = m === newMode ? '#4CAF50' : '#666';
    });

    const cursor = {
        draw: 'crosshair',
        edit: 'pointer',
        select: 'pointer',
        pan: 'grab'
    }[newMode];
    drawCanvas.style.cursor = cursor;

    updateStatus(`模式: ${{'draw':'绘制','edit':'编辑','select':'选择','pan':'平移'}[newMode]}`);
}

// 坐标转换
function screenToWorld(x, y) {
    return {
        x: (x - viewOffset.x) / viewScale,
        y: (y - viewOffset.y) / viewScale
    };
}

function worldToScreen(x, y) {
    return {
        x: x * viewScale + viewOffset.x,
        y: y * viewScale + viewOffset.y
    };
}

// 鼠标事件
function onMouseDown(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldPos = screenToWorld(x, y);

    if (mode === 'draw') {
        currentRegion.points.push([Math.round(worldPos.x), Math.round(worldPos.y)]);
        render();
    } else if (mode === 'select') {
        selectRegionAt(worldPos.x, worldPos.y);
    } else if (mode === 'pan') {
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
        drawCanvas.style.cursor = 'grabbing';
    }
}

function onMouseMove(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const worldPos = screenToWorld(x, y);

    if (mode === 'pan' && isDragging) {
        viewOffset.x += e.clientX - dragStart.x;
        viewOffset.y += e.clientY - dragStart.y;
        dragStart = { x: e.clientX, y: e.clientY };
        render();
    }

    updateStatus(`坐标: (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`);
}

function onMouseUp(e) {
    if (mode === 'pan' && isDragging) {
        isDragging = false;
        drawCanvas.style.cursor = 'grab';
    }
}

function onWheel(e) {
    e.preventDefault();
    const rect = drawCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const oldScale = viewScale;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    viewScale = Math.max(0.1, Math.min(5, viewScale * delta));

    // 以鼠标位置为中心缩放
    viewOffset.x = x - (x - viewOffset.x) * (viewScale / oldScale);
    viewOffset.y = y - (y - viewOffset.y) * (viewScale / oldScale);

    document.getElementById('zoom-info').textContent = `缩放: ${Math.round(viewScale * 100)}%`;
    render();
}

function onKeyDown(e) {
    if (e.key === 'Escape') {
        clearCurrentRegion();
    } else if (e.key === 'Enter') {
        finishRegion();
    } else if (e.key === 'Delete') {
        deleteSelectedRegion();
    } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveMap();
    }
}

// 渲染
function render() {
    // 清空画布
    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    regionCtx.clearRect(0, 0, regionCanvas.width, regionCanvas.height);
    drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

    // 绘制背景图片
    if (bgImage) {
        bgCtx.save();
        bgCtx.translate(viewOffset.x, viewOffset.y);
        bgCtx.scale(viewScale, viewScale);
        bgCtx.drawImage(bgImage, 0, 0);
        bgCtx.restore();
    }

    // 绘制网格
    if (showGrid) {
        drawGrid();
    }

    // 绘制已有地块
    regionCtx.save();
    regionCtx.translate(viewOffset.x, viewOffset.y);
    regionCtx.scale(viewScale, viewScale);

    mapData.regions.forEach(region => {
        if (region.coords && region.coords.length >= 6) {
            regionCtx.fillStyle = region.color || '#64c896';
            regionCtx.globalAlpha = 0.3;
            regionCtx.beginPath();
            regionCtx.moveTo(region.coords[0], region.coords[1]);
            for (let i = 2; i < region.coords.length; i += 2) {
                regionCtx.lineTo(region.coords[i], region.coords[i + 1]);
            }
            regionCtx.closePath();
            regionCtx.fill();

            regionCtx.globalAlpha = 1;
            regionCtx.strokeStyle = region.id === selectedRegionId ? '#FFD700' : '#333';
            regionCtx.lineWidth = region.id === selectedRegionId ? 3 : 1;
            regionCtx.stroke();

            // 绘制中心点和名称
            if (region.center) {
                regionCtx.fillStyle = '#fff';
                regionCtx.font = '12px Arial';
                regionCtx.textAlign = 'center';
                regionCtx.fillText(region.name || `地块${region.id}`, region.center[0], region.center[1]);
            }
        }
    });

    regionCtx.restore();

    // 绘制当前正在绘制的地块
    if (currentRegion.points.length > 0) {
        drawCtx.save();
        drawCtx.translate(viewOffset.x, viewOffset.y);
        drawCtx.scale(viewScale, viewScale);

        drawCtx.strokeStyle = currentRegion.color;
        drawCtx.lineWidth = 2;
        drawCtx.beginPath();
        drawCtx.moveTo(currentRegion.points[0][0], currentRegion.points[0][1]);
        for (let i = 1; i < currentRegion.points.length; i++) {
            drawCtx.lineTo(currentRegion.points[i][0], currentRegion.points[i][1]);
        }
        drawCtx.stroke();

        // 绘制点
        currentRegion.points.forEach((point, i) => {
            drawCtx.fillStyle = i === 0 ? '#00FF00' : '#FF0000';
            drawCtx.beginPath();
            drawCtx.arc(point[0], point[1], 4, 0, Math.PI * 2);
            drawCtx.fill();
        });

        drawCtx.restore();
    }
}

function drawGrid() {
    drawCtx.save();
    drawCtx.translate(viewOffset.x, viewOffset.y);
    drawCtx.scale(viewScale, viewScale);

    drawCtx.strokeStyle = 'rgba(255,255,255,0.1)';
    drawCtx.lineWidth = 1;

    const gridSize = 50;
    for (let x = 0; x < mapData.width; x += gridSize) {
        drawCtx.beginPath();
        drawCtx.moveTo(x, 0);
        drawCtx.lineTo(x, mapData.height);
        drawCtx.stroke();
    }
    for (let y = 0; y < mapData.height; y += gridSize) {
        drawCtx.beginPath();
        drawCtx.moveTo(0, y);
        drawCtx.lineTo(mapData.width, y);
        drawCtx.stroke();
    }

    drawCtx.restore();
}

// 地块操作
function clearCurrentRegion() {
    currentRegion.points = [];
    render();
    updateStatus('已清除当前绘制');
}

function finishRegion() {
    if (currentRegion.points.length < 3) {
        alert('至少需要3个点才能形成地块');
        return;
    }

    // 计算中心点
    let sumX = 0, sumY = 0;
    currentRegion.points.forEach(p => {
        sumX += p[0];
        sumY += p[1];
    });
    const centerX = Math.round(sumX / currentRegion.points.length);
    const centerY = Math.round(sumY / currentRegion.points.length);

    // 转换为coords格式
    const coords = [];
    currentRegion.points.forEach(p => {
        coords.push(p[0], p[1]);
    });

    const newRegion = {
        id: mapData.regions.length + 1,
        name: currentRegion.name || `地块${mapData.regions.length + 1}`,
        coords: coords,
        center: [centerX, centerY],
        color: currentRegion.color,
        owner: '',
        terrain: currentRegion.terrain,
        resources: [],
        development: 50,
        troops: 0,
        characters: [],
        neighbors: []
    };

    mapData.regions.push(newRegion);
    currentRegion.points = [];
    updateRegionList();
    render();
    updateStatus(`已添加地块: ${newRegion.name}`);
}

function deleteSelectedRegion() {
    if (selectedRegionId === null) {
        alert('请先选择一个地块');
        return;
    }

    const index = mapData.regions.findIndex(r => r.id === selectedRegionId);
    if (index !== -1) {
        const name = mapData.regions[index].name;
        mapData.regions.splice(index, 1);
        selectedRegionId = null;
        updateRegionList();
        render();
        updateStatus(`已删除地块: ${name}`);
    }
}

function selectRegionAt(x, y) {
    for (let i = mapData.regions.length - 1; i >= 0; i--) {
        const region = mapData.regions[i];
        if (isPointInRegion(x, y, region)) {
            selectedRegionId = region.id;
            document.getElementById('region-name').value = region.name;
            document.getElementById('region-color').value = region.color;
            document.getElementById('region-terrain').value = region.terrain;
            updateRegionList();
            render();
            updateStatus(`已选择: ${region.name}`);
            return;
        }
    }
    selectedRegionId = null;
    updateRegionList();
    render();
}

function isPointInRegion(x, y, region) {
    if (!region.coords || region.coords.length < 6) return false;

    let inside = false;
    for (let i = 0, j = region.coords.length - 2; i < region.coords.length; i += 2) {
        const xi = region.coords[i], yi = region.coords[i + 1];
        const xj = region.coords[j], yj = region.coords[j + 1];

        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
        j = i;
    }
    return inside;
}

function applyRegionProperties() {
    const name = document.getElementById('region-name').value;
    const color = document.getElementById('region-color').value;
    const terrain = document.getElementById('region-terrain').value;

    if (selectedRegionId !== null) {
        const region = mapData.regions.find(r => r.id === selectedRegionId);
        if (region) {
            region.name = name;
            region.color = color;
            region.terrain = terrain;
            updateRegionList();
            render();
            updateStatus(`已更新地块属性: ${name}`);
        }
    } else {
        currentRegion.name = name;
        currentRegion.color = color;
        currentRegion.terrain = terrain;
        updateStatus('已设置当前地块属性');
    }
}

function updateRegionList() {
    const list = document.getElementById('region-list');
    list.innerHTML = '';

    mapData.regions.forEach(region => {
        const item = document.createElement('div');
        item.className = 'region-item' + (region.id === selectedRegionId ? ' selected' : '');
        item.innerHTML = `
            <span>${region.name}</span>
            <div class="region-color" style="background: ${region.color}"></div>
        `;
        item.onclick = () => {
            selectedRegionId = region.id;
            document.getElementById('region-name').value = region.name;
            document.getElementById('region-color').value = region.color;
            document.getElementById('region-terrain').value = region.terrain;
            updateRegionList();
            render();
        };
        list.appendChild(item);
    });

    document.getElementById('region-count').textContent = mapData.regions.length;
}

// 文件操作
function loadMap() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            try {
                mapData = JSON.parse(event.target.result);
                updateRegionList();
                render();
                updateStatus(`已加载地图: ${mapData.name} (${mapData.regions.length}个地块)`);
            } catch (err) {
                alert('加载失败: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function loadImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = e => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = event => {
            bgImage = new Image();
            bgImage.onload = () => {
                mapData.width = bgImage.width;
                mapData.height = bgImage.height;
                resetView();
                updateStatus(`已加载图片: ${bgImage.width}x${bgImage.height}`);
            };
            bgImage.src = event.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function saveMap() {
    try { localStorage.setItem('map-editor-data', JSON.stringify(mapData)); } catch(_){}
    updateStatus('已保存到浏览器本地存储');
}

function exportMap() {
    const json = JSON.stringify(mapData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mapData.id || 'map'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    updateStatus('已导出JSON文件');
}

// 视图控制
function zoomIn() {
    viewScale = Math.min(5, viewScale * 1.2);
    document.getElementById('zoom-info').textContent = `缩放: ${Math.round(viewScale * 100)}%`;
    render();
}

function zoomOut() {
    viewScale = Math.max(0.1, viewScale / 1.2);
    document.getElementById('zoom-info').textContent = `缩放: ${Math.round(viewScale * 100)}%`;
    render();
}

function resetView() {
    viewScale = 1;
    viewOffset = { x: 0, y: 0 };
    document.getElementById('zoom-info').textContent = '缩放: 100%';
    render();
}

function toggleGrid() {
    showGrid = !showGrid;
    render();
    updateStatus(showGrid ? '已显示网格' : '已隐藏网格');
}

function updateStatus(msg) {
    document.getElementById('status').textContent = msg;
}
