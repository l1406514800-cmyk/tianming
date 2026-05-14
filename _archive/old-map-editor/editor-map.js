// ============================================================
// 剧本编辑器 — 地图系统 (Map System + Voronoi/Delaunay)
// 依赖: editor-core.js (scriptData, escHtml, autoSave, etc.)
// ============================================================
  // ============================================================
  // 地图系统编辑器函数
  // ============================================================

  /**
   * 渲染地图系统面板
   */
  function renderMapSystem() {
    if (!scriptData.mapData) {
      scriptData.mapData = {
        enabled: false,
        cities: {},
        polygons: {},
        edges: {},
        config: {
          width: 1200,
          height: 800,
          backgroundColor: '#f5f5dc',
          borderColor: '#000000',
          borderWidth: 2
        }
      };
    }

    var md = scriptData.mapData;

    // 更新启用状态
    var enabledCheckbox = document.getElementById('mapSystemEnabled');
    if (enabledCheckbox) {
      enabledCheckbox.checked = md.enabled || false;
    }

    // 更新配置
    var widthInput = document.getElementById('mapWidth');
    if (widthInput) widthInput.value = md.config.width || 1200;

    var heightInput = document.getElementById('mapHeight');
    if (heightInput) heightInput.value = md.config.height || 800;

    var bgColorInput = document.getElementById('mapBgColor');
    if (bgColorInput) bgColorInput.value = md.config.backgroundColor || '#f5f5dc';

    var borderColorInput = document.getElementById('mapBorderColor');
    if (borderColorInput) borderColorInput.value = md.config.borderColor || '#000000';

    var borderWidthInput = document.getElementById('mapBorderWidth');
    if (borderWidthInput) borderWidthInput.value = md.config.borderWidth || 2;

    // 渲染城市列表
    renderMapCitiesList();

    // 渲染地图预览
    renderMapEditorPreview();
  }

  /**
   * 渲染城市列表
   */
  function renderMapCitiesList() {
    var listEl = document.getElementById('map-cities-list');
    if (!listEl) return;

    var md = scriptData.mapData;
    if (!md || !md.cities || Object.keys(md.cities).length === 0) {
      listEl.innerHTML = '<div style="color: #6a6560; text-align: center; padding: 20px;">暂无城市数据</div>';
      return;
    }

    var html = '';
    Object.values(md.cities).forEach(function(city) {
      html += '<div style="margin-bottom: 8px; padding: 8px; background: #2a2a35; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">';
      html += '<div>';
      html += '<strong style="color: #c9a96e;">' + escHtml(city.name) + '</strong>';
      html += '<span style="color: #6a6560; font-size: 12px; margin-left: 8px;">(' + city.x + ', ' + city.y + ')</span>';
      html += '<br><span style="color: #9a9590; font-size: 12px;">归属: ' + escHtml(city.owner) + '</span>';
      html += '</div>';
      html += '<div style="display: flex; gap: 4px;">';
      html += '<button class="btn-edit" onclick="editMapCity(' + city.id + ')" style="font-size: 11px; padding: 4px 8px;">编辑</button>';
      html += '<button class="btn-edit" onclick="editPolygonVertices(' + city.id + ')" style="font-size: 11px; padding: 4px 8px;">编辑顶点</button>';
      html += '<button class="btn-delete" onclick="deleteMapCity(' + city.id + ')" style="font-size: 11px; padding: 4px 8px;">删除</button>';
      html += '</div>';
      html += '</div>';
    });

    listEl.innerHTML = html;
  }

  /**
   * 渲染地图预览
   */
  function renderMapEditorPreview() {
    var canvas = document.getElementById('mapEditorCanvas');
    if (!canvas) return;

    var md = scriptData.mapData;
    if (!md) return;

    var ctx = canvas.getContext('2d');

    // 清空画布
    ctx.fillStyle = md.config.backgroundColor || '#f5f5dc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 缩放比例（适应画布）
    var scaleX = canvas.width / (md.config.width || 1200);
    var scaleY = canvas.height / (md.config.height || 800);
    var scale = Math.min(scaleX, scaleY);

    ctx.save();
    ctx.scale(scale, scale);

    // 渲染多边形
    if (md.polygons) {
      Object.values(md.polygons).forEach(function(polygon) {
        var city = md.cities[polygon.cityId];
        if (!city || !polygon.points || polygon.points.length < 3) return;

        // 获取势力颜色
        var faction = scriptData.factions.find(function(f) { return f.name === city.owner; });
        var color = (faction && faction.color) ? faction.color : '#' + ((city.owner || '').split('').reduce(function(a, c) { return ((a << 5) - a + c.charCodeAt(0)) | 0; }, 0) & 0xFFFFFF).toString(16).padStart(6, '0');

        ctx.beginPath();
        polygon.points.forEach(function(point, index) {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = md.config.borderColor || '#000000';
        ctx.lineWidth = md.config.borderWidth || 2;
        ctx.stroke();
      });
    }

    // 渲染城市标记
    if (md.cities) {
      Object.values(md.cities).forEach(function(city) {
        ctx.beginPath();
        ctx.arc(city.x, city.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(city.name, city.x, city.y - 8);

        ctx.font = '10px Arial';
        ctx.fillStyle = '#666666';
        ctx.fillText(city.owner, city.x, city.y + 18);
      });
    }

    ctx.restore();
  }

  /**
   * 更新地图系统配置
   */
  function updateMapSystemConfig(key, value) {
    if (!scriptData.mapData) {
      scriptData.mapData = {
        enabled: false,
        cities: {},
        polygons: {},
        edges: {},
        config: {
          width: 1200,
          height: 800,
          backgroundColor: '#f5f5dc',
          borderColor: '#000000',
          borderWidth: 2
        }
      };
    }

    if (key === 'enabled') {
      scriptData.mapData.enabled = value;
    } else {
      scriptData.mapData.config[key] = value;
    }

    renderMapEditorPreview();
  }

  /**
   * 添加城市
   */
  function addMapCity() {
    var maxW = scriptData.mapData.config.width || 1200;
    var maxH = scriptData.mapData.config.height || 800;
    // 生成势力选项
    var facOpts = '<option value="未定">未定</option>';
    if (scriptData.factions) scriptData.factions.forEach(function(f) { facOpts += '<option value="' + escHtml(f.name) + '">' + escHtml(f.name) + '</option>'; });

    var body = '<div class="form-group"><label>城市名称</label><input type="text" id="mc_name" placeholder="如：长安、洛阳"></div>';
    body += '<div style="display:flex;gap:12px;">';
    body += '<div class="form-group" style="flex:1;"><label>X 坐标 (0-' + maxW + ')</label><input type="number" id="mc_x" value="400" min="0" max="' + maxW + '"></div>';
    body += '<div class="form-group" style="flex:1;"><label>Y 坐标 (0-' + maxH + ')</label><input type="number" id="mc_y" value="300" min="0" max="' + maxH + '"></div></div>';
    body += '<div class="form-group"><label>归属势力</label><select id="mc_owner">' + facOpts + '</select></div>';
    body += '<div style="display:flex;gap:12px;">';
    body += '<div class="form-group" style="flex:1;"><label>人口</label><input type="number" id="mc_pop" value="10000" min="0"></div>';
    body += '<div class="form-group" style="flex:1;"><label>收入</label><input type="number" id="mc_income" value="1000" min="0"></div>';
    body += '<div class="form-group" style="flex:1;"><label>驻军</label><input type="number" id="mc_garrison" value="0" min="0"></div></div>';

    openGenericModal('添加城市', body, function() {
      var cityName = gv('mc_name');
      if (!cityName) { showToast('请输入城市名称'); return; }
      var cityX = Math.max(0, Math.min(maxW, parseInt(gv('mc_x')) || 400));
      var cityY = Math.max(0, Math.min(maxH, parseInt(gv('mc_y')) || 300));
      var cityId = Date.now();
      scriptData.mapData.cities[cityId] = {
        id: cityId, name: cityName, x: cityX, y: cityY,
        owner: gv('mc_owner') || '未定', neighbors: [],
        population: parseInt(gv('mc_pop')) || 10000,
        income: parseInt(gv('mc_income')) || 1000,
        garrison: parseInt(gv('mc_garrison')) || 0
      };
      var w = 100, h = 100;
      scriptData.mapData.polygons[cityId] = { cityId: cityId, points: [
        {x: cityX - w, y: cityY - h}, {x: cityX + w, y: cityY - h},
        {x: cityX + w, y: cityY + h}, {x: cityX - w, y: cityY + h}
      ]};
      closeGenericModal();
      renderMapCitiesList();
      renderMapEditorPreview();
      if (typeof autoSave === 'function') autoSave();
      showToast('城市已添加');
    });
  }

  /**
   * 编辑城市
   */
  function editMapCity(cityId) {
    var city = scriptData.mapData.cities[cityId];
    if (!city) return;

    var maxW = scriptData.mapData.config.width || 1200;
    var maxH = scriptData.mapData.config.height || 800;
    var facOpts = '<option value="未定">未定</option>';
    if (scriptData.factions) scriptData.factions.forEach(function(f) { facOpts += '<option value="' + escHtml(f.name) + '"' + (city.owner === f.name ? ' selected' : '') + '>' + escHtml(f.name) + '</option>'; });

    var body = '<div class="form-group"><label>城市名称</label><input type="text" id="mc_name" value="' + escHtml(city.name) + '"></div>';
    body += '<div style="display:flex;gap:12px;">';
    body += '<div class="form-group" style="flex:1;"><label>X 坐标</label><input type="number" id="mc_x" value="' + city.x + '" min="0" max="' + maxW + '"></div>';
    body += '<div class="form-group" style="flex:1;"><label>Y 坐标</label><input type="number" id="mc_y" value="' + city.y + '" min="0" max="' + maxH + '"></div></div>';
    body += '<div class="form-group"><label>归属势力</label><select id="mc_owner">' + facOpts + '</select></div>';
    body += '<div style="display:flex;gap:12px;">';
    body += '<div class="form-group" style="flex:1;"><label>人口</label><input type="number" id="mc_pop" value="' + (city.population || 0) + '" min="0"></div>';
    body += '<div class="form-group" style="flex:1;"><label>收入</label><input type="number" id="mc_income" value="' + (city.income || 0) + '" min="0"></div>';
    body += '<div class="form-group" style="flex:1;"><label>驻军</label><input type="number" id="mc_garrison" value="' + (city.garrison || 0) + '" min="0"></div></div>';
    // 地形
    var _terrOpts = '<option value="">默认(平原)</option>';
    ['plains','hills','mountains','forest','desert','grassland','swamp','water'].forEach(function(t) {
      var names = {plains:'平原',hills:'丘陵',mountains:'山地',forest:'森林',desert:'沙漠',grassland:'草原',swamp:'沼泽',water:'水域'};
      _terrOpts += '<option value="'+t+'"'+(city.terrain===t?' selected':'')+'>'+names[t]+'</option>';
    });
    body += '<div style="display:flex;gap:12px;">';
    body += '<div class="form-group" style="flex:1;"><label>地形</label><select id="mc_terrain">'+_terrOpts+'</select></div>';
    body += '<div class="form-group" style="flex:1;"><label>关隘等级(0-5)</label><input type="number" id="mc_passLevel" value="'+(city.passLevel||0)+'" min="0" max="5"></div>';
    body += '<div class="form-group" style="flex:1;"><label>关隘名称</label><input type="text" id="mc_passName" value="'+(city.passName||'')+'" placeholder="如:潼关"></div></div>';
    body += '<div style="display:flex;gap:12px;">';
    body += '<div class="form-group" style="flex:1;"><label>钱产出比</label><input type="number" id="mc_moneyRatio" value="'+(city.moneyRatio||3)+'" min="0" max="10"></div>';
    body += '<div class="form-group" style="flex:1;"><label>粮产出比</label><input type="number" id="mc_grainRatio" value="'+(city.grainRatio||7)+'" min="0" max="10"></div></div>';

    openGenericModal('编辑城市 — ' + city.name, body, function() {
      city.name = gv('mc_name') || city.name;
      city.x = Math.max(0, Math.min(maxW, parseInt(gv('mc_x')) || city.x));
      city.y = Math.max(0, Math.min(maxH, parseInt(gv('mc_y')) || city.y));
      city.owner = gv('mc_owner') || city.owner;
      city.population = parseInt(gv('mc_pop')) || 0;
      city.income = parseInt(gv('mc_income')) || 0;
      city.garrison = parseInt(gv('mc_garrison')) || 0;
      city.terrain = gv('mc_terrain') || 'plains';
      city.passLevel = parseInt(gv('mc_passLevel')) || 0;
      city.passName = gv('mc_passName') || '';
      city.moneyRatio = parseInt(gv('mc_moneyRatio')) || 3;
      city.grainRatio = parseInt(gv('mc_grainRatio')) || 7;
      closeGenericModal();
      renderMapCitiesList();
      renderMapEditorPreview();
      if (typeof autoSave === 'function') autoSave();
      showToast('城市已更新');
    });
  }

  /**
   * 可视化编辑多边形顶点
   */
  function editPolygonVertices(cityId) {
    var polygon = scriptData.mapData.polygons[cityId];
    if (!polygon) {
      showToast('该城市没有多边形数据');
      return;
    }

    // 打开多边形编辑器
    openPolygonEditor(cityId, polygon);
  }

  /**
   * 打开多边形编辑器
   */
  function openPolygonEditor(cityId, polygon) {
    var modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:10000;display:flex;align-items:center;justify-content:center;';

    var content = document.createElement('div');
    content.style.cssText = 'background:#1a1a25;padding:20px;border-radius:8px;max-width:90%;max-height:90%;overflow:auto;';

    var title = document.createElement('h3');
    title.textContent = '编辑多边形顶点 - ' + scriptData.mapData.cities[cityId].name;
    title.style.cssText = 'color:#c9a96e;margin-bottom:20px;';
    content.appendChild(title);

    // 工具栏
    var toolbar = document.createElement('div');
    toolbar.style.cssText = 'display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;';

    var editState = {
      vertices: JSON.parse(JSON.stringify(polygon.points)),
      selectedVertex: -1,
      hoveredVertex: -1,
      dragging: false,
      mode: 'move',
      gridSize: 20,
      snapToGrid: true
    };

    var moveBtn = document.createElement('button');
    moveBtn.textContent = '🖱️ 移动顶点';
    moveBtn.onclick = function() {
      editState.mode = 'move';
      updateToolbarButtons();
    };
    toolbar.appendChild(moveBtn);

    var addBtn = document.createElement('button');
    addBtn.textContent = '➕ 添加顶点';
    addBtn.onclick = function() {
      editState.mode = 'add';
      updateToolbarButtons();
    };
    toolbar.appendChild(addBtn);

    var deleteBtn = document.createElement('button');
    deleteBtn.textContent = '❌ 删除顶点';
    deleteBtn.onclick = function() {
      editState.mode = 'delete';
      updateToolbarButtons();
    };
    toolbar.appendChild(deleteBtn);

    var snapBtn = document.createElement('button');
    snapBtn.textContent = '🧲 网格吸附: 开';
    snapBtn.onclick = function() {
      editState.snapToGrid = !editState.snapToGrid;
      snapBtn.textContent = '🧲 网格吸附: ' + (editState.snapToGrid ? '开' : '关');
      renderEditor();
    };
    toolbar.appendChild(snapBtn);

    var gridSizeInput = document.createElement('input');
    gridSizeInput.type = 'number';
    gridSizeInput.value = editState.gridSize;
    gridSizeInput.min = 10;
    gridSizeInput.max = 50;
    gridSizeInput.style.cssText = 'width:80px;padding:5px;';
    gridSizeInput.onchange = function() {
      editState.gridSize = parseInt(this.value);
      renderEditor();
    };
    var gridLabel = document.createElement('label');
    gridLabel.textContent = '网格: ';
    gridLabel.style.color = '#c9a96e';
    gridLabel.appendChild(gridSizeInput);
    toolbar.appendChild(gridLabel);

    function updateToolbarButtons() {
      moveBtn.style.background = editState.mode === 'move' ? '#c9a96e' : '';
      addBtn.style.background = editState.mode === 'add' ? '#c9a96e' : '';
      deleteBtn.style.background = editState.mode === 'delete' ? '#c9a96e' : '';
    }

    content.appendChild(toolbar);
    updateToolbarButtons();

    // 创建编辑画布
    var canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    canvas.style.cssText = 'border:2px solid #c9a96e;background:#f5f5dc;cursor:crosshair;display:block;margin-bottom:20px;';
    content.appendChild(canvas);

    var ctx = canvas.getContext('2d');

    // 渲染函数
    function renderEditor() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 绘制网格
      if (editState.snapToGrid) {
        ctx.strokeStyle = '#ddd';
        ctx.lineWidth = 0.5;
        for (var x = 0; x < canvas.width; x += editState.gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (var y = 0; y < canvas.height; y += editState.gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }
      }

      // 绘制多边形
      if (editState.vertices.length > 0) {
        ctx.beginPath();
        editState.vertices.forEach(function(v, i) {
          if (i === 0) ctx.moveTo(v.x, v.y);
          else ctx.lineTo(v.x, v.y);
        });
        ctx.closePath();
        ctx.fillStyle = 'rgba(200, 150, 100, 0.3)';
        ctx.fill();
        ctx.strokeStyle = '#c9a96e';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // 绘制顶点
      editState.vertices.forEach(function(v, i) {
        ctx.beginPath();
        ctx.arc(v.x, v.y, 8, 0, Math.PI * 2);

        if (i === editState.selectedVertex) {
          ctx.fillStyle = '#ff0000';
        } else if (i === editState.hoveredVertex) {
          ctx.fillStyle = '#ffaa00';
        } else {
          ctx.fillStyle = '#c9a96e';
        }
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // 绘制顶点编号
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(i, v.x, v.y);
      });

      // 显示提示信息
      ctx.fillStyle = '#000';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      var modeText = editState.mode === 'move' ? '移动模式：拖拽顶点' :
                     editState.mode === 'add' ? '添加模式：点击添加顶点' :
                     '删除模式：点击删除顶点';
      ctx.fillText(modeText, 10, 10);
      ctx.fillText('顶点数: ' + editState.vertices.length, 10, 30);
    }

    // 鼠标事件
    canvas.onmousemove = function(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;

      if (editState.dragging && editState.selectedVertex >= 0) {
        var newX = mx;
        var newY = my;

        if (editState.snapToGrid) {
          newX = Math.round(newX / editState.gridSize) * editState.gridSize;
          newY = Math.round(newY / editState.gridSize) * editState.gridSize;
        }

        editState.vertices[editState.selectedVertex] = { x: newX, y: newY };
        renderEditor();
      } else {
        editState.hoveredVertex = -1;
        for (var i = 0; i < editState.vertices.length; i++) {
          var v = editState.vertices[i];
          var dist = Math.sqrt((mx - v.x) * (mx - v.x) + (my - v.y) * (my - v.y));
          if (dist < 12) {
            editState.hoveredVertex = i;
            break;
          }
        }
        renderEditor();
      }
    };

    canvas.onmousedown = function(e) {
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;

      if (editState.mode === 'move') {
        for (var i = 0; i < editState.vertices.length; i++) {
          var v = editState.vertices[i];
          var dist = Math.sqrt((mx - v.x) * (mx - v.x) + (my - v.y) * (my - v.y));
          if (dist < 12) {
            editState.selectedVertex = i;
            editState.dragging = true;
            return;
          }
        }
      } else if (editState.mode === 'add') {
        var newX = mx;
        var newY = my;

        if (editState.snapToGrid) {
          newX = Math.round(newX / editState.gridSize) * editState.gridSize;
          newY = Math.round(newY / editState.gridSize) * editState.gridSize;
        }

        editState.vertices.push({ x: newX, y: newY });
        renderEditor();
      } else if (editState.mode === 'delete') {
        for (var i = 0; i < editState.vertices.length; i++) {
          var v = editState.vertices[i];
          var dist = Math.sqrt((mx - v.x) * (mx - v.x) + (my - v.y) * (my - v.y));
          if (dist < 12) {
            if (editState.vertices.length > 3) {
              editState.vertices.splice(i, 1);
              renderEditor();
            } else {
              showToast('至少需要3个顶点');
            }
            return;
          }
        }
      }
    };

    canvas.onmouseup = function() {
      editState.dragging = false;
    };

    // 按钮
    var btnContainer = document.createElement('div');
    btnContainer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';

    var saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 保存';
    saveBtn.style.cssText = 'background:#4CAF50;color:white;padding:10px 20px;';
    saveBtn.onclick = function() {
      scriptData.mapData.polygons[cityId].points = editState.vertices;
      document.body.removeChild(modal);
      renderMapEditorPreview();
      showToast('多边形已更新');
    };
    btnContainer.appendChild(saveBtn);

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = '❌ 取消';
    cancelBtn.style.cssText = 'padding:10px 20px;';
    cancelBtn.onclick = function() {
      document.body.removeChild(modal);
    };
    btnContainer.appendChild(cancelBtn);

    content.appendChild(btnContainer);
    modal.appendChild(content);
    document.body.appendChild(modal);

    renderEditor();
  }

  /**
   * 删除城市
   */
  function deleteMapCity(cityId) {
    if (!confirm('确定删除该城市？')) return;

    delete scriptData.mapData.cities[cityId];
    delete scriptData.mapData.polygons[cityId];

    renderMapCitiesList();
    renderMapEditorPreview();
    showToast('城市已删除');
  }

  /**
   * 导出地图数据
   */
  function exportMapData() {
    var json = JSON.stringify({
      cities: scriptData.mapData.cities,
      polygons: scriptData.mapData.polygons,
      edges: scriptData.mapData.edges
    }, null, 2);

    var blob = new Blob([json], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'map_data.json';
    a.click();
    URL.revokeObjectURL(url);

    showToast('地图数据已导出');
  }

  /**
   * 导入地图数据
   */
  function importMapData() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = function(e) {
      var file = e.target.files[0];
      var reader = new FileReader();

      reader.onload = function(event) {
        try {
          var data = JSON.parse(event.target.result);
          scriptData.mapData.cities = data.cities || {};
          scriptData.mapData.polygons = data.polygons || {};
          scriptData.mapData.edges = data.edges || {};

          renderMapCitiesList();
          renderMapEditorPreview();
          showToast('地图数据导入成功');
        } catch (err) {
          showToast('导入失败：' + err.message);
        }
      };

      reader.readAsText(file);
    };

    input.click();
  }

  /**
   * 渲染地形配置
   */
  function renderTerrainConfig() {
    var listEl = document.getElementById('terrain-config-list');
    if (!listEl) return;

    var md = scriptData.mapData;
    if (!md || !md.cities || Object.keys(md.cities).length === 0) {
      listEl.innerHTML = '<div style="color: #6a6560; text-align: center; padding: 20px;">暂无城市数据</div>';
      return;
    }

    var terrainTypes = [
      { value: 'PLAIN', label: '平原', color: '#90EE90' },
      { value: 'MOUNTAIN', label: '山地', color: '#8B7355' },
      { value: 'WATER', label: '水域', color: '#4682B4' },
      { value: 'FOREST', label: '森林', color: '#228B22' }
    ];

    var html = '';
    Object.values(md.cities).forEach(function(city) {
      html += '<div style="padding: 10px; background: #2a2a35; border-radius: 4px;">';
      html += '<div style="color: #c9a96e; font-weight: bold; margin-bottom: 6px;">' + escHtml(city.name) + '</div>';
      html += '<select onchange="updateCityTerrain(' + city.id + ', this.value)" style="width: 100%; padding: 4px; background: #1a1a25; color: #c9a96e; border: 1px solid #3a3a45; border-radius: 3px;">';

      terrainTypes.forEach(function(terrain) {
        var selected = (city.terrain === terrain.value) ? 'selected' : '';
        html += '<option value="' + terrain.value + '" ' + selected + '>' + terrain.label + '</option>';
      });

      html += '</select>';
      html += '</div>';
    });

    listEl.innerHTML = html;
  }

  /**
   * 更新城市地形
   */
  function updateCityTerrain(cityId, terrainType) {
    if (!scriptData.mapData || !scriptData.mapData.cities) return;

    var city = scriptData.mapData.cities[cityId];
    if (city) {
      city.terrain = terrainType;
      renderMapEditorPreview();
      showToast('已更新 ' + city.name + ' 的地形为 ' + terrainType);
    }
  }

  /**
   * 在编辑器中生成Voronoi图
   */
  function generateVoronoiMapInEditor() {
    if (!scriptData.mapSystem || !scriptData.mapSystem.enabled) {
      showToast('请先启用地图系统');
      return;
    }

    if (!scriptData.mapSystem.cities || Object.keys(scriptData.mapSystem.cities).length < 3) {
      showToast('至少需要3个城市才能生成Voronoi图');
      return;
    }

    var cities = Object.values(scriptData.mapSystem.cities);

    // 1. 计算Delaunay三角剖分
    var triangles = delaunayTriangulationEditor(cities);

    // 2. 从三角剖分生成Voronoi图
    var voronoiCells = generateVoronoiCellsEditor(cities, triangles);

    // 3. 裁剪到地图边界
    var mapBounds = {
      minX: 0,
      minY: 0,
      maxX: scriptData.mapSystem.config.width || 1200,
      maxY: scriptData.mapSystem.config.height || 800
    };
    voronoiCells = clipVoronoiCellsEditor(voronoiCells, mapBounds);

    // 4. 更新地图数据
    scriptData.mapSystem.polygons = {};
    voronoiCells.forEach(function(cell) {
      scriptData.mapSystem.polygons[cell.cityId] = {
        cityId: cell.cityId,
        points: cell.points
      };
    });

    // 5. 重新渲染预览
    renderMapEditorPreview();
    showToast('Voronoi图生成成功！');
  }

  // Delaunay三角剖分（编辑器版本）
  function delaunayTriangulationEditor(cities) {
    var minX = Math.min.apply(null, cities.map(function(c) { return c.x; }));
    var minY = Math.min.apply(null, cities.map(function(c) { return c.y; }));
    var maxX = Math.max.apply(null, cities.map(function(c) { return c.x; }));
    var maxY = Math.max.apply(null, cities.map(function(c) { return c.y; }));

    var dx = maxX - minX;
    var dy = maxY - minY;
    var deltaMax = Math.max(dx, dy);
    var midX = (minX + maxX) / 2;
    var midY = (minY + maxY) / 2;

    var superTriangle = [
      { x: midX - 20 * deltaMax, y: midY - deltaMax, id: -1 },
      { x: midX, y: midY + 20 * deltaMax, id: -2 },
      { x: midX + 20 * deltaMax, y: midY - deltaMax, id: -3 }
    ];

    var triangles = [superTriangle];

    cities.forEach(function(city) {
      var badTriangles = [];

      triangles.forEach(function(triangle) {
        if (pointInCircumcircleEditor(city, triangle)) {
          badTriangles.push(triangle);
        }
      });

      var polygon = [];
      badTriangles.forEach(function(triangle) {
        for (var i = 0; i < 3; i++) {
          var edge = [triangle[i], triangle[(i + 1) % 3]];
          var isShared = false;

          badTriangles.forEach(function(otherTriangle) {
            if (triangle === otherTriangle) return;
            for (var j = 0; j < 3; j++) {
              var otherEdge = [otherTriangle[j], otherTriangle[(j + 1) % 3]];
              if (edgesEqualEditor(edge, otherEdge)) {
                isShared = true;
              }
            }
          });

          if (!isShared) {
            polygon.push(edge);
          }
        }
      });

      triangles = triangles.filter(function(t) {
        return badTriangles.indexOf(t) === -1;
      });

      polygon.forEach(function(edge) {
        triangles.push([edge[0], edge[1], city]);
      });
    });

    triangles = triangles.filter(function(triangle) {
      return triangle[0].id >= 0 && triangle[1].id >= 0 && triangle[2].id >= 0;
    });

    return triangles;
  }

  function pointInCircumcircleEditor(point, triangle) {
    var ax = triangle[0].x - point.x;
    var ay = triangle[0].y - point.y;
    var bx = triangle[1].x - point.x;
    var by = triangle[1].y - point.y;
    var cx = triangle[2].x - point.x;
    var cy = triangle[2].y - point.y;

    var det = (ax * ax + ay * ay) * (bx * cy - cx * by) -
              (bx * bx + by * by) * (ax * cy - cx * ay) +
              (cx * cx + cy * cy) * (ax * by - bx * ay);

    return det > 0;
  }

  function edgesEqualEditor(edge1, edge2) {
    return (edge1[0] === edge2[0] && edge1[1] === edge2[1]) ||
           (edge1[0] === edge2[1] && edge1[1] === edge2[0]);
  }

  function generateVoronoiCellsEditor(cities, triangles) {
    var cells = {};

    cities.forEach(function(city) {
      cells[city.id] = {
        cityId: city.id,
        center: { x: city.x, y: city.y },
        vertices: []
      };
    });

    triangles.forEach(function(triangle) {
      var circumcenter = calculateCircumcenterEditor(triangle);

      for (var i = 0; i < 3; i++) {
        var cityId = triangle[i].id;
        if (cells[cityId]) {
          cells[cityId].vertices.push(circumcenter);
        }
      }
    });

    Object.values(cells).forEach(function(cell) {
      cell.vertices = sortVerticesByAngleEditor(cell.vertices, cell.center);
      cell.points = cell.vertices;
    });

    return Object.values(cells);
  }

  function calculateCircumcenterEditor(triangle) {
    var ax = triangle[0].x, ay = triangle[0].y;
    var bx = triangle[1].x, by = triangle[1].y;
    var cx = triangle[2].x, cy = triangle[2].y;

    var d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    var ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    var uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

    return { x: ux, y: uy };
  }

  function sortVerticesByAngleEditor(vertices, center) {
    return vertices.sort(function(a, b) {
      var angleA = Math.atan2(a.y - center.y, a.x - center.x);
      var angleB = Math.atan2(b.y - center.y, b.x - center.x);
      return angleA - angleB;
    });
  }

  function clipVoronoiCellsEditor(cells, bounds) {
    return cells.map(function(cell) {
      cell.points = clipPolygonToBoundsEditor(cell.points, bounds);
      return cell;
    });
  }

  function clipPolygonToBoundsEditor(polygon, bounds) {
    var output = polygon;

    var edges = [
      { x: bounds.minX, y: 0, dx: 0, dy: 1 },
      { x: 0, y: bounds.maxY, dx: 1, dy: 0 },
      { x: bounds.maxX, y: 0, dx: 0, dy: -1 },
      { x: 0, y: bounds.minY, dx: -1, dy: 0 }
    ];

    edges.forEach(function(edge) {
      var input = output;
      output = [];

      if (input.length === 0) return;

      var prevVertex = input[input.length - 1];

      input.forEach(function(vertex) {
        var prevInside = isInsideBoundaryEditor(prevVertex, edge, bounds);
        var vertexInside = isInsideBoundaryEditor(vertex, edge, bounds);

        if (vertexInside) {
          if (!prevInside) {
            var intersection = computeIntersectionEditor(prevVertex, vertex, edge, bounds);
            if (intersection) output.push(intersection);
          }
          output.push(vertex);
        } else if (prevInside) {
          var intersection = computeIntersectionEditor(prevVertex, vertex, edge, bounds);
          if (intersection) output.push(intersection);
        }

        prevVertex = vertex;
      });
    });

    return output;
  }

  function isInsideBoundaryEditor(point, edge, bounds) {
    if (edge.dx === 0 && edge.dy === 1) return point.x >= bounds.minX;
    if (edge.dx === 1 && edge.dy === 0) return point.y <= bounds.maxY;
    if (edge.dx === 0 && edge.dy === -1) return point.x <= bounds.maxX;
    if (edge.dx === -1 && edge.dy === 0) return point.y >= bounds.minY;
    return true;
  }

  function computeIntersectionEditor(p1, p2, edge, bounds) {
    var x1 = p1.x, y1 = p1.y;
    var x2 = p2.x, y2 = p2.y;

    if (edge.dx === 0 && edge.dy === 1) {
      var t = (bounds.minX - x1) / (x2 - x1);
      return { x: bounds.minX, y: y1 + t * (y2 - y1) };
    }
    if (edge.dx === 1 && edge.dy === 0) {
      var t = (bounds.maxY - y1) / (y2 - y1);
      return { x: x1 + t * (x2 - x1), y: bounds.maxY };
    }
    if (edge.dx === 0 && edge.dy === -1) {
      var t = (bounds.maxX - x1) / (x2 - x1);
      return { x: bounds.maxX, y: y1 + t * (y2 - y1) };
    }
    if (edge.dx === -1 && edge.dy === 0) {
      var t = (bounds.minY - y1) / (y2 - y1);
      return { x: x1 + t * (x2 - x1), y: bounds.minY };
    }
    return null;
  }

  // 将函数暴露到全局作用域
  window.renderMapSystem = renderMapSystem;
  window.updateMapSystemConfig = updateMapSystemConfig;
  window.addMapCity = addMapCity;
  window.editMapCity = editMapCity;
  window.deleteMapCity = deleteMapCity;
  window.exportMapData = exportMapData;
  window.importMapData = importMapData;
  window.renderMapEditorPreview = renderMapEditorPreview;
  window.generateVoronoiMapInEditor = generateVoronoiMapInEditor;
  window.editPolygonVertices = editPolygonVertices;


