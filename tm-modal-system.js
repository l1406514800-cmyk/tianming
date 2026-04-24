/* ============================================================
 * tm-modal-system.js — 通用模态框系统
 *
 * 来源：2026-04-24 R17 从 tm-patches.js:1861-1892 抽离
 *
 * 导出（挂到 window 全局）：
 *   gv(id)                              — 辅助：读取 input 值并 trim
 *   openGenericModal(title,bodyHTML,onSave) — 带【取消/保存】两按钮的编辑弹窗
 *   closeGenericModal()                 — 关闭当前通用弹窗
 *   showModal(title,bodyHTML,onClose)   — 带【确定】单按钮的信息弹窗
 *   closeModal()                        — 别名 closeGenericModal
 *
 * 依赖：
 *   - escHtml（全局工具，用于 showModal 的 title 转义）
 *   - _isPostTurnActive / _queuePostTurnModal（tm-endturn.js，后朝期间排队延后）
 *   - CSS class: .generic-modal-overlay / .generic-modal / header/body/footer / .bt .bs .bp .bsm
 *
 * 原位置（tm-patches.js）保留空注释作 redirect 标记。
 * ============================================================ */
function gv(id){var el=document.getElementById(id);return el?el.value.trim():"";}

function openGenericModal(title,bodyHTML,onSave){
  // 后朝进行中·排队延后（史记弹窗之后再依次弹出）
  if (typeof _isPostTurnActive === 'function' && _isPostTurnActive()) {
    _queuePostTurnModal(function(){ openGenericModal(title, bodyHTML, onSave); }, title);
    return;
  }
  var ov=document.createElement("div");ov.className="generic-modal-overlay";ov.id="gm-overlay";
  ov.innerHTML='<div class="generic-modal">'+
    '<div class="generic-modal-header"><h3>'+title+'</h3><button class="bt bs bsm" onclick="closeGenericModal()">✕</button></div>'+
    '<div class="generic-modal-body">'+bodyHTML+'</div>'+
    '<div class="generic-modal-footer"><button class="bt bs" onclick="closeGenericModal()">取消</button><button class="bt bp" id="gm-save-btn">保存</button></div></div>';
  document.body.appendChild(ov);
  document.getElementById("gm-save-btn").onclick=onSave;
}
function closeGenericModal(){var ov=document.getElementById("gm-overlay");if(ov)ov.remove();}

/** showModal/closeModal 兼容层 — 多个子系统使用此API显示信息弹窗 */
function showModal(title, bodyHTML, onClose) {
  var ov=document.createElement("div");ov.className="generic-modal-overlay";ov.id="gm-overlay";
  ov.innerHTML='<div class="generic-modal">'+
    '<div class="generic-modal-header"><h3>'+escHtml(title)+'</h3><button class="bt bs bsm" onclick="closeModal()">✕</button></div>'+
    '<div class="generic-modal-body">'+bodyHTML+'</div>'+
    '<div class="generic-modal-footer"><button class="bt bp" onclick="closeModal()">确定</button></div></div>';
  document.body.appendChild(ov);
  if(onClose){document.querySelector('#gm-overlay .bt.bp').onclick=function(){closeModal();onClose();};}
}
function closeModal(){closeGenericModal();}
