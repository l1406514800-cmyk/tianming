// 智能地图编辑器 - EU4级别操作体验
// map-editor-smart.js

// 全局状态
const EDITOR = {
    canvas: null,
    ctx: null,
    width: 1200,
    height: 800,

    // 地图数据
    backgroundImage: null,
    backgroundOpacity: 0.5,
    regions: [],
    selectedRegion: null,
    hoveredRegion: null,

    // Voronoi 数据
    seeds: [],
    voronoi: null,
    delaunay: null,

    // 视图状态
    view: {
        offsetX: 0,
        offsetY: 0,
        scale: 1.0,
        minScale: 0.1,
        maxScale: 5.0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0
    },

    // 工具状态
    currentTool: 'select',

    // 历史记录
    history: {
        undoStack: [],
        redoStack: [],
        maxSize: 50
    },

    // 渲染缓存
    needsRedraw: true,

    // 小地图
    minimap: {
        canvas: null,
        ctx: null,
        needsUpdate: true
    },

    // 自定义字段定义
    customFields: [
        // 默认字段示例
        // { name: 'customField1', label: '自定义字段1', type: 'text', defaultValue: '' }
    ],

    // 显示邻接关系
    showNeighbors: false,

    // 势力颜色映射
    factionColors: {
        // 势力名: 颜色
        // 例如: '蜀汉': '#ff6b6b'
    }
};

// 地形类型
const TERRAIN_TYPES = {
    plains: { name: '\u5e73\u539f', color: '#90EE90', icon: '\ud83c\udf3e' },
    mountains: { name: '\u5c71\u5730', color: '#8B4513', icon: '\u26f0\ufe0f' },
    forest: { name: '\u68ee\u6797', color: '#228B22', icon: '\ud83c\udf32' },
    desert: { name: '\u6c99\u6f20', color: '#F4A460', icon: '\ud83c\udfdc\ufe0f' },
    grassland: { name: '\u8349\u539f', color: '#7CFC00', icon: '\ud83c\udf3f' },
    hills: { name: '\u4e18\u9675', color: '#CD853F', icon: '\u26f0\ufe0f' },
    water: { name: '\u6c34\u57df', color: '#4682B4', icon: '\ud83d\udca7' },
    swamp: { name: '\u6cbc\u6cfd', color: '#556B2F', icon: '\ud83c\udf3e' },
    ocean: { name: '\u6d77\u6d0b', color: '#1E90FF', icon: '\ud83c\udf0a' }
};

// ============================================================
// 初始化
// ============================================================

window.addEventListener('DOMContentLoaded', function() {
    initEditor();
});

function initEditor() {
    // 初始化 Canvas
    EDITOR.canvas = document.getElementById('map-canvas');
    EDITOR.ctx = EDITOR.canvas.getContext('2d');

    // 设置 Canvas 尺寸
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // 初始化小地图
    EDITOR.minimap.canvas = document.getElementById('minimap-canvas');
    EDITOR.minimap.ctx = EDITOR.minimap.canvas.getContext('2d');
    EDITOR.minimap.canvas.width = 200;
    EDITOR.minimap.canvas.height = 150;

    // 绑定事件
    bindEvents();

    // 初始化地形选择器
    initTerrainSelector();

    // 初始化自定义字段列表
    renderCustomFieldsList();

    // 开始渲染循环
    requestAnimationFrame(renderLoop);

    console.log('\u667a\u80fd\u5730\u56fe\u7f16\u8f91\u5668\u521d\u59cb\u5316\u5b8c\u6210');
}

function resizeCanvas() {
    const container = document.getElementById('map-container');
    EDITOR.canvas.width = container.clientWidth;
    EDITOR.canvas.height = container.clientHeight;
    EDITOR.needsRedraw = true;
}

// ============================================================
// 事件绑定
// ============================================================

function bindEvents() {
    const canvas = EDITOR.canvas;

    // 鼠标事件
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('wheel', onMouseWheel, { passive: false });
    canvas.addEventListener('contextmenu', onContextMenu);

    // 键盘事件
    EDITOR._spacePressed = false;
    document.addEventListener('keydown', function(e) {
        if (e.code === 'Space') EDITOR._spacePressed = true;
        onKeyDown(e);
    });
    document.addEventListener('keyup', function(e) {
        if (e.code === 'Space') EDITOR._spacePressed = false;
    });

    // 隐藏右键菜单
    document.addEventListener('click', function() {
        document.getElementById('context-menu').style.display = 'none';
    });
}

function onMouseDown(e) {
    const rect = EDITOR.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // 中键或右键直接拖动
    if (e.button === 1 || e.button === 2) {
        e.preventDefault();
        EDITOR.view.isDragging = true;
        EDITOR.view.dragStartX = x;
        EDITOR.view.dragStartY = y;
        EDITOR.canvas.style.cursor = 'grabbing';
        return;
    }

    if (e.button === 0) { // 左键
        if (EDITOR.currentTool === 'pan' || e.shiftKey || EDITOR._spacePressed) {
            // 平移模式
            EDITOR.view.isDragging = true;
            EDITOR.view.dragStartX = x;
            EDITOR.view.dragStartY = y;
            EDITOR.canvas.style.cursor = 'grabbing';
        } else if (EDITOR.currentTool === 'select') {
            const worldPos = screenToWorld(x, y);
            const region = findRegionAt(worldPos.x, worldPos.y);
            selectRegion(region);
        }
    }
}

function onMouseMove(e) {
    const rect = EDITOR.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (EDITOR.view.isDragging) {
        const dx = x - EDITOR.view.dragStartX;
        const dy = y - EDITOR.view.dragStartY;

        EDITOR.view.offsetX += dx;
        EDITOR.view.offsetY += dy;

        EDITOR.view.dragStartX = x;
        EDITOR.view.dragStartY = y;

        EDITOR.needsRedraw = true;
    } else {
        // 悬停高亮
        const worldPos = screenToWorld(x, y);
        const region = findRegionAt(worldPos.x, worldPos.y);

        if (region !== EDITOR.hoveredRegion) {
            EDITOR.hoveredRegion = region;
            EDITOR.needsRedraw = true;

            if (region) {
                EDITOR.canvas.style.cursor = 'pointer';
            } else {
                EDITOR.canvas.style.cursor = EDITOR.currentTool === 'pan' ? 'grab' : 'crosshair';
            }
        }
    }
}

function onMouseUp(e) {
    if (EDITOR.view.isDragging) {
        EDITOR.view.isDragging = false;
        EDITOR.canvas.style.cursor = EDITOR.currentTool === 'pan' ? 'grab' : 'crosshair';
    }
}

function onMouseWheel(e) {
    e.preventDefault();

    const rect = EDITOR.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(EDITOR.view.minScale, Math.min(EDITOR.view.maxScale, EDITOR.view.scale * delta));

    if (newScale !== EDITOR.view.scale) {
        // 缩放到鼠标位置
        const worldBefore = screenToWorld(x, y);
        EDITOR.view.scale = newScale;
        const worldAfter = screenToWorld(x, y);

        EDITOR.view.offsetX += (worldAfter.x - worldBefore.x) * EDITOR.view.scale;
        EDITOR.view.offsetY += (worldAfter.y - worldBefore.y) * EDITOR.view.scale;

        EDITOR.needsRedraw = true;
        updateZoomLevel();
    }
}

function onContextMenu(e) {
    e.preventDefault();

    const rect = EDITOR.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const worldPos = screenToWorld(x, y);
    const region = findRegionAt(worldPos.x, worldPos.y);

    if (region) {
        selectRegion(region);
        showContextMenu(e.clientX, e.clientY);
    }
}

function onKeyDown(e) {
    // Ctrl+S: 保存
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        exportMap();
    }
    // Ctrl+Z: 撤销
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    // Ctrl+Y: 重做
    if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
    }
    // V: 选择工具
    if (e.key === 'v' || e.key === 'V') {
        setTool('select');
    }
    // H: 平移工具
    if (e.key === 'h' || e.key === 'H') {
        setTool('pan');
    }
    // Delete: 删除选中
    if (e.key === 'Delete' && EDITOR.selectedRegion) {
        deleteRegion();
    }
}

// ============================================================
// 坐标转换
// ============================================================

function screenToWorld(screenX, screenY) {
    return {
        x: (screenX - EDITOR.view.offsetX) / EDITOR.view.scale,
        y: (screenY - EDITOR.view.offsetY) / EDITOR.view.scale
    };
}

function worldToScreen(worldX, worldY) {
    return {
        x: worldX * EDITOR.view.scale + EDITOR.view.offsetX,
        y: worldY * EDITOR.view.scale + EDITOR.view.offsetY
    };
}

// ============================================================
// 渲染循环
// ============================================================

function renderLoop() {
    if (EDITOR.needsRedraw) {
        render();
        EDITOR.needsRedraw = false;
    }

    if (EDITOR.minimap.needsUpdate) {
        renderMinimap();
        EDITOR.minimap.needsUpdate = false;
    }

    requestAnimationFrame(renderLoop);
}

function render() {
    const ctx = EDITOR.ctx;
    const canvas = EDITOR.canvas;

    // 清空画布 - 使用更柔和的背景色
    const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGradient.addColorStop(0, '#1a1a2e');
    bgGradient.addColorStop(1, '#16213e');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(EDITOR.view.offsetX, EDITOR.view.offsetY);
    ctx.scale(EDITOR.view.scale, EDITOR.view.scale);

    // 绘制背景图
    if (EDITOR.backgroundImage) {
        ctx.globalAlpha = EDITOR.backgroundOpacity;
        ctx.drawImage(EDITOR.backgroundImage, 0, 0, EDITOR.width, EDITOR.height);
        ctx.globalAlpha = 1.0;
    }

    // 绘制地块
    EDITOR.regions.forEach(function(region) {
        drawRegion(ctx, region, false);
    });

    // 绘制邻接关系线
    if (EDITOR.showNeighbors && EDITOR.selectedRegion) {
        drawNeighborLines(ctx, EDITOR.selectedRegion);
    }

    // 绘制悬停高亮
    if (EDITOR.hoveredRegion && EDITOR.hoveredRegion !== EDITOR.selectedRegion) {
        drawRegion(ctx, EDITOR.hoveredRegion, true, 'hover');
    }

    // 绘制选中高亮
    if (EDITOR.selectedRegion) {
        drawRegion(ctx, EDITOR.selectedRegion, true, 'selected');
    }

    // 绘制标签
    if (document.getElementById('show-labels').checked) {
        EDITOR.regions.forEach(function(region) {
            drawLabel(ctx, region);
        });
    }

    ctx.restore();
}

function drawRegion(ctx, region, highlight, type) {
    if (!region.coords || region.coords.length < 6) return;

    ctx.beginPath();
    ctx.moveTo(region.coords[0], region.coords[1]);
    for (let i = 2; i < region.coords.length; i += 2) {
        ctx.lineTo(region.coords[i], region.coords[i + 1]);
    }
    ctx.closePath();

    if (!highlight) {
        // 正常绘制 - 根据所属势力决定颜色
        let fillColor;

        if (region.owner && EDITOR.factionColors[region.owner]) {
            // 如果有所属势力且势力有颜色，使用势力颜色
            fillColor = EDITOR.factionColors[region.owner];
        } else if (region.owner && !EDITOR.factionColors[region.owner]) {
            // 如果有所属势力但没有设置颜色，生成一个随机颜色并保存
            fillColor = generateFactionColor(region.owner);
            EDITOR.factionColors[region.owner] = fillColor;
        } else if (region.color) {
            // 如果没有势力但有自定义颜色，使用自定义颜色
            fillColor = region.color;
        } else {
            // 否则使用地形颜色
            const terrain = TERRAIN_TYPES[region.terrain] || TERRAIN_TYPES.plains;
            fillColor = terrain.color;
        }

        // 添加渐变效果，让地图更有立体感
        const bounds = getRegionBounds(region);
        const gradient = ctx.createLinearGradient(
            bounds.minX, bounds.minY,
            bounds.maxX, bounds.maxY
        );

        // 解析颜色并创建渐变
        const baseColor = parseColor(fillColor);
        const lightColor = lightenColor(baseColor, 0.15);
        const darkColor = darkenColor(baseColor, 0.1);

        gradient.addColorStop(0, lightColor);
        gradient.addColorStop(0.5, fillColor);
        gradient.addColorStop(1, darkColor);

        ctx.fillStyle = gradient;
        ctx.globalAlpha = 0.85;
        ctx.fill();
        ctx.globalAlpha = 1.0;

        // 绘制边界 - 更粗更明显
        if (document.getElementById('show-borders').checked) {
            ctx.strokeStyle = '#2a2a2a';
            ctx.lineWidth = 2 / EDITOR.view.scale;
            ctx.stroke();

            // 添加内阴影效果
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.lineWidth = 1 / EDITOR.view.scale;
            ctx.stroke();
        }
    } else {
        // 高亮绘制
        if (type === 'hover') {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 3 / EDITOR.view.scale;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 10 / EDITOR.view.scale;
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else if (type === 'selected') {
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 4 / EDITOR.view.scale;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 15 / EDITOR.view.scale;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // 绘制顶点
            for (let i = 0; i < region.coords.length; i += 2) {
                ctx.fillStyle = '#ffd700';
                ctx.shadowColor = '#ffd700';
                ctx.shadowBlur = 5 / EDITOR.view.scale;
                ctx.beginPath();
                ctx.arc(region.coords[i], region.coords[i + 1], 5 / EDITOR.view.scale, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
    }

    // 绘制标签 - 更好的可读性
    if (document.getElementById('show-labels').checked && region.center) {
        const fontSize = 14 / EDITOR.view.scale;
        ctx.font = `bold ${fontSize}px "Microsoft YaHei", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // 文字阴影
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4 / EDITOR.view.scale;
        ctx.shadowOffsetX = 1 / EDITOR.view.scale;
        ctx.shadowOffsetY = 1 / EDITOR.view.scale;

        ctx.fillStyle = '#ffffff';
        ctx.fillText(region.name, region.center[0], region.center[1]);

        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    }
}

// 辅助函数：获取区域边界
function getRegionBounds(region) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (let i = 0; i < region.coords.length; i += 2) {
        minX = Math.min(minX, region.coords[i]);
        maxX = Math.max(maxX, region.coords[i]);
        minY = Math.min(minY, region.coords[i + 1]);
        maxY = Math.max(maxY, region.coords[i + 1]);
    }

    return { minX, minY, maxX, maxY };
}

// 辅助函数：解析颜色
function parseColor(colorStr) {
    if (colorStr.startsWith('#')) {
        return hexToRgbObj(colorStr);
    } else if (colorStr.startsWith('rgb')) {
        const match = colorStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            return {
                r: parseInt(match[1]),
                g: parseInt(match[2]),
                b: parseInt(match[3])
            };
        }
    }
    return { r: 100, g: 100, b: 100 };
}

// 辅助函数：HEX转RGB对象
function hexToRgbObj(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 100, g: 100, b: 100 };
}

// 辅助函数：变亮颜色
function lightenColor(color, amount) {
    const r = Math.min(255, Math.round(color.r + (255 - color.r) * amount));
    const g = Math.min(255, Math.round(color.g + (255 - color.g) * amount));
    const b = Math.min(255, Math.round(color.b + (255 - color.b) * amount));
    return `rgb(${r},${g},${b})`;
}

// 辅助函数：变暗颜色
function darkenColor(color, amount) {
    const r = Math.max(0, Math.round(color.r * (1 - amount)));
    const g = Math.max(0, Math.round(color.g * (1 - amount)));
    const b = Math.max(0, Math.round(color.b * (1 - amount)));
    return `rgb(${r},${g},${b})`;
}

// 生成势力颜色
function generateFactionColor(factionName) {
    // 使用势力名称生成一个稳定的颜色
    let hash = 0;
    for (let i = 0; i < factionName.length; i++) {
        hash = factionName.charCodeAt(i) + ((hash << 5) - hash);
    }

    // 生成饱和度较高的颜色
    const hue = Math.abs(hash % 360);
    const saturation = 60 + (Math.abs(hash >> 8) % 30); // 60-90%
    const lightness = 45 + (Math.abs(hash >> 16) % 15); // 45-60%

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// 编辑势力颜色
function editFactionColor(factionName) {
    const currentColor = EDITOR.factionColors[factionName] || generateFactionColor(factionName);

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:#1a1a1a;padding:24px;border-radius:8px;border:1px solid #444;min-width:300px;">
            <h3 style="color:#ffd700;margin-bottom:16px;">设置势力颜色：${factionName}</h3>
            <div style="margin-bottom:16px;">
                <label style="display:block;color:#aaa;font-size:12px;margin-bottom:8px;">选择颜色</label>
                <input type="color" id="faction-color-picker" value="${rgbToHex(currentColor)}" style="width:100%;height:50px;border:1px solid #333;border-radius:4px;cursor:pointer;">
            </div>
            <div style="display:flex;gap:8px;">
                <button id="confirm-color" style="flex:1;padding:10px;background:#ffd700;border:none;color:#1a1a1a;border-radius:4px;cursor:pointer;font-weight:600;">确定</button>
                <button id="cancel-color" style="flex:1;padding:10px;background:#444;border:none;color:#fff;border-radius:4px;cursor:pointer;">取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('confirm-color').onclick = () => {
        const newColor = document.getElementById('faction-color-picker').value;
        EDITOR.factionColors[factionName] = newColor;

        // 刷新显示
        if (EDITOR.selectedRegion && EDITOR.selectedRegion.owner === factionName) {
            showRegionProperties(EDITOR.selectedRegion);
        }
        EDITOR.needsRedraw = true;

        document.body.removeChild(modal);
    };

    document.getElementById('cancel-color').onclick = () => {
        document.body.removeChild(modal);
    };
}

function drawNeighborLines(ctx, region) {
    if (!region.neighbors || region.neighbors.length === 0) return;
    if (!region.center) return;

    ctx.save();
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2 / EDITOR.view.scale;
    ctx.setLineDash([5 / EDITOR.view.scale, 5 / EDITOR.view.scale]);

    region.neighbors.forEach(neighborId => {
        const neighbor = EDITOR.regions.find(r => r.id === neighborId);
        if (neighbor && neighbor.center) {
            ctx.beginPath();
            ctx.moveTo(region.center[0], region.center[1]);
            ctx.lineTo(neighbor.center[0], neighbor.center[1]);
            ctx.stroke();

            // 在邻居中心绘制小圆点
            ctx.fillStyle = '#00ff00';
            ctx.beginPath();
            ctx.arc(neighbor.center[0], neighbor.center[1], 4 / EDITOR.view.scale, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    ctx.restore();
}

function drawLabel(ctx, region) {
    if (!region.center) return;

    ctx.save();
    ctx.scale(1 / EDITOR.view.scale, 1 / EDITOR.view.scale);

    const screenPos = worldToScreen(region.center[0], region.center[1]);

    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // 背景
    const metrics = ctx.measureText(region.name);
    const padding = 4;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(
        screenPos.x - metrics.width / 2 - padding,
        screenPos.y - 6 - padding,
        metrics.width + padding * 2,
        12 + padding * 2
    );

    // 文字
    ctx.fillStyle = '#ffd700';
    ctx.fillText(region.name, screenPos.x, screenPos.y);

    ctx.restore();
}

function renderMinimap() {
    const ctx = EDITOR.minimap.ctx;
    const canvas = EDITOR.minimap.canvas;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (EDITOR.regions.length === 0) return;

    const scaleX = canvas.width / EDITOR.width;
    const scaleY = canvas.height / EDITOR.height;
    const scale = Math.min(scaleX, scaleY);

    ctx.save();
    ctx.scale(scale, scale);

    EDITOR.regions.forEach(function(region) {
        if (!region.coords || region.coords.length < 6) return;

        ctx.beginPath();
        ctx.moveTo(region.coords[0], region.coords[1]);
        for (let i = 2; i < region.coords.length; i += 2) {
            ctx.lineTo(region.coords[i], region.coords[i + 1]);
        }
        ctx.closePath();

        const terrain = TERRAIN_TYPES[region.terrain] || TERRAIN_TYPES.plains;
        ctx.fillStyle = terrain.color;
        ctx.fill();

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    });

    ctx.restore();
}

// ============================================================
// 地块查找
// ============================================================

function findRegionAt(x, y) {
    for (let i = EDITOR.regions.length - 1; i >= 0; i--) {
        const region = EDITOR.regions[i];
        if (pointInRegion(x, y, region)) {
            return region;
        }
    }
    return null;
}

function pointInRegion(x, y, region) {
    if (!region.coords || region.coords.length < 6) return false;

    const polygon = [];
    for (let i = 0; i < region.coords.length; i += 2) {
        polygon.push([region.coords[i], region.coords[i + 1]]);
    }

    return pointInPolygon(x, y, polygon);
}

function pointInPolygon(x, y, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];

        const intersect = ((yi > y) !== (yj > y)) &&
            (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

// ============================================================
// 地块选择和编辑
// ============================================================

function selectRegion(region) {
    EDITOR.selectedRegion = region;
    EDITOR.needsRedraw = true;

    if (region) {
        showRegionProperties(region);
    } else {
        document.getElementById('region-properties').innerHTML = '<p style="color: #888; font-size: 13px;">\u9009\u62e9\u4e00\u4e2a\u5730\u5757\u4ee5\u7f16\u8f91\u5c5e\u6027</p>';
    }

    updateStatusBar();
}

function showRegionProperties(region) {
    // 基础字段
    let html = `
        <div class="input-group">
            <label>地块名称</label>
            <input type="text" id="prop-name" value="${region.name}" onchange="updateRegionProperty('name')">
        </div>
        <div class="input-group">
            <label>地块颜色（无主时使用）</label>
            <div style="display:flex;gap:8px;align-items:center;">
                <input type="color" id="prop-color" value="${rgbToHex(region.color || '#90EE90')}" onchange="updateRegionProperty('color')" style="width:60px;height:36px;border:1px solid #333;border-radius:4px;cursor:pointer;">
                <input type="text" id="prop-color-text" value="${region.color || ''}" onchange="updateRegionColorFromText()" style="flex:1;" placeholder="rgb(r,g,b) 或 #hex">
                <button onclick="resetRegionColor()" style="padding:8px 12px;background:#444;border:1px solid #666;color:#fff;border-radius:4px;cursor:pointer;font-size:11px;">重置</button>
            </div>
            <p style="font-size:11px;color:#888;margin-top:4px;">用于海洋、无主地等。有势力时自动使用势力颜色</p>
        </div>
        <div class="input-group">
            <label>所属势力</label>
            <div style="display:flex;gap:8px;align-items:center;">
                <input type="text" id="prop-owner" value="${region.owner || ''}" onchange="updateRegionProperty('owner')" placeholder="如：蜀汉、曹魏" style="flex:1;">
                ${region.owner ? `<button onclick="editFactionColor('${region.owner}')" style="padding:8px 12px;background:${EDITOR.factionColors[region.owner] || generateFactionColor(region.owner)};border:1px solid #666;color:#fff;border-radius:4px;cursor:pointer;font-size:11px;min-width:60px;">势力颜色</button>` : ''}
            </div>
            ${region.owner ? `<p style="font-size:11px;color:#888;margin-top:4px;">当前势力颜色：<span style="display:inline-block;width:40px;height:16px;background:${EDITOR.factionColors[region.owner] || generateFactionColor(region.owner)};border:1px solid #666;vertical-align:middle;"></span> （游戏中会动态跟随势力变化）</p>` : '<p style="font-size:11px;color:#888;margin-top:4px;">无主地块，使用上方设置的地块颜色</p>'}
        </div>
        <div class="input-group">
            <label>文化</label>
            <input type="text" id="prop-culture" value="${region.culture || ''}" onchange="updateRegionProperty('culture')" placeholder="如：汉、蒙古、满">
        </div>
        <div class="input-group">
            <label>宗教</label>
            <input type="text" id="prop-religion" value="${region.religion || ''}" onchange="updateRegionProperty('religion')" placeholder="如：儒教、佛教、道教">
        </div>
        <div class="input-group">
            <label>人口（万人）</label>
            <input type="number" id="prop-population" value="${region.population || 0}" onchange="updateRegionProperty('population')" min="0">
        </div>
        <div class="input-group">
            <label>发展度 (${region.development || 50})</label>
            <input type="range" id="prop-development" min="0" max="100" value="${region.development || 50}" oninput="updateRegionProperty('development')">
        </div>
        <div class="input-group">
            <label>繁荣度 (${region.prosperity || 0})</label>
            <input type="range" id="prop-prosperity" min="0" max="100" value="${region.prosperity || 0}" oninput="updateRegionProperty('prosperity')">
        </div>
        <div class="input-group">
            <label>驻军</label>
            <input type="number" id="prop-troops" value="${region.troops || 0}" onchange="updateRegionProperty('troops')" min="0">
        </div>
        <div class="input-group">
            <label>要塞等级</label>
            <input type="number" id="prop-fort" value="${region.fort || 0}" onchange="updateRegionProperty('fort')" min="0" max="10">
        </div>
        <div class="input-group">
            <label>资源（逗号分隔）</label>
            <input type="text" id="prop-resources" value="${(region.resources || []).join(', ')}" onchange="updateRegionProperty('resources')" placeholder="如：铁矿、粮食、丝绸">
        </div>
        <div class="input-group">
            <label>特殊建筑</label>
            <input type="text" id="prop-buildings" value="${(region.buildings || []).join(', ')}" onchange="updateRegionProperty('buildings')" placeholder="如：书院、兵营、市场">
        </div>
        <div class="input-group">
            <label>历史事件</label>
            <textarea id="prop-history" rows="3" onchange="updateRegionProperty('history')" placeholder="记录重要历史事件">${region.history || ''}</textarea>
        </div>
        <div class="input-group">
            <label>税收</label>
            <div style="display:flex;gap:8px;">
                <input type="number" id="prop-tax" value="${region.tax || 0}" onchange="updateRegionProperty('tax')" min="0" style="flex:1;">
                <input type="text" id="prop-tax-unit" value="${region.taxUnit || '金'}" onchange="updateRegionProperty('taxUnit')" placeholder="单位" style="width:60px;">
            </div>
            <p style="font-size:11px;color:#888;margin-top:4px;">单位应与剧本变量中的钱币单位一致</p>
        </div>
        <div class="input-group">
            <label>自治度 (${region.autonomy || 0}%)</label>
            <input type="range" id="prop-autonomy" min="0" max="100" value="${region.autonomy || 0}" oninput="updateRegionProperty('autonomy')">
        </div>
        <div class="input-group">
            <label>
                <input type="checkbox" id="prop-capital" ${region.isCapital ? 'checked' : ''} onchange="updateRegionProperty('isCapital')">
                首都/中心
            </label>
        </div>
        <div class="input-group">
            <label>
                <input type="checkbox" id="prop-coastal" ${region.isCoastal ? 'checked' : ''} onchange="updateRegionProperty('isCoastal')">
                沿海省份
            </label>
        </div>
    `;

    // 邻接关系
    html += `
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #333;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h4 style="color:#ffd700;font-size:13px;margin:0;">邻接关系</h4>
                <button onclick="toggleNeighborsVisibility()" style="padding:4px 8px;background:#444;border:1px solid #666;color:#fff;border-radius:4px;cursor:pointer;font-size:11px;">
                    ${EDITOR.showNeighbors ? '隐藏' : '显示'}
                </button>
            </div>
            <div id="neighbors-list" style="max-height:200px;overflow-y:auto;">
    `;

    if (region.neighbors && region.neighbors.length > 0) {
        region.neighbors.forEach((neighborId, index) => {
            const neighbor = EDITOR.regions.find(r => r.id === neighborId);
            const neighborName = neighbor ? neighbor.name : neighborId;
            html += `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px;background:#1a1a1a;border:1px solid #333;border-radius:4px;margin-bottom:4px;">
                    <span style="font-size:12px;">${neighborName}</span>
                    <button onclick="removeNeighbor('${neighborId}')" style="padding:2px 6px;background:#e74c3c;border:none;color:#fff;border-radius:3px;cursor:pointer;font-size:10px;">删除</button>
                </div>
            `;
        });
    } else {
        html += '<p style="color:#888;font-size:12px;">暂无邻接地块</p>';
    }

    html += `
            </div>
            <button onclick="addNeighbor()" style="width:100%;margin-top:8px;padding:8px;background:#2a2a2a;border:1px solid #444;color:#ffd700;border-radius:4px;cursor:pointer;font-size:12px;">+ 添加邻接地块</button>
        </div>
    `;

    // 添加自定义字段
    if (EDITOR.customFields.length > 0) {
        html += '<div style="margin-top:16px;padding-top:16px;border-top:1px solid #333;"><h4 style="color:#ffd700;font-size:13px;margin-bottom:12px;">自定义字段</h4>';

        EDITOR.customFields.forEach(field => {
            html += '<div class="input-group">';
            html += `<label>${field.label}</label>`;

            const value = region[field.name] !== undefined ? region[field.name] : field.defaultValue;

            switch(field.type) {
                case 'text':
                    html += `<input type="text" id="prop-custom-${field.name}" value="${value}" onchange="updateCustomField('${field.name}')">`;
                    break;
                case 'number':
                    html += `<input type="number" id="prop-custom-${field.name}" value="${value}" onchange="updateCustomField('${field.name}')">`;
                    break;
                case 'textarea':
                    html += `<textarea id="prop-custom-${field.name}" rows="3" onchange="updateCustomField('${field.name}')">${value}</textarea>`;
                    break;
                case 'checkbox':
                    html += `<label><input type="checkbox" id="prop-custom-${field.name}" ${value ? 'checked' : ''} onchange="updateCustomField('${field.name}')">${field.label}</label>`;
                    break;
                case 'select':
                    html += `<select id="prop-custom-${field.name}" onchange="updateCustomField('${field.name}')">`;
                    if (field.options) {
                        field.options.forEach(opt => {
                            html += `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`;
                        });
                    }
                    html += '</select>';
                    break;
            }

            html += '</div>';
        });

        html += '</div>';
    }

    document.getElementById('region-properties').innerHTML = html;
}

function updateRegionProperty(propName) {
    if (!EDITOR.selectedRegion) return;

    const element = document.getElementById('prop-' + propName);
    if (!element) return;

    switch(propName) {
        case 'name':
        case 'owner':
        case 'culture':
        case 'religion':
        case 'history':
        case 'taxUnit':
            EDITOR.selectedRegion[propName] = element.value;
            // 如果修改了owner，刷新属性面板以显示势力颜色按钮
            if (propName === 'owner') {
                showRegionProperties(EDITOR.selectedRegion);
            }
            break;

        case 'color':
            // 从颜色选择器更新
            const hex = element.value;
            EDITOR.selectedRegion.color = hex;
            // 同步更新文本框
            const textInput = document.getElementById('prop-color-text');
            if (textInput) textInput.value = hex;
            break;

        case 'population':
        case 'troops':
        case 'fort':
        case 'tax':
            EDITOR.selectedRegion[propName] = parseInt(element.value) || 0;
            break;

        case 'development':
        case 'prosperity':
        case 'autonomy':
            EDITOR.selectedRegion[propName] = parseInt(element.value) || 0;
            break;

        case 'resources':
        case 'buildings':
            const value = element.value;
            EDITOR.selectedRegion[propName] = value.split(',').map(s => s.trim()).filter(s => s);
            break;

        case 'isCapital':
        case 'isCoastal':
            EDITOR.selectedRegion[propName] = element.checked;
            break;
    }

    EDITOR.needsRedraw = true;
}

function updateRegionColorFromText() {
    if (!EDITOR.selectedRegion) return;

    const textInput = document.getElementById('prop-color-text');
    if (!textInput) return;

    const colorStr = textInput.value.trim();
    EDITOR.selectedRegion.color = colorStr;

    // 同步更新颜色选择器
    const colorInput = document.getElementById('prop-color');
    if (colorInput) {
        colorInput.value = rgbToHex(colorStr);
    }

    EDITOR.needsRedraw = true;
}

function resetRegionColor() {
    if (!EDITOR.selectedRegion) return;

    // 重置为地形颜色
    const terrain = TERRAIN_TYPES[EDITOR.selectedRegion.terrain] || TERRAIN_TYPES.plains;
    EDITOR.selectedRegion.color = terrain.color;

    // 更新输入框
    const colorInput = document.getElementById('prop-color');
    const textInput = document.getElementById('prop-color-text');
    if (colorInput) colorInput.value = rgbToHex(terrain.color);
    if (textInput) textInput.value = terrain.color;

    EDITOR.needsRedraw = true;
}

// RGB/HSL 转 HEX
function rgbToHex(color) {
    if (!color) return '#666666';
    if (color.startsWith('#')) return color;

    // 解析 rgb(r, g, b)
    var rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
        return '#' + [rgbMatch[1], rgbMatch[2], rgbMatch[3]].map(function(x) {
            var hex = parseInt(x).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    // 解析 hsl(h, s%, l%)
    var hslMatch = color.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/);
    if (hslMatch) {
        var h = parseInt(hslMatch[1]) / 360, s = parseInt(hslMatch[2]) / 100, l = parseInt(hslMatch[3]) / 100;
        var r, g, b;
        if (s === 0) { r = g = b = l; } else {
            var hue2rgb = function(p, q, t) { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p; };
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
        }
        return '#' + [Math.round(r*255), Math.round(g*255), Math.round(b*255)].map(function(x) {
            var hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }

    return '#666666';
}

// HEX 转 RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 'rgb(100, 100, 100)';

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `rgb(${r},${g},${b})`;
}

// 邻接关系管理
function toggleNeighborsVisibility() {
    EDITOR.showNeighbors = !EDITOR.showNeighbors;
    EDITOR.needsRedraw = true;

    // 更新按钮文本
    if (EDITOR.selectedRegion) {
        showRegionProperties(EDITOR.selectedRegion);
    }
}

function addNeighbor() {
    if (!EDITOR.selectedRegion) return;

    // 创建选择列表
    let options = '<option value="">-- 选择地块 --</option>';
    EDITOR.regions.forEach(region => {
        if (region.id !== EDITOR.selectedRegion.id) {
            const isNeighbor = EDITOR.selectedRegion.neighbors && EDITOR.selectedRegion.neighbors.includes(region.id);
            if (!isNeighbor) {
                options += `<option value="${region.id}">${region.name}</option>`;
            }
        }
    });

    const select = document.createElement('select');
    select.innerHTML = options;
    select.style.cssText = 'width:100%;padding:8px;background:#1a1a1a;border:1px solid #333;color:#e0e0e0;border-radius:4px;';

    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:#1a1a1a;padding:24px;border-radius:8px;border:1px solid #444;min-width:300px;">
            <h3 style="color:#ffd700;margin-bottom:16px;">添加邻接地块</h3>
            <div id="neighbor-select-container" style="margin-bottom:16px;"></div>
            <div style="display:flex;gap:8px;">
                <button id="confirm-neighbor" style="flex:1;padding:10px;background:#ffd700;border:none;color:#1a1a1a;border-radius:4px;cursor:pointer;font-weight:600;">确定</button>
                <button id="cancel-neighbor" style="flex:1;padding:10px;background:#444;border:none;color:#fff;border-radius:4px;cursor:pointer;">取消</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    document.getElementById('neighbor-select-container').appendChild(select);

    document.getElementById('confirm-neighbor').onclick = () => {
        const neighborId = select.value;
        if (neighborId) {
            if (!EDITOR.selectedRegion.neighbors) {
                EDITOR.selectedRegion.neighbors = [];
            }
            EDITOR.selectedRegion.neighbors.push(neighborId);

            // 双向添加
            const neighbor = EDITOR.regions.find(r => r.id === neighborId);
            if (neighbor) {
                if (!neighbor.neighbors) {
                    neighbor.neighbors = [];
                }
                if (!neighbor.neighbors.includes(EDITOR.selectedRegion.id)) {
                    neighbor.neighbors.push(EDITOR.selectedRegion.id);
                }
            }

            showRegionProperties(EDITOR.selectedRegion);
            EDITOR.needsRedraw = true;
        }
        document.body.removeChild(modal);
    };

    document.getElementById('cancel-neighbor').onclick = () => {
        document.body.removeChild(modal);
    };
}

function removeNeighbor(neighborId) {
    if (!EDITOR.selectedRegion) return;

    if (!confirm('确定要删除这个邻接关系吗？')) return;

    // 从当前地块删除
    if (EDITOR.selectedRegion.neighbors) {
        EDITOR.selectedRegion.neighbors = EDITOR.selectedRegion.neighbors.filter(id => id !== neighborId);
    }

    // 从邻居地块删除反向关系
    const neighbor = EDITOR.regions.find(r => r.id === neighborId);
    if (neighbor && neighbor.neighbors) {
        neighbor.neighbors = neighbor.neighbors.filter(id => id !== EDITOR.selectedRegion.id);
    }

    showRegionProperties(EDITOR.selectedRegion);
    EDITOR.needsRedraw = true;
}

function updateCustomField(fieldName) {
    if (!EDITOR.selectedRegion) return;

    const field = EDITOR.customFields.find(f => f.name === fieldName);
    if (!field) return;

    const element = document.getElementById('prop-custom-' + fieldName);
    if (!element) return;

    switch(field.type) {
        case 'text':
        case 'textarea':
        case 'select':
            EDITOR.selectedRegion[fieldName] = element.value;
            break;
        case 'number':
            EDITOR.selectedRegion[fieldName] = parseInt(element.value) || 0;
            break;
        case 'checkbox':
            EDITOR.selectedRegion[fieldName] = element.checked;
            break;
    }

    EDITOR.needsRedraw = true;
}

// 保留旧函数以兼容
function updateRegionName() {
    updateRegionProperty('name');
}

function updateRegionOwner() {
    updateRegionProperty('owner');
}

function updateRegionDevelopment() {
    updateRegionProperty('development');
}

function updateRegionTroops() {
    updateRegionProperty('troops');
}

function updateRegionResources() {
    updateRegionProperty('resources');
}

// ============================================================
// 工具函数
// ============================================================

function setTool(tool) {
    EDITOR.currentTool = tool;
    updateStatusBar();

    const tools = {
        'select': '\u9009\u62e9',
        'pan': '\u5e73\u79fb',
        'edit': '\u7f16\u8f91',
        'split': '\u5206\u5272',
        'merge': '\u5408\u5e76'
    };

    document.getElementById('current-tool').textContent = tools[tool] || tool;

    if (tool === 'pan') {
        EDITOR.canvas.style.cursor = 'grab';
    } else {
        EDITOR.canvas.style.cursor = 'crosshair';
    }
}

function zoomIn() {
    const newScale = Math.min(EDITOR.view.maxScale, EDITOR.view.scale * 1.2);
    if (newScale !== EDITOR.view.scale) {
        EDITOR.view.scale = newScale;
        EDITOR.needsRedraw = true;
        updateZoomLevel();
    }
}

function zoomOut() {
    const newScale = Math.max(EDITOR.view.minScale, EDITOR.view.scale / 1.2);
    if (newScale !== EDITOR.view.scale) {
        EDITOR.view.scale = newScale;
        EDITOR.needsRedraw = true;
        updateZoomLevel();
    }
}

function resetView() {
    EDITOR.view.offsetX = 0;
    EDITOR.view.offsetY = 0;
    EDITOR.view.scale = 1.0;
    EDITOR.needsRedraw = true;
    updateZoomLevel();
}

function updateZoomLevel() {
    document.getElementById('zoom-level').textContent = Math.round(EDITOR.view.scale * 100) + '%';
}

function updateStatusBar() {
    document.getElementById('region-count').textContent = EDITOR.regions.length;
    document.getElementById('selected-count').textContent = EDITOR.selectedRegion ? 1 : 0;
}

function updateStats() {
    document.getElementById('stats-total').textContent = EDITOR.regions.length;

    const terrainCounts = {};
    EDITOR.regions.forEach(r => {
        terrainCounts[r.terrain] = (terrainCounts[r.terrain] || 0) + 1;
    });

    document.getElementById('stats-plains').textContent = terrainCounts.plains || 0;
    document.getElementById('stats-mountains').textContent = terrainCounts.mountains || 0;
    document.getElementById('stats-forest').textContent = terrainCounts.forest || 0;
    document.getElementById('stats-desert').textContent = terrainCounts.desert || 0;
}

// 继续在下一个文件...

// ============================================================
// 智能地图加载
// ============================================================

async function smartLoadMap() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;

        // 显示加载提示
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-overlay';
        loadingDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
        loadingDiv.innerHTML = `
            <div style="color:#ffd700;font-size:24px;margin-bottom:20px;">🤖 正在识别地图...</div>
            <div style="width:400px;height:8px;background:#333;border-radius:4px;overflow:hidden;margin-bottom:12px;">
                <div id="progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#ffd700,#ffed4e);transition:width 0.3s;"></div>
            </div>
            <div id="progress-text" style="color:#aaa;font-size:14px;">准备中...</div>
        `;
        document.body.appendChild(loadingDiv);

        const updateProgress = (percent, text) => {
            const bar = document.getElementById('progress-bar');
            const textEl = document.getElementById('progress-text');
            if (bar) bar.style.width = percent + '%';
            if (textEl) textEl.textContent = text;
        };

        try {
            const mode = document.getElementById('recognition-mode').value;
            const options = {
                borderThreshold: parseInt(document.getElementById('border-threshold').value),
                tolerance: parseInt(document.getElementById('tolerance').value),
                minArea: parseInt(document.getElementById('min-area').value),
                fillGaps: document.getElementById('fill-gaps').checked,
                simplify: document.getElementById('simplify-boundary').checked
            };

            let mapData;

            // 等待下一帧，让加载提示先显示
            await new Promise(resolve => requestAnimationFrame(resolve));

            if (mode === 'eu4') {
                // 使用EU4颜色识别
                mapData = await loadAndRecognizeMapEU4Style(file, options, updateProgress);
            } else if (mode === 'borders') {
                // 使用边界线识别（改进版）
                mapData = await loadAndRecognizeMapByBordersImproved(file, options);
            } else if (mode === 'color') {
                // 使用颜色分割识别
                mapData = await loadAndRecognizeMap(file, options);
            } else {
                // 自动选择
                mapData = await smartRecognizeMapAuto(file, options);
            }

            // 识别完成后，一次性加载到编辑器
            EDITOR.width = mapData.width;
            EDITOR.height = mapData.height;
            EDITOR.backgroundImage = mapData.backgroundImage;
            EDITOR.regions = mapData.regions;
            EDITOR.selectedRegion = null;

            // 重置视图
            resetView();

            // 更新UI
            updateStats();
            updateStatusBar();
            EDITOR.needsRedraw = true;
            EDITOR.minimap.needsUpdate = true;

            // 移除加载提示
            document.body.removeChild(loadingDiv);

            alert(`\u8bc6\u522b\u6210\u529f\uff01\u5171\u8bc6\u522b\u51fa ${mapData.regions.length} \u4e2a\u5730\u5757`);

        } catch (error) {
            // 移除加载提示
            const overlay = document.getElementById('loading-overlay');
            if (overlay) document.body.removeChild(overlay);

            alert('\u8bc6\u522b\u5931\u8d25: ' + error.message);
            console.error(error);
        }
    };

    input.click();
}

async function smartRecognizeMapAuto(imageFile, options) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            const img = new Image();

            img.onload = async function() {
                try {
                    // 分析图片特征
                    const features = analyzeImageFeatures(img);

                    let mapData;
                    if (features.hasBorders) {
                        console.log('\u81ea\u52a8\u9009\u62e9: \u8fb9\u754c\u7ebf\u8bc6\u522b');
                        const regions = await recognizeMapByBorders(img, options);
                        mapData = {
                            name: imageFile.name.replace(/\.[^/.]+$/, ''),
                            width: img.width,
                            height: img.height,
                            backgroundImage: img,
                            regions: regions.map(region => ({
                                id: region.id,
                                name: region.name,
                                coords: region.boundary.flat(),
                                center: region.center,
                                terrain: 'plains',
                                owner: '',
                                color: region.color,
                                resources: [],
                                development: 50,
                                troops: 0,
                                characters: [],
                                neighbors: []
                            }))
                        };
                    } else {
                        console.log('\u81ea\u52a8\u9009\u62e9: \u989c\u8272\u5206\u5272');
                        mapData = await loadAndRecognizeMap(imageFile, options);
                    }

                    resolve(mapData);

                } catch (error) {
                    reject(error);
                }
            };

            img.onerror = function() {
                reject(new Error('\u56fe\u7247\u52a0\u8f7d\u5931\u8d25'));
            };

            img.src = e.target.result;
        };

        reader.onerror = function() {
            reject(new Error('\u6587\u4ef6\u8bfb\u53d6\u5931\u8d25'));
        };

        reader.readAsDataURL(imageFile);
    });
}

async function loadPresetMap(preset) {
    const maps = {
        'china': 'maps/china-map.jpg',
        'asia': 'maps/lishiyouxi.png',
        'world1': 'maps/MapChart_Map.png',
        'world2': 'maps/MapChart_Map (1).png'
    };

    const path = maps[preset];
    if (!path) return;

    // 显示加载提示
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loading-overlay';
    loadingDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
    loadingDiv.innerHTML = '<div style="color:#ffd700;font-size:24px;margin-bottom:20px;">🤖 正在识别地图...</div><div style="color:#aaa;font-size:14px;">请稍候，识别完成后将自动显示</div>';
    document.body.appendChild(loadingDiv);

    try {
        const response = await fetch(path);
        const blob = await response.blob();
        const file = new File([blob], preset + '.png', { type: 'image/png' });

        const mode = document.getElementById('recognition-mode').value;
        const options = {
            borderThreshold: parseInt(document.getElementById('border-threshold').value),
            tolerance: parseInt(document.getElementById('tolerance').value),
            minArea: parseInt(document.getElementById('min-area').value),
            fillGaps: document.getElementById('fill-gaps').checked,
            simplify: document.getElementById('simplify-boundary').checked
        };

        let mapData;

        // 等待下一帧，让加载提示先显示
        await new Promise(resolve => requestAnimationFrame(resolve));

        if (mode === 'borders') {
            // 使用边界线识别（快速版）
            mapData = await loadAndRecognizeMapByBordersFast(file, options);
        } else if (mode === 'color') {
            // 使用颜色分割识别
            mapData = await loadAndRecognizeMap(file, options);
        } else {
            // 自动选择
            mapData = await smartRecognizeMapAuto(file, options);
        }

        // 识别完成后，一次性加载到编辑器
        EDITOR.width = mapData.width;
        EDITOR.height = mapData.height;
        EDITOR.backgroundImage = mapData.backgroundImage;
        EDITOR.regions = mapData.regions;
        EDITOR.selectedRegion = null;

        // 重置视图
        resetView();

        // 更新UI
        updateStats();
        updateStatusBar();
        EDITOR.needsRedraw = true;
        EDITOR.minimap.needsUpdate = true;

        // 移除加载提示
        document.body.removeChild(loadingDiv);

        alert(`\u8bc6\u522b\u6210\u529f\uff01\u5171\u8bc6\u522b\u51fa ${mapData.regions.length} \u4e2a\u5730\u5757`);

    } catch (error) {
        // 移除加载提示
        const overlay = document.getElementById('loading-overlay');
        if (overlay) document.body.removeChild(overlay);

        alert('\u52a0\u8f7d\u5931\u8d25: ' + error.message);
        console.error(error);
    }
}

// ============================================================
// 地形选择器
// ============================================================

function initTerrainSelector() {
    const container = document.getElementById('terrain-selector');
    let html = '';

    for (const [key, terrain] of Object.entries(TERRAIN_TYPES)) {
        html += `
            <div class="terrain-btn" onclick="setRegionTerrain('${key}')">
                <div class="terrain-icon">${terrain.icon}</div>
                <div>${terrain.name}</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function setRegionTerrain(terrainType) {
    if (!EDITOR.selectedRegion) {
        alert('\u8bf7\u5148\u9009\u62e9\u4e00\u4e2a\u5730\u5757');
        return;
    }

    EDITOR.selectedRegion.terrain = terrainType;
    EDITOR.needsRedraw = true;
    updateStats();

    // 高亮选中的地形按钮
    document.querySelectorAll('.terrain-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    event.target.closest('.terrain-btn').classList.add('selected');
}

// ============================================================
// 右键菜单
// ============================================================

function showContextMenu(x, y) {
    const menu = document.getElementById('context-menu');
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.style.display = 'block';
}

function editRegionName() {
    if (!EDITOR.selectedRegion) return;
    const newName = prompt('\u8f93\u5165\u65b0\u540d\u79f0:', EDITOR.selectedRegion.name);
    if (newName) {
        EDITOR.selectedRegion.name = newName;
        showRegionProperties(EDITOR.selectedRegion);
        EDITOR.needsRedraw = true;
    }
}

function setRegionOwner() {
    if (!EDITOR.selectedRegion) return;
    const owner = prompt('\u8f93\u5165\u6240\u5c5e\u52bf\u529b:', EDITOR.selectedRegion.owner || '');
    if (owner !== null) {
        EDITOR.selectedRegion.owner = owner;
        showRegionProperties(EDITOR.selectedRegion);
    }
}

function editRegionResources() {
    if (!EDITOR.selectedRegion) return;
    const resources = prompt('\u8f93\u5165\u8d44\u6e90 (\u9017\u53f7\u5206\u9694):', (EDITOR.selectedRegion.resources || []).join(', '));
    if (resources !== null) {
        EDITOR.selectedRegion.resources = resources.split(',').map(s => s.trim()).filter(s => s);
        showRegionProperties(EDITOR.selectedRegion);
    }
}

function splitRegion() {
    alert('\u5206\u5272\u529f\u80fd\u5f00\u53d1\u4e2d...');
}

function mergeRegions() {
    alert('\u5408\u5e76\u529f\u80fd\u5f00\u53d1\u4e2d...');
}

function deleteRegion() {
    if (!EDITOR.selectedRegion) return;

    if (confirm('\u786e\u5b9a\u5220\u9664\u5730\u5757: ' + EDITOR.selectedRegion.name + '?')) {
        const index = EDITOR.regions.indexOf(EDITOR.selectedRegion);
        if (index > -1) {
            EDITOR.regions.splice(index, 1);
        }

        EDITOR.selectedRegion = null;
        document.getElementById('region-properties').innerHTML = '<p style="color: #888; font-size: 13px;">\u9009\u62e9\u4e00\u4e2a\u5730\u5757\u4ee5\u7f16\u8f91\u5c5e\u6027</p>';

        EDITOR.needsRedraw = true;
        EDITOR.minimap.needsUpdate = true;
        updateStats();
        updateStatusBar();
    }
}

// ============================================================
// 显示选项
// ============================================================

function toggleLabels() {
    EDITOR.needsRedraw = true;
}

function toggleBorders() {
    EDITOR.needsRedraw = true;
}

function updateBgOpacity(value) {
    EDITOR.backgroundOpacity = value / 100;
    EDITOR.needsRedraw = true;
}

// ============================================================
// 高级功能
// ============================================================

function calculateNeighbors() {
    if (EDITOR.regions.length === 0) {
        alert('\u6ca1\u6709\u5730\u5757\u6570\u636e');
        return;
    }

    showRecognitionProgress('\u6b63\u5728\u8ba1\u7b97\u90bb\u63a5\u5173\u7cfb...', 0);

    setTimeout(function() {
        EDITOR.regions.forEach(function(region) {
            region.neighbors = [];
        });

        // 检测相邻地块
        for (let i = 0; i < EDITOR.regions.length; i++) {
            for (let j = i + 1; j < EDITOR.regions.length; j++) {
                if (areRegionsBordering(EDITOR.regions[i], EDITOR.regions[j])) {
                    EDITOR.regions[i].neighbors.push(EDITOR.regions[j].id);
                    EDITOR.regions[j].neighbors.push(EDITOR.regions[i].id);
                }
            }
        }

        hideRecognitionProgress();
        alert('\u90bb\u63a5\u5173\u7cfb\u8ba1\u7b97\u5b8c\u6210\uff01');
    }, 100);
}

function areRegionsBordering(r1, r2) {
    // 简化版：检查是否有共享的边界点
    const threshold = 5;

    for (let i = 0; i < r1.coords.length; i += 2) {
        const x1 = r1.coords[i];
        const y1 = r1.coords[i + 1];

        for (let j = 0; j < r2.coords.length; j += 2) {
            const x2 = r2.coords[j];
            const y2 = r2.coords[j + 1];

            const dist = Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
            if (dist < threshold) {
                return true;
            }
        }
    }

    return false;
}

function batchEdit() {
    alert('\u6279\u91cf\u7f16\u8f91\u529f\u80fd\u5f00\u53d1\u4e2d...');
}

function validateMap() {
    const issues = [];

    if (EDITOR.regions.length === 0) {
        issues.push('\u5730\u56fe\u4e3a\u7a7a\uff0c\u6ca1\u6709\u5730\u5757');
    }

    // 检查重名
    const names = {};
    EDITOR.regions.forEach(function(r) {
        if (names[r.name]) {
            issues.push(`\u91cd\u590d\u7684\u5730\u5757\u540d\u79f0: ${r.name}`);
        }
        names[r.name] = true;
    });

    // 检查无主地块
    const noOwner = EDITOR.regions.filter(r => !r.owner || r.owner === '');
    if (noOwner.length > 0) {
        issues.push(`${noOwner.length} \u4e2a\u5730\u5757\u6ca1\u6709\u6240\u5c5e\u52bf\u529b`);
    }

    if (issues.length === 0) {
        alert('\u2705 \u5730\u56fe\u9a8c\u8bc1\u901a\u8fc7\uff01');
    } else {
        alert('\u53d1\u73b0 ' + issues.length + ' \u4e2a\u95ee\u9898:\n\n' + issues.join('\n'));
    }
}

// ============================================================
// 导出功能
// ============================================================

function exportMap() {
    if (EDITOR.regions.length === 0) {
        alert('\u6ca1\u6709\u5730\u5757\u6570\u636e');
        return;
    }

    const mapData = {
        name: '\u667a\u80fd\u8bc6\u522b\u5730\u56fe',
        width: EDITOR.width,
        height: EDITOR.height,
        regions: EDITOR.regions.map(function(region) {
            return {
                id: region.id,
                name: region.name,
                type: 'poly',
                coords: region.coords,
                center: region.center,
                neighbors: region.neighbors || [],
                terrain: region.terrain,
                resources: region.resources || [],
                owner: region.owner || '',
                characters: region.characters || [],
                troops: region.troops || 0,
                development: region.development || 50,
                events: '',
                color: TERRAIN_TYPES[region.terrain]?.color || '#666666'
            };
        })
    };

    const json = JSON.stringify(mapData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smart_map_' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);

    alert('\u5730\u56fe\u5df2\u5bfc\u51fa\uff01');
}

// ============================================================
// 历史记录
// ============================================================

function undo() {
    alert('\u64a4\u9500\u529f\u80fd\u5f00\u53d1\u4e2d...');
}

function redo() {
    alert('\u91cd\u505a\u529f\u80fd\u5f00\u53d1\u4e2d...');
}

// ============================================================
// 自定义字段管理
// ============================================================

function addCustomField() {
    const name = prompt('请输入字段名称（英文，如：population）:');
    if (!name) return;

    const label = prompt('请输入字段显示名称（中文）:');
    if (!label) return;

    const typeOptions = ['text', 'number', 'textarea', 'checkbox', 'select'];
    const type = prompt('请输入字段类型（text/number/textarea/checkbox/select）:', 'text');
    if (!typeOptions.includes(type)) {
        alert('无效的字段类型！');
        return;
    }

    let options = null;
    if (type === 'select') {
        const optionsStr = prompt('请输入选项（逗号分隔）:');
        if (optionsStr) {
            options = optionsStr.split(',').map(s => s.trim());
        }
    }

    const field = {
        name: name,
        label: label,
        type: type,
        options: options,
        defaultValue: type === 'checkbox' ? false : (type === 'number' ? 0 : '')
    };

    EDITOR.customFields.push(field);
    renderCustomFieldsList();

    // 为所有现有地块添加这个字段
    EDITOR.regions.forEach(region => {
        if (!(name in region)) {
            region[name] = field.defaultValue;
        }
    });

    // 如果有选中的地块，刷新属性面板
    if (EDITOR.selectedRegion) {
        showRegionProperties(EDITOR.selectedRegion);
    }

    alert('自定义字段已添加！');
}

function renderCustomFieldsList() {
    const container = document.getElementById('custom-fields-list');
    if (!container) return;

    if (EDITOR.customFields.length === 0) {
        container.innerHTML = '<p style="color:#888;font-size:12px;">暂无自定义字段</p>';
        return;
    }

    let html = '';
    EDITOR.customFields.forEach((field, index) => {
        html += `
            <div style="padding:8px;background:#1a1a1a;border:1px solid #333;border-radius:4px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="color:#ffd700;font-size:12px;">${field.label}</div>
                        <div style="color:#888;font-size:11px;">${field.name} (${field.type})</div>
                    </div>
                    <button onclick="removeCustomField(${index})" style="background:#e74c3c;border:none;color:#fff;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:11px;">删除</button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function removeCustomField(index) {
    if (!confirm('确定要删除这个自定义字段吗？')) return;

    const field = EDITOR.customFields[index];

    // 从所有地块中删除这个字段
    EDITOR.regions.forEach(region => {
        delete region[field.name];
    });

    EDITOR.customFields.splice(index, 1);
    renderCustomFieldsList();

    // 如果有选中的地块，刷新属性面板
    if (EDITOR.selectedRegion) {
        showRegionProperties(EDITOR.selectedRegion);
    }

    alert('自定义字段已删除！');
}

// ============================================================
// AI 智能生成
// ============================================================

async function aiGenerateProvinceData() {
    if (!EDITOR.selectedRegion) {
        alert('请先选择一个省份！');
        return;
    }

    // R153 包 try·private 模式不崩
    let apiKey = null;
    try { apiKey = localStorage.getItem('apiKey'); } catch(_){}
    if (!apiKey) {
        alert('请先在剧本编辑器中设置 API Key！');
        return;
    }

    const context = prompt('请输入历史背景（如：三国时期的荆州）:', '');
    if (!context) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
    loadingDiv.innerHTML = '<div style="color:#ffd700;font-size:24px;margin-bottom:20px;">🤖 AI 正在生成省份数据...</div><div style="color:#aaa;font-size:14px;">请稍候</div>';
    document.body.appendChild(loadingDiv);

    try {
        const prompt = `你是一个历史地理专家。请为以下省份生成详细的历史数据：

省份名称：${EDITOR.selectedRegion.name}
历史背景：${context}

请以 JSON 格式返回以下信息：
{
  "culture": "文化（如：汉、蒙古）",
  "religion": "宗教（如：儒教、佛教）",
  "population": 人口（万人，数字）,
  "development": 发展度（0-100）,
  "prosperity": 繁荣度（0-100）,
  "resources": ["资源1", "资源2"],
  "buildings": ["建筑1", "建筑2"],
  "history": "历史事件描述",
  "tax": 税收（数字）,
  "isCapital": 是否首都（true/false）,
  "isCoastal": 是否沿海（true/false）
}

只返回 JSON，不要其他文字。`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            throw new Error('API 请求失败: ' + response.status);
        }

        const data = await response.json();
        const content = data.content[0].text;

        // 提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('无法解析 AI 返回的数据');
        }

        const provinceData = JSON.parse(jsonMatch[0]);

        // 应用到选中的省份
        Object.assign(EDITOR.selectedRegion, provinceData);

        document.body.removeChild(loadingDiv);

        // 刷新属性面板
        showRegionProperties(EDITOR.selectedRegion);
        EDITOR.needsRedraw = true;

        alert('AI 生成成功！');

    } catch (error) {
        document.body.removeChild(loadingDiv);
        alert('AI 生成失败: ' + error.message);
        console.error(error);
    }
}

async function aiGenerateCustomFields() {
    // R153 包 try
    let apiKey = null;
    try { apiKey = localStorage.getItem('apiKey'); } catch(_){}
    if (!apiKey) {
        alert('请先在剧本编辑器中设置 API Key！');
        return;
    }

    const gameType = prompt('请描述你的游戏类型（如：三国历史模拟、战国策略）:', '');
    if (!gameType) return;

    const loadingDiv = document.createElement('div');
    loadingDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
    loadingDiv.innerHTML = '<div style="color:#ffd700;font-size:24px;margin-bottom:20px;">🤖 AI 正在分析...</div><div style="color:#aaa;font-size:14px;">请稍候</div>';
    document.body.appendChild(loadingDiv);

    try {
        const prompt = `你是一个游戏设计专家。请为以下类型的游戏建议省份/地块应该有哪些自定义字段：

游戏类型：${gameType}

请以 JSON 数组格式返回建议的字段，每个字段包含：
[
  {
    "name": "字段名（英文）",
    "label": "显示名称（中文）",
    "type": "字段类型（text/number/textarea/checkbox/select）",
    "options": ["选项1", "选项2"] // 仅当 type 为 select 时需要
  }
]

建议 5-10 个有意义的字段。只返回 JSON 数组，不要其他文字。`;

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 2000,
                messages: [{
                    role: 'user',
                    content: prompt
                }]
            })
        });

        if (!response.ok) {
            throw new Error('API 请求失败: ' + response.status);
        }

        const data = await response.json();
        const content = data.content[0].text;

        // 提取 JSON
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('无法解析 AI 返回的数据');
        }

        const suggestedFields = JSON.parse(jsonMatch[0]);

        document.body.removeChild(loadingDiv);

        // 显示建议并让用户选择
        let message = 'AI 建议以下字段：\n\n';
        suggestedFields.forEach((field, index) => {
            message += `${index + 1}. ${field.label} (${field.name}) - ${field.type}\n`;
        });
        message += '\n是否添加这些字段？';

        if (confirm(message)) {
            suggestedFields.forEach(field => {
                field.defaultValue = field.type === 'checkbox' ? false : (field.type === 'number' ? 0 : '');
                EDITOR.customFields.push(field);

                // 为所有现有地块添加这个字段
                EDITOR.regions.forEach(region => {
                    if (!(field.name in region)) {
                        region[field.name] = field.defaultValue;
                    }
                });
            });

            renderCustomFieldsList();
            alert('自定义字段已添加！');
        }

    } catch (error) {
        document.body.removeChild(loadingDiv);
        alert('AI 生成失败: ' + error.message);
        console.error(error);
    }
}

