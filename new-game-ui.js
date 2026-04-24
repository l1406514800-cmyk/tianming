// 新游戏UI系统 - 参考欧陆风云4风格
// 用于替换 index.html 的游戏界面

/**
 * 初始化新游戏UI
 */
function initNewGameUI() {
    const container = document.getElementById('game-container');
    if (!container) return;

    container.innerHTML = `
        <div id="top-bar" class="ngui-topbar">
            <div id="top-variables" style="display:flex;gap:8px;flex:1;"></div>
            <button id="btn-more-vars" class="ngui-var-btn" title="查看全部变量">⋯</button>
            <div id="time-display" class="ngui-time" title="公元时间">
                <div id="time-main" style="font-weight:bold;"></div>
                <div id="time-sub" class="ngui-time-sub"></div>
            </div>
        </div>
        <div class="ngui-body">
            <div id="left-panel" class="ngui-left">
                <div class="ngui-left-tabs">
                    <button class="ngui-left-tab active" data-tab="shiji">史记</button>
                    <button class="ngui-left-tab" data-tab="details">详情</button>
                </div>
                <div id="left-content" class="ngui-left-content">
                    <div id="shiji-content"></div>
                    <div id="details-content" style="display:none;"></div>
                </div>
            </div>
            <div id="center-area" class="ngui-center">
                <div id="map-canvas-container" style="width:100%;height:100%;"></div>
            </div>
            <div id="right-panel" class="ngui-right">
                <div id="action-buttons-container" class="ngui-actions">
                    <button class="ngui-action ngui-action-primary" onclick="switchGTab(null,'gt-zhaozheng');var zp=document.getElementById('gt-zhaozheng');if(zp)zp.innerHTML=_renderZhaozhengCenter();"><div class="ngui-action-title">${tmIcon('office',14)} 朝政中心</div><div class="ngui-action-sub">总览全部操作</div></button>
                    <div class="ngui-group">实录</div>
                    <button class="ngui-action" onclick="switchGTab(null,'gt-qiju')"><div class="ngui-action-title">${tmIcon('qiju',14)} 起居注</div><div class="ngui-action-sub">诏谕 · 行录</div></button>
                    <button class="ngui-action" onclick="switchGTab(null,'gt-jishi')"><div class="ngui-action-title">${tmIcon('history',14)} 纪事本末</div></button>
                    <button class="ngui-action" onclick="switchGTab(null,'gt-biannian')"><div class="ngui-action-title">${tmIcon('chronicle',14)} 编年</div></button>

                    <div class="ngui-group">政务</div>
                    <button class="ngui-action" onclick="switchGTab(null,'gt-edict')"><div class="ngui-action-title">${tmIcon('scroll',14)} 诏令</div><div class="ngui-action-sub">政军外经</div></button>
                    <button class="ngui-action" onclick="switchGTab(null,'gt-memorial')"><div class="ngui-action-title">${tmIcon('memorial',14)} 奏议</div><div class="ngui-action-sub">查看奏疏</div></button>
                    <button class="ngui-action" onclick="switchGTab(null,'gt-wendui')"><div class="ngui-action-title">${tmIcon('dialogue',14)} 问对</div><div class="ngui-action-sub">与臣子对话</div></button>

                    <div class="ngui-group">管理</div>
                    <button class="ngui-action" onclick="switchGTab(null,'gt-office')"><div class="ngui-action-title">${tmIcon('office',14)} 官制</div><div class="ngui-action-sub">官员任免</div></button>
                    <button class="ngui-action" onclick="switchGTab(null,'gt-renwu')"><div class="ngui-action-title">${tmIcon('person',14)} 人物志</div><div class="ngui-action-sub">查看人物</div></button>

                    <button id="btn-more-actions" class="ngui-more" title="更多功能">⋯</button>
                    <div id="more-actions" style="display:none;">
                        <div class="ngui-group">发展</div>
                        <button class="ngui-action" onclick="switchGTab(null,'gt-tech')"><div class="ngui-action-title">${tmIcon('policy',14)} 科技树</div><div class="ngui-action-sub">军事 · 民用</div></button>
                        <button class="ngui-action" onclick="switchGTab(null,'gt-civic')"><div class="ngui-action-title">${tmIcon('policy',14)} 民政树</div><div class="ngui-action-sub">城市 · 政策</div></button>
                        <div class="ngui-group">其他</div>
                        <button class="ngui-action" onclick="TM.MapSystem.open('regions')"><div class="ngui-action-title">${tmIcon('map',14)} 地图</div><div class="ngui-action-sub">查看全图</div></button>
                        <button class="ngui-action" onclick="switchGTab(null,'gt-shiji')"><div class="ngui-action-title">${tmIcon('history',14)} 史记</div><div class="ngui-action-sub">历史记录</div></button>
                    </div>
                </div>
                <div class="ngui-endturn-wrap">
                    <button id="btn-end-turn" class="ngui-endturn" onclick="confirmEndTurn()">${tmIcon('end-turn',16)} 诏付有司</button>
                </div>
            </div>
        </div>
    `;

    // 初始化各个组件
    initTopVariables();
    initTimeDisplay();
    // 左侧面板、中间地图、右侧按钮已在HTML中定义，无需额外初始化
}

/**
 * 初始化左侧面板（占位函数）
 */
function initLeftPanel() {
    // 左侧面板内容由 renderLeftPanel() 更新
    // 这里只是占位，实际内容在游戏运行时动态更新
}

/**
 * 初始化中间地图（占位函数）
 */
function initCenterMap() {
    // 中间地图容器已在HTML中定义
    // 实际地图渲染由 renderGameMap() 或其他函数处理
}

/**
 * 初始化右侧按钮（占位函数）
 */
function initActionButtons() {
    // 右侧按钮已在HTML中定义，onclick事件已绑定
    // 无需额外初始化
}

/**
 * 初始化顶部变量显示
 */
function initTopVariables() {
    const container = document.getElementById('top-variables');
    if (!container) return;

    // 获取前6个变量
    const vars = Object.entries(GM.vars).slice(0, 6);

    vars.forEach(([key, varData]) => {
        const varEl = document.createElement('div');
        varEl.style.cssText = `
            padding: 8px 16px;
            background: rgba(139, 115, 85, 0.3);
            border: 1px solid #8b7355;
            border-radius: 4px;
            min-width: 120px;
            cursor: pointer;
        `;
        varEl.title = varData.desc || key;

        const icon = varData.icon || tmIcon('treasury',14);
        const value = varData.value || 0;
        const max = varData.max || 100;

        varEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 18px;">${icon}</span>
                <div style="flex: 1;">
                    <div style="font-size: 11px; color: #a0896d;">${varData.name || key}</div>
                    <div style="font-size: 14px; font-weight: bold; color: #d4af37;">${value}</div>
                </div>
            </div>
        `;

        varEl.onclick = () => showVariableDetails(key, varData);
        container.appendChild(varEl);
    });
}

/**
 * 初始化时间显示
 */
function initTimeDisplay() {
    updateTimeDisplay();
}

/**
 * 更新时间显示
 */
function updateTimeDisplay() {
    const containerEl = document.getElementById('time-main');
    const subEl = document.getElementById('time-sub');
    if (!containerEl || !subEl) return;

    // 获取当前时间信息
    const eraName = GM.eraName || '\u5929\u547D';
    const ganzhiDay = getGanzhiDay(GM.turn);
    const ganzhiYear = getGanzhiYear(GM.turn);

    // 主显示：年号 + 月份 + 干支日
    const t = P.time;
    const tpy = t.perTurn === '1y' ? 1 : t.perTurn === '1m' ? 12 : 4;
    const yo = Math.floor((GM.turn - 1) / tpy);
    const eraYear = yo + 1;
    const monthIndex = ((GM.turn - 1) % tpy);
    const month = monthIndex + 1;

    containerEl.textContent = `${eraName}${eraYear}\u5E74 ${month}\u6708 ${ganzhiDay}`;
    subEl.textContent = ganzhiYear;

    // Tooltip显示公元时间
    const gregorianDate = getGregorianDate(GM.turn);
    containerEl.title = `\u516C\u5143${gregorianDate}`;
}

/**
 * 获取干支日
 */
function getGanzhiDay(turn) {
    const t = P.time;
    const startDay = t.startDay || 1;
    const dayOffset = (turn - 1) + startDay - 1;

    const gan = ['\u7532', '\u4E59', '\u4E19', '\u4E01', '\u620A', '\u5DF1', '\u5E9A', '\u8F9B', '\u58EC', '\u7678'];
    const zhi = ['\u5B50', '\u4E11', '\u5BC5', '\u536F', '\u8FB0', '\u5DF3', '\u5348', '\u672A', '\u7533', '\u9149', '\u620C', '\u4EA5'];

    const ganIndex = dayOffset % 10;
    const zhiIndex = dayOffset % 12;

    return gan[ganIndex] + zhi[zhiIndex];
}

/**
 * 获取干支年
 */
function getGanzhiYear(turn) {
    const t = P.time;
    const tpy = t.perTurn === '1y' ? 1 : t.perTurn === '1m' ? 12 : 4;
    const yo = Math.floor((turn - 1) / tpy);
    const year = t.year + yo;

    const gan = ['\u7532', '\u4E59', '\u4E19', '\u4E01', '\u620A', '\u5DF1', '\u5E9A', '\u8F9B', '\u58EC', '\u7678'];
    const zhi = ['\u5B50', '\u4E11', '\u5BC5', '\u536F', '\u8FB0', '\u5DF3', '\u5348', '\u672A', '\u7533', '\u9149', '\u620C', '\u4EA5'];

    const ganIndex = ((year - 4) % 10 + 10) % 10;
    const zhiIndex = ((year - 4) % 12 + 12) % 12;

    return gan[ganIndex] + zhi[zhiIndex] + '\u5E74';
}

/**
 * 获取公元日期
 */
function getGregorianDate(turn) {
    const t = P.time;
    const tpy = t.perTurn === '1y' ? 1 : t.perTurn === '1m' ? 12 : 4;
    const yo = Math.floor((turn - 1) / tpy);
    const year = t.year + yo;
    const monthIndex = ((turn - 1) % tpy);
    const month = monthIndex + 1;

    return `${year}\u5E74${month}\u6708`;
}

/**
 * 显示变量详情（占位函数）
 */
function showVariableDetails(key, varData) {
    // 可以在这里实现变量详情弹窗
    alert(`${varData.name || key}\n\u5F53\u524D\u503C: ${varData.value}\n${varData.desc || ''}`);
}

/**
 * 显示全部变量弹窗
 */
function showAllVariables() {
    const html = `
        <div style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #1a1510;
            border: 2px solid #8b7355;
            border-radius: 8px;
            padding: 24px;
            max-width: 800px;
            max-height: 80vh;
            overflow-y: auto;
            z-index: 10000;
            box-shadow: 0 8px 32px rgba(0,0,0,0.8);
        ">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h2 style="margin: 0; color: #d4af37;">全部变量</h2>
                <button onclick="closeAllVariables()" style="
                    background: transparent;
                    border: none;
                    color: #d4af37;
                    font-size: 24px;
                    cursor: pointer;
                ">×</button>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px;">
                ${Object.entries(GM.vars).map(([key, varData]) => `
                    <div style="
                        padding: 12px;
                        background: rgba(139, 115, 85, 0.2);
                        border: 1px solid #8b7355;
                        border-radius: 4px;
                    ">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <span style="font-size: 20px;">${varData.icon || tmIcon('treasury',20)}</span>
                            <span style="color: #d4af37; font-weight: bold;">${varData.name || key}</span>
                        </div>
                        <div style="font-size: 24px; font-weight: bold; color: #fff; margin-bottom: 4px;">
                            ${varData.value || 0}
                        </div>
                        <div style="font-size: 11px; color: #a0896d;">
                            ${varData.desc || ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
        <div id="all-vars-overlay" onclick="closeAllVariables()" style="
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 9999;
        "></div>
    `;

    const container = document.createElement('div');
    container.id = 'all-vars-container';
    container.innerHTML = html;
    document.body.appendChild(container);
}

/**
 * 关闭全部变量弹窗
 */
function closeAllVariables() {
    const container = document.getElementById('all-vars-container');
    if (container) {
        document.body.removeChild(container);
    }
}

// 绑定更多变量按钮
document.addEventListener('DOMContentLoaded', function() {
    const btn = document.getElementById('btn-more-vars');
    if (btn) {
        btn.onclick = showAllVariables;
    }

    // 绑定左侧标签切换
    document.querySelectorAll('.left-tab').forEach(tab => {
        tab.onclick = function() {
            document.querySelectorAll('.left-tab').forEach(t => {
                t.classList.remove('active');
                t.style.color = '#a0896d';
                t.style.borderBottomColor = 'transparent';
            });
            this.classList.add('active');
            this.style.color = '#d4af37';
            this.style.borderBottomColor = '#d4af37';

            const tabName = this.dataset.tab;
            document.getElementById('shiji-content').style.display = tabName === 'shiji' ? 'block' : 'none';
            document.getElementById('details-content').style.display = tabName === 'details' ? 'block' : 'none';
        };
    });

    // 绑定"⋯"按钮切换更多功能
    const btnMore = document.getElementById('btn-more-actions');
    const moreActions = document.getElementById('more-actions');
    if (btnMore && moreActions) {
        btnMore.onclick = function() {
            if (moreActions.style.display === 'none' || !moreActions.style.display) {
                moreActions.style.display = 'block';
                this.textContent = '\u00D7';
                this.title = '\u6536\u8D77';
            } else {
                moreActions.style.display = 'none';
                this.textContent = '\u22EF';
                this.title = '\u66F4\u591A\u529F\u80FD';
            }
        };
    }
});

/**
 * 更新顶部变量显示
 */
function updateTopVariables() {
    const container = document.getElementById('top-variables');
    if (!container) return;

    // 清空并重新渲染
    container.innerHTML = '';
    const vars = Object.entries(GM.vars).slice(0, 6);

    vars.forEach(([key, varData]) => {
        const varEl = document.createElement('div');
        varEl.style.cssText = `
            padding: 8px 16px;
            background: rgba(139, 115, 85, 0.3);
            border: 1px solid #8b7355;
            border-radius: 4px;
            min-width: 120px;
            cursor: pointer;
        `;
        varEl.title = varData.desc || key;

        const icon = varData.icon || '\uD83D\uDCCA';
        const value = varData.value || 0;

        varEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 18px;">${icon}</span>
                <div style="flex: 1;">
                    <div style="font-size: 11px; color: #a0896d;">${varData.name || key}</div>
                    <div style="font-size: 14px; font-weight: bold; color: #d4af37;">${value}</div>
                </div>
            </div>
        `;

        varEl.onclick = () => showVariableDetails(key, varData);
        container.appendChild(varEl);
    });
}

// 导出函数
if (typeof window !== 'undefined') {
    window.initNewGameUI = initNewGameUI;
    window.updateTimeDisplay = updateTimeDisplay;
    window.updateTopVariables = updateTopVariables;
    window.showAllVariables = showAllVariables;
    window.closeAllVariables = closeAllVariables;
}
