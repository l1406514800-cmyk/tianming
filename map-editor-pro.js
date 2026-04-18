// 专业地图编辑器 - 基于 Leaflet.js
// map-editor-pro.js

// 全局状态
const EDITOR = {
    map: null,
    drawnItems: null,
    provinces: [],
    selectedProvince: null,
    backgroundLayer: null,
    labelLayer: null,
    currentMode: 'view',
    mapData: {
        name: '\u65b0\u5730\u56fe',
        width: 1200,
        height: 800,
        provinces: []
    }
};

// 地形类型定义
const TERRAIN_TYPES = {
    plains: { name: '\u5e73\u539f', color: '#90EE90', icon: '\ud83c\udf3e' },
    mountains: { name: '\u5c71\u5730', color: '#8B4513', icon: '\u26f0\ufe0f' },
    forest: { name: '\u68ee\u6797', color: '#228B22', icon: '\ud83c\udf32' },
    desert: { name: '\u6c99\u6f20', color: '#F4A460', icon: '\ud83c\udfdc\ufe0f' },
    grassland: { name: '\u8349\u539f', color: '#7CFC00', icon: '\ud83c\udf3f' },
    hills: { name: '\u4e18\u9675', color: '#CD853F', icon: '\u26f0\ufe0f' },
    water: { name: '\u6c34\u57df', color: '#4682B4', icon: '\ud83d\udca7' },
    swamp: { name: '\u6cbc\u6cfd', color: '#556B2F', icon: '\ud83c\udf3e' }
};

// 初始化地图
function initMap() {
    // 创建地图实例（使用简单的 CRS，不使用地理坐标）
    EDITOR.map = L.map('map', {
        crs: L.CRS.Simple,
        minZoom: -2,
        maxZoom: 2,
        zoomControl: true,
        attributionControl: false
    });

    // 设置地图边界
    const bounds = [[0, 0], [EDITOR.mapData.height, EDITOR.mapData.width]];
    EDITOR.map.fitBounds(bounds);
    EDITOR.map.setMaxBounds(bounds.map(b => [b[0] - 200, b[1] - 200]));

    // 初始化绘制图层
    EDITOR.drawnItems = new L.FeatureGroup();
    EDITOR.map.addLayer(EDITOR.drawnItems);

    // 初始化标签图层
    EDITOR.labelLayer = new L.LayerGroup();
    EDITOR.map.addLayer(EDITOR.labelLayer);

    // 初始化绘制控件
    initDrawControl();

    // 初始化地形选择器
    initTerrainSelector();

    // 绑定键盘快捷键
    bindKeyboardShortcuts();

    // 更新状态栏
    updateStatusBar();

    console.log('\u5730\u56fe\u7f16\u8f91\u5668\u521d\u59cb\u5316\u5b8c\u6210');
}

// 初始化绘制控件
function initDrawControl() {
    const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            polyline: false,
            circle: false,
            circlemarker: false,
            marker: false,
            polygon: {
                allowIntersection: false,
                showArea: true,
                drawError: {
                    color: '#e74c3c',
                    message: '<strong>\u9519\u8bef:</strong> \u7701\u4efd\u8fb9\u754c\u4e0d\u80fd\u76f8\u4ea4!'
                },
                shapeOptions: {
                    color: '#ffd700',
                    weight: 2
                }
            },
            rectangle: {
                shapeOptions: {
                    color: '#ffd700',
                    weight: 2
                }
            }
        },
        edit: {
            featureGroup: EDITOR.drawnItems,
            remove: true
        }
    });

    EDITOR.map.addControl(drawControl);
    EDITOR.drawControl = drawControl; // 保存引用供 startDrawPolygon/Rectangle 使用

    // 绑定绘制事件
    EDITOR.map.on(L.Draw.Event.CREATED, onProvinceCreated);
    EDITOR.map.on(L.Draw.Event.EDITED, onProvinceEdited);
    EDITOR.map.on(L.Draw.Event.DELETED, onProvinceDeleted);
}

// 省份创建事件
function onProvinceCreated(e) {
    const layer = e.layer;
    const type = e.layerType;

    // 生成省份 ID
    const provinceId = 'province_' + Date.now();

    // 创建省份数据
    const province = {
        id: provinceId,
        name: `\u7701\u4efd${EDITOR.provinces.length + 1}`,
        terrain: 'plains',
        owner: '',
        color: getRandomColor(),
        resources: [],
        development: 50,
        troops: 0,
        characters: [],
        layer: layer
    };

    // 设置图层样式
    layer.setStyle({
        fillColor: province.color,
        fillOpacity: 0.5,
        color: '#444',
        weight: 2
    });

    // 绑定点击事件
    layer.on('click', function() {
        selectProvince(province);
    });

    // 添加到地图
    EDITOR.drawnItems.addLayer(layer);
    EDITOR.provinces.push(province);

    // 添加标签
    addProvinceLabel(province);

    // 更新状态
    updateStatusBar();
    updateStats();

    console.log('\u521b\u5efa\u7701\u4efd:', province.name);
}

// 省份编辑事件
function onProvinceEdited(e) {
    const layers = e.layers;
    layers.eachLayer(function(layer) {
        // 更新对应省份的几何数据
        const province = findProvinceByLayer(layer);
        if (province) {
            updateProvinceLabel(province);
        }
    });
    console.log('\u7701\u4efd\u5df2\u7f16\u8f91');
}

// 省份删除事件
function onProvinceDeleted(e) {
    const layers = e.layers;
    layers.eachLayer(function(layer) {
        const province = findProvinceByLayer(layer);
        if (province) {
            // 从数组中移除
            const index = EDITOR.provinces.indexOf(province);
            if (index > -1) {
                EDITOR.provinces.splice(index, 1);
            }
            // 移除标签
            removeProvinceLabel(province);
        }
    });
    updateStatusBar();
    updateStats();
    console.log('\u7701\u4efd\u5df2\u5220\u9664');
}

// 选择省份
function selectProvince(province) {
    EDITOR.selectedProvince = province;

    // 高亮选中的省份
    EDITOR.drawnItems.eachLayer(function(layer) {
        const p = findProvinceByLayer(layer);
        if (p === province) {
            layer.setStyle({ weight: 4, color: '#ffd700' });
        } else {
            layer.setStyle({ weight: 2, color: '#444' });
        }
    });

    // 显示属性面板
    showProvinceProperties(province);
    updateStatusBar();
}

// 显示省份属性
function showProvinceProperties(province) {
    const html = `
        <div class="input-group">
            <label>\u7701\u4efd\u540d\u79f0</label>
            <input type="text" id="prop-name" value="${province.name}" onchange="updateProvinceName()">
        </div>
        <div class="input-group">
            <label>\u6240\u5c5e\u52bf\u529b</label>
            <input type="text" id="prop-owner" value="${province.owner}" onchange="updateProvinceOwner()">
        </div>
        <div class="input-group">
            <label>\u989c\u8272</label>
            <input type="color" id="prop-color" value="${province.color}" onchange="updateProvinceColor()">
        </div>
        <div class="input-group">
            <label>\u53d1\u5c55\u5ea6 (${province.development})</label>
            <input type="range" id="prop-development" min="0" max="100" value="${province.development}" oninput="updateProvinceDevelopment()">
        </div>
        <div class="input-group">
            <label>\u9a7b\u519b</label>
            <input type="number" id="prop-troops" value="${province.troops}" onchange="updateProvinceTroops()">
        </div>
        <div class="input-group">
            <label>\u8d44\u6e90 (\u9017\u53f7\u5206\u9694)</label>
            <input type="text" id="prop-resources" value="${province.resources.join(', ')}" onchange="updateProvinceResources()">
        </div>
    `;

    document.getElementById('province-properties').innerHTML = html;
}

// 更新省份属性函数
function updateProvinceName() {
    if (!EDITOR.selectedProvince) return;
    EDITOR.selectedProvince.name = document.getElementById('prop-name').value;
    updateProvinceLabel(EDITOR.selectedProvince);
}

function updateProvinceOwner() {
    if (!EDITOR.selectedProvince) return;
    EDITOR.selectedProvince.owner = document.getElementById('prop-owner').value;
}

function updateProvinceColor() {
    if (!EDITOR.selectedProvince) return;
    const color = document.getElementById('prop-color').value;
    EDITOR.selectedProvince.color = color;
    EDITOR.selectedProvince.layer.setStyle({ fillColor: color });
}

function updateProvinceDevelopment() {
    if (!EDITOR.selectedProvince) return;
    EDITOR.selectedProvince.development = parseInt(document.getElementById('prop-development').value);
}

function updateProvinceTroops() {
    if (!EDITOR.selectedProvince) return;
    EDITOR.selectedProvince.troops = parseInt(document.getElementById('prop-troops').value);
}

function updateProvinceResources() {
    if (!EDITOR.selectedProvince) return;
    const value = document.getElementById('prop-resources').value;
    EDITOR.selectedProvince.resources = value.split(',').map(s => s.trim()).filter(s => s);
}

// 添加省份标签
function addProvinceLabel(province) {
    const center = getProvinceCenter(province.layer);
    if (!center) return;

    const label = L.marker(center, {
        icon: L.divIcon({
            className: 'province-label',
            html: province.name,
            iconSize: null
        })
    });

    province.label = label;
    EDITOR.labelLayer.addLayer(label);
}

// 更新省份标签
function updateProvinceLabel(province) {
    if (province.label) {
        EDITOR.labelLayer.removeLayer(province.label);
    }
    addProvinceLabel(province);
}

// 移除省份标签
function removeProvinceLabel(province) {
    if (province.label) {
        EDITOR.labelLayer.removeLayer(province.label);
    }
}

// 获取省份中心点
function getProvinceCenter(layer) {
    if (layer instanceof L.Polygon || layer instanceof L.Rectangle) {
        return layer.getBounds().getCenter();
    }
    return null;
}

// 查找省份
function findProvinceByLayer(layer) {
    return EDITOR.provinces.find(p => p.layer === layer);
}

// 初始化地形选择器
function initTerrainSelector() {
    const container = document.getElementById('terrain-selector');
    let html = '';

    for (const [key, terrain] of Object.entries(TERRAIN_TYPES)) {
        html += `
            <div class="terrain-btn" onclick="setProvinceTerrain('${key}')">
                <div style="font-size: 20px;">${terrain.icon}</div>
                <div style="font-size: 10px; margin-top: 4px;">${terrain.name}</div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// 设置省份地形
function setProvinceTerrain(terrainType) {
    if (!EDITOR.selectedProvince) {
        alert('\u8bf7\u5148\u9009\u62e9\u4e00\u4e2a\u7701\u4efd');
        return;
    }

    EDITOR.selectedProvince.terrain = terrainType;
    const terrain = TERRAIN_TYPES[terrainType];
    EDITOR.selectedProvince.layer.setStyle({ fillColor: terrain.color });

    // 高亮选中的地形按钮
    document.querySelectorAll('.terrain-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    event.target.closest('.terrain-btn').classList.add('selected');

    updateStats();
}

// 更新状态栏
function updateStatusBar() {
    document.getElementById('province-count').textContent = EDITOR.provinces.length;
    document.getElementById('selected-count').textContent = EDITOR.selectedProvince ? 1 : 0;
    document.getElementById('current-mode').textContent = getModeText(EDITOR.currentMode);
}

// 获取模式文本
function getModeText(mode) {
    const modes = {
        'view': '\u67e5\u770b',
        'draw': '\u7ed8\u5236',
        'edit': '\u7f16\u8f91',
        'delete': '\u5220\u9664'
    };
    return modes[mode] || '\u67e5\u770b';
}

// 更新统计信息
function updateStats() {
    document.getElementById('stats-total').textContent = EDITOR.provinces.length;

    const terrainCounts = {};
    EDITOR.provinces.forEach(p => {
        terrainCounts[p.terrain] = (terrainCounts[p.terrain] || 0) + 1;
    });

    document.getElementById('stats-plains').textContent = terrainCounts.plains || 0;
    document.getElementById('stats-mountains').textContent = terrainCounts.mountains || 0;
    document.getElementById('stats-forest').textContent = terrainCounts.forest || 0;
    document.getElementById('stats-desert').textContent = terrainCounts.desert || 0;
}

// 工具栏功能
function newMap() {
    if (EDITOR.provinces.length > 0) {
        if (!confirm('\u521b\u5efa\u65b0\u5730\u56fe\u5c06\u6e05\u9664\u5f53\u524d\u6240\u6709\u6570\u636e\uff0c\u786e\u5b9a\u7ee7\u7eed\u5417\uff1f')) {
            return;
        }
    }

    EDITOR.provinces = [];
    EDITOR.drawnItems.clearLayers();
    EDITOR.labelLayer.clearLayers();
    EDITOR.selectedProvince = null;

    if (EDITOR.backgroundLayer) {
        EDITOR.map.removeLayer(EDITOR.backgroundLayer);
        EDITOR.backgroundLayer = null;
    }

    updateStatusBar();
    updateStats();

    document.getElementById('province-properties').innerHTML = '<p style="color: #888; font-size: 13px;">\u9009\u62e9\u4e00\u4e2a\u7701\u4efd\u4ee5\u7f16\u8f91\u5c5e\u6027</p>';
}

function loadBackgroundImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            const bounds = [[0, 0], [EDITOR.mapData.height, EDITOR.mapData.width]];

            if (EDITOR.backgroundLayer) {
                EDITOR.map.removeLayer(EDITOR.backgroundLayer);
            }

            EDITOR.backgroundLayer = L.imageOverlay(event.target.result, bounds, {
                opacity: 0.5
            });
            EDITOR.backgroundLayer.addTo(EDITOR.map);
            EDITOR.backgroundLayer.bringToBack();
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function loadPresetMap() {
    const maps = [
        { name: 'Asia\u5386\u53f2\u5730\u56fe', file: '../history map/lishiyouxi.png' },
        { name: '\u4e16\u754c\u5730\u56fe1', file: '../history map/MapChart_Map.png' },
        { name: '\u4e16\u754c\u5730\u56fe2', file: '../history map/MapChart_Map (1).png' }
    ];

    let html = '<div style="padding: 20px;"><h3 style="margin-bottom: 16px;">\u9009\u62e9\u9884\u8bbe\u5730\u56fe</h3>';
    maps.forEach((map, i) => {
        html += `<button class="btn" onclick="loadPresetMapFile('${map.file}')" style="margin-bottom: 8px; width: 100%;">${map.name}</button>`;
    });
    html += '</div>';

    showModal('\u52a0\u8f7d\u9884\u8bbe\u5730\u56fe', html);
}

function loadPresetMapFile(file) {
    const bounds = [[0, 0], [EDITOR.mapData.height, EDITOR.mapData.width]];

    if (EDITOR.backgroundLayer) {
        EDITOR.map.removeLayer(EDITOR.backgroundLayer);
    }

    EDITOR.backgroundLayer = L.imageOverlay(file, bounds, {
        opacity: 0.5
    });
    EDITOR.backgroundLayer.addTo(EDITOR.map);
    EDITOR.backgroundLayer.bringToBack();

    closeModal();
}

function updateBgOpacity(value) {
    if (EDITOR.backgroundLayer) {
        EDITOR.backgroundLayer.setOpacity(value / 100);
    }
}

function toggleLabels() {
    const show = document.getElementById('show-labels').checked;
    if (show) {
        EDITOR.map.addLayer(EDITOR.labelLayer);
    } else {
        EDITOR.map.removeLayer(EDITOR.labelLayer);
    }
}

function toggleBorders() {
    const show = document.getElementById('show-borders').checked;
    EDITOR.drawnItems.eachLayer(function(layer) {
        layer.setStyle({ weight: show ? 2 : 0 });
    });
}

function updateDisplayMode() {
    const mode = document.getElementById('display-mode').value;

    EDITOR.drawnItems.eachLayer(function(layer) {
        const province = findProvinceByLayer(layer);
        if (!province) return;

        let color = province.color;

        if (mode === 'terrain') {
            const terrain = TERRAIN_TYPES[province.terrain];
            color = terrain ? terrain.color : '#666';
        } else if (mode === 'development') {
            const dev = province.development || 50;
            const hue = (dev / 100) * 120;
            color = `hsl(${hue}, 70%, 40%)`;
        }

        layer.setStyle({ fillColor: color });
    });
}

function updateMapName() {
    EDITOR.mapData.name = document.getElementById('map-name').value;
}

// 导出功能
function exportGeoJSON() {
    const geojson = {
        type: 'FeatureCollection',
        features: []
    };

    EDITOR.provinces.forEach(province => {
        const feature = {
            type: 'Feature',
            properties: {
                id: province.id,
                name: province.name,
                terrain: province.terrain,
                owner: province.owner,
                color: province.color,
                resources: province.resources,
                development: province.development,
                troops: province.troops
            },
            geometry: province.layer.toGeoJSON().geometry
        };
        geojson.features.push(feature);
    });

    downloadJSON(geojson, EDITOR.mapData.name + '_geojson.json');
}

function exportToGame() {
    const gameData = {
        name: EDITOR.mapData.name,
        width: EDITOR.mapData.width,
        height: EDITOR.mapData.height,
        regions: []
    };

    EDITOR.provinces.forEach(province => {
        const latlngs = province.layer.getLatLngs()[0];
        const coords = [];
        latlngs.forEach(latlng => {
            coords.push(latlng.lng, latlng.lat);
        });

        const center = getProvinceCenter(province.layer);

        gameData.regions.push({
            id: province.id,
            name: province.name,
            coords: coords,
            center: center ? [center.lng, center.lat] : null,
            terrain: province.terrain,
            owner: province.owner,
            color: province.color,
            resources: province.resources,
            development: province.development,
            troops: province.troops,
            characters: province.characters || []
        });
    });

    downloadJSON(gameData, EDITOR.mapData.name + '_game.json');
}

function importGeoJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.geojson';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const geojson = JSON.parse(event.target.result);
                loadGeoJSON(geojson);
            } catch (err) {
                alert('\u5bfc\u5165\u5931\u8d25: ' + err.message);
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

function loadGeoJSON(geojson) {
    // 清空现有数据
    EDITOR.provinces = [];
    EDITOR.drawnItems.clearLayers();
    EDITOR.labelLayer.clearLayers();

    // 加载 GeoJSON
    L.geoJSON(geojson, {
        onEachFeature: function(feature, layer) {
            const props = feature.properties;

            const province = {
                id: props.id || 'province_' + Date.now(),
                name: props.name || '\u672a\u547d\u540d',
                terrain: props.terrain || 'plains',
                owner: props.owner || '',
                color: props.color || getRandomColor(),
                resources: props.resources || [],
                development: props.development || 50,
                troops: props.troops || 0,
                characters: props.characters || [],
                layer: layer
            };

            layer.setStyle({
                fillColor: province.color,
                fillOpacity: 0.5,
                color: '#444',
                weight: 2
            });

            layer.on('click', function() {
                selectProvince(province);
            });

            EDITOR.drawnItems.addLayer(layer);
            EDITOR.provinces.push(province);
            addProvinceLabel(province);
        }
    });

    updateStatusBar();
    updateStats();
}

// 工具函数
function downloadJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function getRandomColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function showModal(title, content) {
    const modal = document.createElement('div');
    modal.id = 'modal-overlay';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
        <div style="background:#2a2a2a;border:1px solid #444;border-radius:8px;max-width:600px;max-height:80vh;overflow:auto;">
            <div style="padding:16px;border-bottom:1px solid #444;display:flex;justify-content:space-between;align-items:center;">
                <h3 style="margin:0;color:#ffd700;">${title}</h3>
                <button onclick="closeModal()" style="background:none;border:none;color:#e0e0e0;font-size:24px;cursor:pointer;">&times;</button>
            </div>
            <div>${content}</div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) {
        document.body.removeChild(modal);
    }
}

// 绘制工具
function startDrawPolygon() {
    var opts = EDITOR.drawControl ? EDITOR.drawControl.options.draw.polygon : {};
    new L.Draw.Polygon(EDITOR.map, opts).enable();
    EDITOR.currentMode = 'draw';
    updateStatusBar();
}

function startDrawRectangle() {
    var opts = EDITOR.drawControl ? EDITOR.drawControl.options.draw.rectangle : {};
    new L.Draw.Rectangle(EDITOR.map, opts).enable();
    EDITOR.currentMode = 'draw';
    updateStatusBar();
}

function toggleEditMode() {
    alert('\u8bf7\u4f7f\u7528\u53f3\u4e0a\u89d2\u7684\u7f16\u8f91\u5de5\u5177\u680f\u8fdb\u5165\u7f16\u8f91\u6a21\u5f0f');
}

function toggleDeleteMode() {
    alert('\u8bf7\u4f7f\u7528\u53f3\u4e0a\u89d2\u7684\u7f16\u8f91\u5de5\u5177\u680f\u8fdb\u5165\u5220\u9664\u6a21\u5f0f');
}

// 键盘快捷键
function bindKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl+S: 保存
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            exportToGame();
        }
        // Ctrl+F: 搜索
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            searchProvince();
        }
        // P: 绘制多边形
        if (e.key === 'p' || e.key === 'P') {
            startDrawPolygon();
        }
        // R: 绘制矩形
        if (e.key === 'r' || e.key === 'R') {
            startDrawRectangle();
        }
        // Delete: 删除选中省份
        if (e.key === 'Delete' && EDITOR.selectedProvince) {
            if (confirm('\u786e\u5b9a\u5220\u9664\u7701\u4efd: ' + EDITOR.selectedProvince.name + '?')) {
                deleteSelectedProvince();
            }
        }
    });
}

// 删除选中的省份
function deleteSelectedProvince() {
    if (!EDITOR.selectedProvince) return;

    const province = EDITOR.selectedProvince;
    const index = EDITOR.provinces.indexOf(province);

    if (index > -1) {
        EDITOR.provinces.splice(index, 1);
        EDITOR.drawnItems.removeLayer(province.layer);
        removeProvinceLabel(province);
        EDITOR.selectedProvince = null;

        document.getElementById('province-properties').innerHTML = '<p style="color: #888; font-size: 13px;">\u9009\u62e9\u4e00\u4e2a\u7701\u4efd\u4ee5\u7f16\u8f91\u5c5e\u6027</p>';
        updateStatusBar();
        updateStats();
    }
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', function() {
    initMap();
});

// ============================================================
// 高级功能扩展
// ============================================================

// 计算邻接关系
function calculateNeighbors() {
    if (EDITOR.provinces.length === 0) {
        alert('\u6ca1\u6709\u7701\u4efd\u6570\u636e');
        return;
    }

    showLoading('\u6b63\u5728\u8ba1\u7b97\u90bb\u63a5\u5173\u7cfb...');

    setTimeout(function() {
        EDITOR.provinces.forEach(function(province) {
            province.neighbors = [];
        });

        // 检测相邻省份（边界相交）
        for (let i = 0; i < EDITOR.provinces.length; i++) {
            for (let j = i + 1; j < EDITOR.provinces.length; j++) {
                const p1 = EDITOR.provinces[i];
                const p2 = EDITOR.provinces[j];

                if (areProvincesBordering(p1, p2)) {
                    if (!p1.neighbors) p1.neighbors = [];
                    if (!p2.neighbors) p2.neighbors = [];
                    p1.neighbors.push(p2.id);
                    p2.neighbors.push(p1.id);
                }
            }
        }

        hideLoading();
        alert('\u90bb\u63a5\u5173\u7cfb\u8ba1\u7b97\u5b8c\u6210\uff01');
        console.log('\u90bb\u63a5\u5173\u7cfb:', EDITOR.provinces.map(p => ({
            name: p.name,
            neighbors: p.neighbors
        })));
    }, 100);
}

// 判断两个省份是否相邻
function areProvincesBordering(p1, p2) {
    const bounds1 = p1.layer.getBounds();
    const bounds2 = p2.layer.getBounds();

    // 快速排除：边界框不相交
    if (!bounds1.intersects(bounds2)) {
        return false;
    }

    // 详细检测：边界线是否接触
    const coords1 = p1.layer.getLatLngs()[0];
    const coords2 = p2.layer.getLatLngs()[0];

    // 检查是否有共享的边
    for (let i = 0; i < coords1.length; i++) {
        const a1 = coords1[i];
        const a2 = coords1[(i + 1) % coords1.length];

        for (let j = 0; j < coords2.length; j++) {
            const b1 = coords2[j];
            const b2 = coords2[(j + 1) % coords2.length];

            // 检查线段是否接近或重叠
            if (segmentsClose(a1, a2, b1, b2, 5)) {
                return true;
            }
        }
    }

    return false;
}

// 判断两条线段是否接近
function segmentsClose(a1, a2, b1, b2, threshold) {
    const dist1 = pointToSegmentDistance(a1, b1, b2);
    const dist2 = pointToSegmentDistance(a2, b1, b2);
    const dist3 = pointToSegmentDistance(b1, a1, a2);
    const dist4 = pointToSegmentDistance(b2, a1, a2);

    return Math.min(dist1, dist2, dist3, dist4) < threshold;
}

// 点到线段的距离
function pointToSegmentDistance(p, a, b) {
    const px = p.lng;
    const py = p.lat;
    const ax = a.lng;
    const ay = a.lat;
    const bx = b.lng;
    const by = b.lat;

    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    const nearestX = ax + t * dx;
    const nearestY = ay + t * dy;

    return Math.sqrt((px - nearestX) ** 2 + (py - nearestY) ** 2);
}

// 批量编辑功能
function batchEdit() {
    if (EDITOR.provinces.length === 0) {
        alert('\u6ca1\u6709\u7701\u4efd\u6570\u636e');
        return;
    }

    const html = `
        <div style="padding: 20px;">
            <h3 style="margin-bottom: 16px;">\u6279\u91cf\u7f16\u8f91</h3>
            <div class="input-group">
                <label>\u9009\u62e9\u7701\u4efd (\u9017\u53f7\u5206\u9694ID\u6216\u540d\u79f0)</label>
                <textarea id="batch-provinces" placeholder="\u4f8b: province_1, province_2, \u6c5f\u5357, \u6cb3\u5317" style="height: 80px;"></textarea>
            </div>
            <div class="input-group">
                <label>\u6279\u91cf\u64cd\u4f5c</label>
                <select id="batch-operation">
                    <option value="owner">\u8bbe\u7f6e\u6240\u5c5e\u52bf\u529b</option>
                    <option value="terrain">\u8bbe\u7f6e\u5730\u5f62</option>
                    <option value="development">\u8bbe\u7f6e\u53d1\u5c55\u5ea6</option>
                    <option value="troops">\u8bbe\u7f6e\u9a7b\u519b</option>
                    <option value="color">\u8bbe\u7f6e\u989c\u8272</option>
                </select>
            </div>
            <div class="input-group">
                <label>\u65b0\u503c</label>
                <input type="text" id="batch-value" placeholder="\u8f93\u5165\u65b0\u503c">
            </div>
            <button class="btn" onclick="executeBatchEdit()" style="width: 100%; margin-top: 12px;">\u6267\u884c\u6279\u91cf\u7f16\u8f91</button>
        </div>
    `;

    showModal('\u6279\u91cf\u7f16\u8f91', html);
}

function executeBatchEdit() {
    const provincesInput = document.getElementById('batch-provinces').value;
    const operation = document.getElementById('batch-operation').value;
    const value = document.getElementById('batch-value').value;

    if (!provincesInput || !value) {
        alert('\u8bf7\u586b\u5199\u6240\u6709\u5b57\u6bb5');
        return;
    }

    const targets = provincesInput.split(',').map(s => s.trim());
    let count = 0;

    EDITOR.provinces.forEach(function(province) {
        if (targets.includes(province.id) || targets.includes(province.name)) {
            switch (operation) {
                case 'owner':
                    province.owner = value;
                    break;
                case 'terrain':
                    province.terrain = value;
                    if (TERRAIN_TYPES[value]) {
                        province.layer.setStyle({ fillColor: TERRAIN_TYPES[value].color });
                    }
                    break;
                case 'development':
                    province.development = parseInt(value);
                    break;
                case 'troops':
                    province.troops = parseInt(value);
                    break;
                case 'color':
                    province.color = value;
                    province.layer.setStyle({ fillColor: value });
                    break;
            }
            count++;
        }
    });

    closeModal();
    alert(`\u5df2\u66f4\u65b0 ${count} \u4e2a\u7701\u4efd`);
    updateStats();
}

// 搜索功能
function searchProvince() {
    const keyword = prompt('\u8f93\u5165\u7701\u4efd\u540d\u79f0\u6216ID:');
    if (!keyword) return;

    const results = EDITOR.provinces.filter(p =>
        p.name.includes(keyword) || p.id.includes(keyword) || (p.owner && p.owner.includes(keyword))
    );

    if (results.length === 0) {
        alert('\u672a\u627e\u5230\u5339\u914d\u7684\u7701\u4efd');
        return;
    }

    if (results.length === 1) {
        selectProvince(results[0]);
        EDITOR.map.panTo(getProvinceCenter(results[0].layer));
    } else {
        let html = '<div style="padding: 20px;"><h3 style="margin-bottom: 16px;">\u641c\u7d22\u7ed3\u679c (' + results.length + ')</h3>';
        results.forEach(function(p, i) {
            html += `<button class="btn" onclick="selectProvinceById('${p.id}')" style="width: 100%; margin-bottom: 8px; text-align: left;">
                ${p.name} (${p.owner || '\u65e0\u4e3b'})
            </button>`;
        });
        html += '</div>';
        showModal('\u641c\u7d22\u7ed3\u679c', html);
    }
}

function selectProvinceById(id) {
    const province = EDITOR.provinces.find(p => p.id === id);
    if (province) {
        closeModal();
        selectProvince(province);
        EDITOR.map.panTo(getProvinceCenter(province.layer));
    }
}

// 地图验证
function validateMap() {
    const issues = [];

    // 检查省份数量
    if (EDITOR.provinces.length === 0) {
        issues.push('\u5730\u56fe\u4e3a\u7a7a\uff0c\u6ca1\u6709\u7701\u4efd');
    }

    // 检查重名
    const names = {};
    EDITOR.provinces.forEach(function(p) {
        if (names[p.name]) {
            issues.push(`\u91cd\u590d\u7684\u7701\u4efd\u540d\u79f0: ${p.name}`);
        }
        names[p.name] = true;
    });

    // 检查无主省份
    const noOwner = EDITOR.provinces.filter(p => !p.owner || p.owner === '');
    if (noOwner.length > 0) {
        issues.push(`${noOwner.length} \u4e2a\u7701\u4efd\u6ca1\u6709\u6240\u5c5e\u52bf\u529b`);
    }

    // 检查孤立省份（无邻居）
    const isolated = EDITOR.provinces.filter(p => !p.neighbors || p.neighbors.length === 0);
    if (isolated.length > 0) {
        issues.push(`${isolated.length} \u4e2a\u7701\u4efd\u6ca1\u6709\u90bb\u63a5\u7701\u4efd (\u8bf7\u8fd0\u884c\u201c\u8ba1\u7b97\u90bb\u63a5\u5173\u7cfb\u201d)`);
    }

    // 显示结果
    if (issues.length === 0) {
        alert('\u2705 \u5730\u56fe\u9a8c\u8bc1\u901a\u8fc7\uff01');
    } else {
        let html = '<div style="padding: 20px;"><h3 style="margin-bottom: 16px; color: #e74c3c;">\u53d1\u73b0 ' + issues.length + ' \u4e2a\u95ee\u9898</h3>';
        html += '<ul style="line-height: 1.8; padding-left: 20px;">';
        issues.forEach(function(issue) {
            html += '<li>' + issue + '</li>';
        });
        html += '</ul></div>';
        showModal('\u5730\u56fe\u9a8c\u8bc1', html);
    }
}

// AI 历史地图生成
function generateHistoricalMap() {
    const html = `
        <div style="padding: 20px;">
            <h3 style="margin-bottom: 16px;">AI \u5386\u53f2\u5730\u56fe\u751f\u6210</h3>
            <div class="input-group">
                <label>\u671d\u4ee3/\u65f6\u671f</label>
                <input type="text" id="ai-dynasty" placeholder="\u4f8b: \u4e09\u56fd\u65f6\u671f" value="\u4e09\u56fd\u65f6\u671f">
            </div>
            <div class="input-group">
                <label>\u5e74\u4efd</label>
                <input type="number" id="ai-year" placeholder="\u4f8b: 220" value="220">
            </div>
            <div class="input-group">
                <label>\u4e3b\u8981\u52bf\u529b (\u9017\u53f7\u5206\u9694)</label>
                <input type="text" id="ai-factions" placeholder="\u4f8b: \u9b4f, \u8700, \u5434" value="\u9b4f, \u8700, \u5434">
            </div>
            <div class="input-group">
                <label>\u9644\u52a0\u8bf4\u660e</label>
                <textarea id="ai-notes" placeholder="\u4f8b: \u8d64\u58c1\u4e4b\u6218\u540e\uff0c\u4e09\u56fd\u9f0e\u7acb" style="height: 60px;"></textarea>
            </div>
            <button class="btn" onclick="executeAIGeneration()" style="width: 100%; margin-top: 12px;">\u751f\u6210\u5386\u53f2\u5730\u56fe</button>
            <p style="color: #888; font-size: 12px; margin-top: 12px;">\u6ce8\u610f: \u8bf7\u5148\u52a0\u8f7d\u80cc\u666f\u5730\u56fe\u5e76\u7ed8\u5236\u7701\u4efd\uff0cAI \u5c06\u4e3a\u7701\u4efd\u5206\u914d\u6240\u5c5e\u52bf\u529b</p>
        </div>
    `;

    showModal('AI \u5386\u53f2\u5730\u56fe\u751f\u6210', html);
}

function executeAIGeneration() {
    const dynasty = document.getElementById('ai-dynasty').value;
    const year = document.getElementById('ai-year').value;
    const factionsInput = document.getElementById('ai-factions').value;
    const notes = document.getElementById('ai-notes').value;

    if (!dynasty || !year || !factionsInput) {
        alert('\u8bf7\u586b\u5199\u6240\u6709\u5fc5\u586b\u5b57\u6bb5');
        return;
    }

    if (EDITOR.provinces.length === 0) {
        alert('\u8bf7\u5148\u7ed8\u5236\u7701\u4efd');
        return;
    }

    const factions = factionsInput.split(',').map(s => s.trim());
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];

    // 简单分配：随机或按位置分配
    EDITOR.provinces.forEach(function(province, i) {
        const factionIndex = i % factions.length;
        province.owner = factions[factionIndex];
        province.color = colors[factionIndex % colors.length];
        province.layer.setStyle({ fillColor: province.color });
    });

    closeModal();
    alert(`\u5df2\u4e3a ${EDITOR.provinces.length} \u4e2a\u7701\u4efd\u5206\u914d\u52bf\u529b`);
    updateStats();
}

// 加载和保存功能增强
function showLoading(message) {
    const loading = document.createElement('div');
    loading.id = 'loading-overlay';
    loading.className = 'loading';
    loading.innerHTML = `
        <div class="loading-spinner"></div>
        <div>${message || '\u52a0\u8f7d\u4e2d...'}</div>
    `;
    document.body.appendChild(loading);
}

function hideLoading() {
    const loading = document.getElementById('loading-overlay');
    if (loading) {
        document.body.removeChild(loading);
    }
}
