// ============================================================
// tm-shell-extras.js — preview-shell v7.1 shell 面板注入
// 为左右抽屉补充预览中独有的面板（边患/学派/物价/典藏/宫殿/祭祀/监察/宫廷日程/朝代主题等）
// 依赖 GM / P 但提供 fallback 静态内容（数据缺失时仍有样式）
// ============================================================

(function(){
  function $(id){ return document.getElementById(id); }
  function esc(s){
    if (s == null) return '';
    // 对象 → 尝试取常见文本字段·否则返空（避免"[object Object]"）
    if (typeof s === 'object') {
      if (s.name) s = s.name;
      else if (s.label) s = s.label;
      else if (s.value) s = s.value;
      else if (s.text) s = s.text;
      else if (s.type) s = s.type;
      else return '';
    }
    return String(s).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});
  }
  function num(n){ n=Number(n)||0; if(Math.abs(n)>=10000) return (n/10000).toFixed(1).replace(/\.0$/,'')+'万'; if(Math.abs(n)>=1000) return (n/1000).toFixed(1).replace(/\.0$/,'')+'千'; return String(Math.round(n)); }

  // ─────────────────────── 左抽屉 shell extras ───────────────────────
  window._renderShellExtrasLeft = function(gl){
    if (!gl || typeof GM === 'undefined' || !GM.running) return;

    // 1. 朝代主题
    var dyn = document.createElement('div');
    dyn.className = 'gs-panel p-dyn';
    dyn.setAttribute('data-panel-key','dyn');
    var _phase='衰 期', _phaseTxt='魏阉初除·党争未息·外虏压境·天象示警';
    if (GM.eraState) {
      var _dp = GM.eraState.dynastyPhase || 'peak';
      var _phaseMap = { founding:'草创·', rising:'兴 期', peak:'盛 世', stable:'守 成', decline:'衰 期', collapse:'末 路' };
      _phase = _phaseMap[_dp] || '守 成';
      if (GM.eraState.contextDescription) _phaseTxt = GM.eraState.contextDescription;
    }
    dyn.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">朝 代 主 题</div><span class="gs-panel-cnt">'+esc(_phase.replace(/\s+/g,''))+'</span></div>'
      + '<div class="gs-dyn-arc"><span class="phase">'+esc(_phase)+'</span>'+esc(_phaseTxt)+'</div>';
    gl.appendChild(dyn);

    // 2. 四时物候
    var wp = document.createElement('div');
    wp.className = 'gs-panel p-weather';
    wp.setAttribute('data-panel-key','weather');
    var _mon = (((GM.turn||1)-1)%12)+1;
    var _seas='秋',_seasTxt='秋分',_seasDesc='鸿雁南飞';
    if(_mon>=3&&_mon<=5){_seas='春';_seasTxt=['孟春','仲春','季春'][_mon-3];_seasDesc=['东风解冻','雷乃发声','萍始生'][_mon-3];}
    else if(_mon>=6&&_mon<=8){_seas='夏';_seasTxt=['孟夏','仲夏','季夏'][_mon-6];_seasDesc=['蝼蝈鸣','蜩始鸣','腐草为萤'][_mon-6];}
    else if(_mon>=9&&_mon<=11){_seas='秋';_seasTxt=['孟秋','仲秋','季秋'][_mon-9];_seasDesc=['凉风至','鸿雁来','草木黄落'][_mon-9];}
    else{_seas='冬';var _wi=(_mon===12?0:_mon+1);_seasTxt=['孟冬','仲冬','季冬'][_wi];_seasDesc=['水始冰','蚯蚓结','鸡始乳'][_wi];}
    var _disasterTxt = '风调雨顺';
    if (GM.activeDisasters && GM.activeDisasters.length) _disasterTxt = (GM.activeDisasters[0].name || GM.activeDisasters[0].type || '异常');
    wp.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">四 时 物 候</div><span class="gs-panel-cnt">'+_seasTxt+'</span></div>'
      + '<div class="gs-weather-panel"><div class="gs-season-disc" data-season="'+_seas+'"></div>'
      + '<div class="gs-season-info">'
      + '<div class="gs-season-row"><span class="k">天象</span><span class="v">'+esc(_disasterTxt)+'</span></div>'
      + '<div class="gs-season-row"><span class="k">物候</span><span class="v">'+_seasDesc+'</span></div>'
      + '<div class="gs-season-row"><span class="k">月</span><span class="v">第'+_mon+'月</span></div>'
      + '</div></div>';
    gl.appendChild(wp);

    // 2.5 势力格局
    if (GM.facs && GM.facs.length){
      var fp2 = document.createElement('div');
      fp2.className='gs-panel p-fac';
      fp2.setAttribute('data-panel-key','fac');
      var _fHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">势 力 格 局</div><span class="gs-panel-cnt">'+GM.facs.length+'</span></div>';
      GM.facs.slice(0,8).forEach(function(f){
        var att = f.attitude || '中立';
        var attCls='neutral', fCls='f-neutral';
        if (/友好|联盟/.test(att)){ attCls='friend'; fCls='f-friend'; }
        else if (/敌对|交战|敌视/.test(att)){ attCls='hostile'; fCls='f-hostile'; }
        else if (/附属|宗主|朝贡/.test(att)){ attCls='vassal'; fCls='f-vassal'; }
        if (f.isPlayer) fCls='f-self';
        _fHtml += '<div class="gs-fac-row '+fCls+'" onclick="if(typeof viewFac===\'function\')viewFac(\''+esc(f.name)+'\');else if(typeof openFacPanel===\'function\')openFacPanel();">'
          + '<span class="gs-fac-color"></span>'
          + '<div class="gs-fac-info"><div class="gs-fac-name">'+esc(f.name)+'</div>'
          + '<div class="gs-fac-leader">'+esc((f.leader||'')+(f.territory?' · '+f.territory:''))+'</div></div>'
          + '<span class="gs-fac-att '+attCls+'">'+esc(att)+'</span>'
          + '<span class="gs-fac-str">'+(f.strength||50)+'</span></div>';
      });
      fp2.innerHTML=_fHtml;
      gl.appendChild(fp2);
    }

    // 2.6 党派纷争
    if (GM.parties && GM.parties.length){
      var pp2 = document.createElement('div');
      pp2.className='gs-panel p-party';
      pp2.setAttribute('data-panel-key','party');
      var _pHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">党 派 纷 争</div><span class="gs-panel-cnt">'+GM.parties.length+'</span></div>';
      var _partyColors = ['var(--celadon-400,#7eb8a7)','var(--purple-400,#8e6aa8)','var(--indigo-400,#5a6fa8)','var(--amber-400,#c9a045)','var(--gold-400)'];
      GM.parties.slice(0,6).forEach(function(p, pi){
        var inf = p.influence||0;
        _pHtml += '<div class="gs-party-row" onclick="if(typeof openPartyDetailPanel===\'function\')openPartyDetailPanel();">'
          + '<span class="gs-party-name">'+esc(p.name)+'</span>'
          + '<span class="gs-party-infl"><span class="gs-party-bar"><span class="gs-party-fill" style="width:'+Math.min(100,inf)+'%;background:'+_partyColors[pi%5]+';"></span></span>'
          + '<span class="gs-party-val">'+Math.round(inf)+'</span></span></div>';
      });
      pp2.innerHTML=_pHtml;
      gl.appendChild(pp2);
    }

    // 2.7 阶层动静
    if (GM.classes && GM.classes.length){
      var cp3 = document.createElement('div');
      cp3.className='gs-panel p-class';
      cp3.setAttribute('data-panel-key','class');
      var _cHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">阶 层 动 静</div><span class="gs-panel-cnt">'+GM.classes.length+'</span></div>';
      var _classColors = {'士':'var(--gold-400)','农':'var(--celadon-400,#7eb8a7)','工':'var(--amber-400,#c9a045)','商':'var(--indigo-400,#5a6fa8)','军':'var(--vermillion-400)','宗':'var(--purple-400,#8e6aa8)'};
      GM.classes.forEach(function(c){
        var _mood = (c.loyalty||c.mood||50)>65 ? 'stable' : (c.loyalty||c.mood||50)>40 ? 'unrest' : 'angry';
        var _moodTxt = _mood === 'stable' ? '安' : _mood === 'unrest' ? '躁' : '怨';
        var _icon = c.name ? c.name.charAt(0) : '?';
        var _col = _classColors[_icon] || 'var(--gold-400)';
        _cHtml += '<div class="gs-class-row" onclick="if(typeof openClassDetailPanel===\'function\')openClassDetailPanel();">'
          + '<span class="gs-class-icon" style="--c-c:'+_col+';">'+esc(_icon)+'</span>'
          + '<span class="gs-class-name">'+esc(c.name)+'</span>'
          + '<span class="gs-class-pop">'+(c.populationPct||c.percent||'?')+'%</span>'
          + '<span class="gs-class-mood '+_mood+'">'+_moodTxt+'</span></div>';
      });
      cp3.innerHTML=_cHtml;
      gl.appendChild(cp3);
    }

    // 2.8 军事要务
    if (GM.armies && GM.armies.length){
      var mp2 = document.createElement('div');
      mp2.className='gs-panel p-army';
      mp2.setAttribute('data-panel-key','army');
      var _mHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">军 事 要 务</div><span class="gs-panel-cnt">'+GM.armies.length+'</span></div>';
      // 找出玩家势力名（用于 chip 着色）
      var _myFac = '';
      try {
        var _pc = (GM.chars||[]).find(function(c){return c&&c.isPlayer;});
        if (_pc) _myFac = _pc.faction || '';
      } catch(_){}
      GM.armies.slice(0,6).forEach(function(a){
        var size = a.size || a.troops || a.soldiers || a.strength || a.initialTroops || 0;
        var morale = a.morale || 70;
        var mColor = morale>75 ? 'var(--celadon-400,#7eb8a7)' : morale>55 ? 'var(--amber-400,#c9a045)' : 'var(--vermillion-400)';
        // 势力 chip·本朝 / 敌对 / 中立 三色
        var _fac = a.faction || '';
        var _facChip = '';
        if (_fac) {
          var _isOurs = _myFac && _fac === _myFac;
          var _chipColor = _isOurs ? 'rgba(184,154,83,0.25);color:#e8d49a' : 'rgba(184,71,56,0.25);color:#e8b8a8';
          _facChip = '<span style="background:'+_chipColor+';padding:0 5px;border-radius:3px;font-size:0.72rem;margin-left:4px;">'+esc(_fac)+(_isOurs?'·我':'·外')+'</span>';
        }
        _mHtml += '<div class="gs-army-row" onclick="if(typeof openMilitaryDetailPanel===\'function\')openMilitaryDetailPanel();">'
          + '<span class="gs-army-icon">⚔</span>'
          + '<div class="gs-army-info"><div class="gs-army-name">'+esc(a.name||'军')+_facChip+'</div>'
          + '<div class="gs-army-loc">'+esc((a.location||a.stationed||'')+(a.commander?' · '+a.commander:''))+'</div></div>'
          + '<div style="text-align:right;"><div class="gs-army-size">'+num(size)+'</div>'
          + '<div class="gs-army-morale"><div class="gs-army-morale-fill" style="width:'+Math.min(100,morale)+'%;background:'+mColor+';"></div></div></div></div>';
      });
      mp2.innerHTML=_mHtml;
      gl.appendChild(mp2);
    }

    // 2.9 行政区划（优先 GM 运行时·回退剧本 P）
    var _adminSrc = (GM && GM.adminHierarchy && Object.keys(GM.adminHierarchy).length > 0) ? GM.adminHierarchy : (P && P.adminHierarchy);
    if (_adminSrc){
      var ap2 = document.createElement('div');
      ap2.className='gs-panel p-admin';
      ap2.setAttribute('data-panel-key','admin');
      var _divs = [];
      Object.keys(_adminSrc).forEach(function(fk){
        var fh = _adminSrc[fk]; if (!fh || !fh.divisions) return;
        fh.divisions.forEach(function(d){ _divs.push(d); });
      });
      var _aHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">行 政 区 划</div><span class="gs-panel-cnt">'+_divs.length+' 省</span></div>';
      _divs.sort(function(a,b){return (b.unrest||0)-(a.unrest||0);});
      _divs.slice(0,10).forEach(function(d){
        var unrest = d.unrest || 0;
        var cls = unrest>70 ? 'crisis' : unrest>50 ? 'war' : unrest<25 ? 'stable' : '';
        var type = d.autonomy || d.autonomyType || '直辖';
        _aHtml += '<div class="gs-admin-row '+cls+'" onclick="if(typeof openProvinceEconomy===\'function\')openProvinceEconomy();">'
          + '<span class="gs-admin-dot"></span>'
          + '<span class="gs-admin-name">'+esc(d.name)+'</span>'
          + '<span class="gs-admin-type">'+esc(type)+'</span>'
          + '<span class="gs-admin-unrest">'+Math.round(unrest)+'</span></div>';
      });
      ap2.innerHTML=_aHtml;
      gl.appendChild(ap2);
    }

    // 2.91 科举进程
    if (P && P.keju){
      var kp = document.createElement('div');
      kp.className='gs-panel p-keju';
      kp.setAttribute('data-panel-key','keju');
      var stages = ['童试','乡试','会试','殿试','授官'];
      var curIdx = 2; // default 会试
      if (P.keju.currentExam && P.keju.currentExam.stage){
        var _stgMap = {'tongshi':0,'xiangshi':1,'huishi':2,'dianshi':3,'shouguan':4};
        curIdx = _stgMap[P.keju.currentExam.stage] != null ? _stgMap[P.keju.currentExam.stage] : 2;
      }
      var doneW = Math.round((curIdx/(stages.length-1))*100);
      var _kHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">科 举 进 程</div><span class="gs-panel-cnt">'+stages[curIdx]+'期</span></div>';
      _kHtml += '<div class="gs-keju-time"><div class="gs-keju-track"><div class="gs-keju-track-done" style="width:'+doneW+'%;"></div></div>';
      _kHtml += '<div class="gs-keju-nodes">';
      for (var _si=0;_si<5;_si++){
        var nc = _si < curIdx ? 'done' : _si === curIdx ? 'current' : '';
        _kHtml += '<div class="gs-keju-node '+nc+'"></div>';
      }
      _kHtml += '</div></div>';
      _kHtml += '<div class="gs-keju-labels">';
      for (_si=0;_si<5;_si++){
        _kHtml += '<span class="'+(_si<curIdx?'done':_si===curIdx?'current':'')+'">'+stages[_si]+'</span>';
      }
      _kHtml += '</div>';
      if (P.keju.currentExam) {
        var _zkg = P.keju.currentExam.chiefExaminer || P.keju.chiefExaminer || '?';
        var _cands = (P.keju.currentExam.candidates||[]).length || P.keju.candidateCount || 0;
        _kHtml += '<div class="gs-keju-sub"><span class="h">主考官</span> '+esc(_zkg)+' · <span class="h">应试</span> '+_cands+' 人</div>';
      }
      kp.innerHTML=_kHtml;
      gl.appendChild(kp);
    }

    // 2.92 家族门第
    if (GM.families && Object.keys(GM.families).length){
      var famp = document.createElement('div');
      famp.className='gs-panel p-family';
      famp.setAttribute('data-panel-key','family');
      var _fNames = Object.keys(GM.families);
      var _fArr = _fNames.map(function(k){return Object.assign({_k:k},GM.families[k]);});
      _fArr.sort(function(a,b){return (b.renown||0)-(a.renown||0);});
      var _famHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">家 族 门 第</div><span class="gs-panel-cnt">'+_fArr.length+'</span></div>';
      _fArr.slice(0,6).forEach(function(f){
        var tier = f.tier==='gaomen'?'甲':f.tier==='shizu'?'乙':'丙';
        var tierCls = f.tier==='gaomen'?'gaomen':f.tier==='shizu'?'shizu':'hanmen';
        _famHtml += '<div class="gs-fam-row"><span class="gs-fam-name">'+esc(f._k||f.name)+'</span>'
          + '<span class="gs-fam-tier '+tierCls+'">'+tier+'</span>'
          + '<span class="gs-fam-renown">'+Math.round(f.renown||0)+'</span></div>';
      });
      famp.innerHTML=_famHtml;
      gl.appendChild(famp);
    }

    // 2.93 制度演进
    if (GM.civicTree && GM.civicTree.length){
      var tp = document.createElement('div');
      tp.className='gs-panel p-tech';
      tp.setAttribute('data-panel-key','tech');
      var _tHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">制 度 演 进</div><span class="gs-panel-cnt">'+GM.civicTree.length+'</span></div>';
      GM.civicTree.slice(0,5).forEach(function(t){
        var prog = t.progress || 0;
        _tHtml += '<div class="gs-tech-row"><span class="gs-tech-icon">⚙</span>'
          + '<span class="gs-tech-name">'+esc(t.name||t.title||'')+'</span>'
          + '<span class="gs-tech-prog"><span class="gs-tech-prog-fill" style="width:'+Math.min(100,prog)+'%;"></span></span>'
          + '<span class="gs-tech-val">'+Math.round(prog)+'</span></div>';
      });
      tp.innerHTML=_tHtml;
      gl.appendChild(tp);
    }

    // 2.94 文物奇珍
    if (GM.items && GM.items.length){
      var _items = GM.items.slice(0,8);
      var ip = document.createElement('div');
      ip.className='gs-panel p-item';
      ip.setAttribute('data-panel-key','item');
      var _iHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">文 物 奇 珍</div><span class="gs-panel-cnt">'+GM.items.length+'</span></div><div class="gs-item-grid">';
      for (var _ii=0;_ii<8;_ii++){
        var it = _items[_ii];
        if (!it){ _iHtml += '<div class="gs-item-slot empty">—</div>'; continue; }
        var _rarity = it.rarity || 'chang';
        var _rCls = {legendary:'r-jing',epic:'r-gui',rare:'r-bi',uncommon:'r-chang',common:'r-chang'}[_rarity] || 'r-chang';
        _iHtml += '<div class="gs-item-slot '+_rCls+'" title="'+esc(it.name||'')+'">'+esc((it.name||'?').charAt(0))+'</div>';
      }
      _iHtml += '</div>';
      ip.innerHTML=_iHtml;
      gl.appendChild(ip);
    }

    // 2.95 后宫嫔御
    var _consorts = (GM.chars||[]).filter(function(c){return c && c.alive!==false && c.spouse;}).slice(0,6);
    if (_consorts.length){
      var hp2 = document.createElement('div');
      hp2.className='gs-panel p-harem';
      hp2.setAttribute('data-panel-key','harem');
      var _hHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">后 宫 嫔 御</div><span class="gs-panel-cnt">'+_consorts.length+'</span></div><div class="gs-harem-row">';
      _consorts.forEach(function(co){
        var rCls = /皇后/.test(co.rank||co.title||'')?'empress':/贵妃/.test(co.rank||co.title||'')?'guifei':/妃/.test(co.rank||co.title||'')?'fei':'pin';
        _hHtml += '<div class="gs-consort '+rCls+'"><div class="gs-consort-port">'+esc(co.name.charAt(0))+'</div>'
          + '<div class="gs-consort-name">'+esc(co.name.charAt(0))+'</div>'
          + '<div class="gs-consort-rank">'+esc(co.rank||co.title||'嫔')+'</div></div>';
      });
      _hHtml += '</div>';
      hp2.innerHTML=_hHtml;
      gl.appendChild(hp2);
    }

    // 2.96 天下之图
    var mpp = document.createElement('div');
    mpp.className='gs-panel p-map';
    mpp.setAttribute('data-panel-key','map');
    var _pins='';
    if (P && P.adminHierarchy){
      var _all=[];
      Object.keys(P.adminHierarchy).forEach(function(fk){ var fh=P.adminHierarchy[fk]; if(fh&&fh.divisions) fh.divisions.forEach(function(d){ _all.push(d); }); });
      _all.slice(0,6).forEach(function(d,idx){
        var top = (20 + (idx%3)*30) + '%', left = (20 + Math.floor(idx/3)*40 + (idx%2)*10) + '%';
        var cls = (d.unrest||0)>60?'crisis':(d.unrest||0)>40?'war':(d.unrest||0)<20?'stable':'';
        _pins += '<span class="gs-map-pin '+cls+'" style="top:'+top+';left:'+left+';"></span>';
        _pins += '<span class="gs-map-label" style="top:calc('+top+' + 12px);left:'+left+';">'+esc(d.name)+'</span>';
      });
    }
    mpp.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">天 下 之 图</div><span class="gs-panel-cnt">舆图</span></div>'
      + '<div class="gs-mini-map">'+_pins+'</div>';
    gl.appendChild(mpp);

    // 3. 边患外族
    var threats = [];
    (GM.facs||[]).forEach(function(f){
      if (!f || f.attitude == null) return;
      var hostile = (f.attitude === '敌对' || f.attitude === '交战' || f.attitude === '敌视');
      if (!hostile) return;
      var lv = (f.strength||50) > 60 ? 'hi' : (f.strength||50) > 40 ? 'mid' : 'lo';
      threats.push({ name: f.name, desc: (f.leader||'') + (f.territory?' · '+f.territory:''), force: num(f.militaryStrength||f.strength||0), level: lv });
    });
    if (!threats.length) threats = [{name:'暂无外患',desc:'四方晏然',force:'—',level:'lo'}];
    var bp = document.createElement('div');
    bp.className = 'gs-panel p-bian';
    bp.setAttribute('data-panel-key','bian');
    var _bianHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">边 患 外 族</div><span class="gs-panel-cnt">'+threats.length+'</span></div>';
    threats.slice(0,4).forEach(function(t){
      var lvTxt = t.level==='hi'?'急':t.level==='mid'?'中':'缓';
      _bianHtml += '<div class="gs-bian-row"><span class="gs-bian-threat '+t.level+'">'+lvTxt+'</span>'
        + '<div class="gs-bian-info"><div class="gs-bian-name">'+esc(t.name)+'</div><div class="gs-bian-desc">'+esc(t.desc)+'</div></div>'
        + '<span class="gs-bian-force">'+esc(t.force)+'</span></div>';
    });
    bp.innerHTML = _bianHtml;
    gl.appendChild(bp);

    // 4. 学派流变
    var sp = document.createElement('div');
    sp.className = 'gs-panel p-school';
    sp.setAttribute('data-panel-key','school');
    var schools = (P && P.schools) || [
      {k:'程',name:'程朱理学',level:'主流',infl:72,color:'var(--gold-400)'},
      {k:'阳',name:'陆王心学',level:'方兴',infl:48,color:'var(--celadon-400)'},
      {k:'考',name:'考据朴学',level:'渐盛',infl:35,color:'var(--indigo-400,#5a6fa8)'},
      {k:'西',name:'西学东渐',level:'新潮',infl:18,color:'var(--amber-400,#c9a045)'},
      {k:'佛',name:'禅净儒释',level:'民间',infl:26,color:'var(--purple-400,#8e6aa8)'}
    ];
    var _sHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">学 派 流 变</div><span class="gs-panel-cnt">'+schools.length+'</span></div>';
    schools.forEach(function(s){
      _sHtml += '<div class="gs-school-row"><span class="gs-school-icon" style="--s-c:'+s.color+';">'+esc(s.k)+'</span>'
        + '<span class="gs-school-name">'+esc(s.name)+'</span>'
        + '<span class="gs-school-level" style="--s-c:'+s.color+';">'+esc(s.level)+'</span>'
        + '<span class="gs-school-infl">'+(s.infl||0)+'</span></div>';
    });
    sp.innerHTML = _sHtml;
    gl.appendChild(sp);

    // 5. 物价行情（防御·sparkPct 可能缺失）
    try {
      var pp = document.createElement('div');
      pp.className = 'gs-panel p-price';
      pp.setAttribute('data-panel-key','price');
      var prices = (GM.prices || P.prices) || {};
      var _makePrice = function(name,val,unit,trend,sparkPct){
        var s = Array.isArray(sparkPct) ? sparkPct : [30,45,40,55,70,85];
        var spark=''; for (var i=0;i<6;i++){ spark += '<span style="height:'+(s[i]||50)+'%;"></span>'; }
        var tr = Number(trend) || 0;
        var tCls = tr>5?'up':tr<-5?'down':'stable', tTxt = (tr>0?'↑':tr<0?'↓':'· ')+Math.abs(tr)+'%';
        return '<div class="gs-price-row"><span class="gs-price-name">'+name+'</span>'
          + '<span class="gs-price-val">'+esc(val)+'</span><span class="gs-price-unit">'+esc(unit)+'</span>'
          + '<span class="gs-price-spark">'+spark+'</span>'
          + '<span class="gs-price-trend '+tCls+'">'+tTxt+'</span></div>';
      };
      var _defM = {val:'1.8', unit:'两/石', trend:42, spark:[30,45,40,55,70,85]};
      var _defB = {val:'0.8', unit:'两/匹', trend:8, spark:[50,52,55,54,58,60]};
      var _defS = {val:'3.2', unit:'两/引', trend:6, spark:[70,65,68,72,75,78]};
      var _defY = {val:'650', unit:'/两金', trend:-14, spark:[75,70,68,65,60,58]};
      var _mi = Object.assign({}, _defM, (typeof prices.rice==='object'?prices.rice:{}));
      var _bu = Object.assign({}, _defB, (typeof prices.cloth==='object'?prices.cloth:{}));
      var _ya = Object.assign({}, _defS, (typeof prices.salt==='object'?prices.salt:{}));
      var _yi = Object.assign({}, _defY, (typeof prices.silver==='object'?prices.silver:{}));
      pp.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">物 价 行 情</div><span class="gs-panel-cnt">京师</span></div>'
        + _makePrice('米',_mi.val,_mi.unit,_mi.trend,_mi.spark)
        + _makePrice('布',_bu.val,_bu.unit,_bu.trend,_bu.spark)
        + _makePrice('盐',_ya.val,_ya.unit,_ya.trend,_ya.spark)
        + _makePrice('银',_yi.val,_yi.unit,_yi.trend,_yi.spark);
      gl.appendChild(pp);
    } catch(e) { console.warn('[shell-extras] price panel:', e); }

    // 6. 典藏书阁
    try {
    var bk = document.createElement('div');
    bk.className = 'gs-panel p-book';
    bk.setAttribute('data-panel-key','book');
    var libs = (GM.library||P.library) || { jing:2418, shi:3862, zi:5273, ji:8146 };
    bk.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">典 藏 书 阁</div><span class="gs-panel-cnt">文渊阁</span></div>'
      + '<div class="gs-book-grid">'
      + '<div class="gs-book-card b-jing"><div class="gs-book-name">经</div><div class="gs-book-num">'+num(libs.jing)+'</div><div class="gs-book-sub">十三经·注疏</div></div>'
      + '<div class="gs-book-card b-shi"><div class="gs-book-name">史</div><div class="gs-book-num">'+num(libs.shi)+'</div><div class="gs-book-sub">二十二史·实录</div></div>'
      + '<div class="gs-book-card b-zi"><div class="gs-book-name">子</div><div class="gs-book-num">'+num(libs.zi)+'</div><div class="gs-book-sub">百家·兵农医</div></div>'
      + '<div class="gs-book-card b-ji"><div class="gs-book-name">集</div><div class="gs-book-num">'+num(libs.ji)+'</div><div class="gs-book-sub">诗文·笔记</div></div>'
      + '</div>';
    gl.appendChild(bk);
    } catch(e) { console.warn('[shell-extras] book panel:', e); }

    // 7. 宫殿之序
    try {
    var pal = document.createElement('div');
    pal.className = 'gs-panel p-palace';
    pal.setAttribute('data-panel-key','palace');
    pal.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">宫 殿 之 序</div><span class="gs-panel-cnt">'+esc((P.palaceSystem&&P.palaceSystem.capitalName)||'紫禁城')+'</span></div>'
      + '<div class="gs-palace-diag">'
      + '<div class="gs-palace-row-block"><div class="gs-palace-block gold">乾清宫</div></div>'
      + '<div class="gs-palace-row-block"><div class="gs-palace-block">保和殿</div></div>'
      + '<div class="gs-palace-row-block"><div class="gs-palace-block">中和殿</div></div>'
      + '<div class="gs-palace-row-block"><div class="gs-palace-block gold">太和殿</div></div>'
      + '<div class="gs-palace-row-block"><div class="gs-palace-block small">文华殿</div><div class="gs-palace-block small">武英殿</div></div>'
      + '<div class="gs-palace-gate">午 门 · 端 门 · 承 天 门</div>'
      + '</div>';
    gl.appendChild(pal);
    } catch(e) { console.warn('[shell-extras] palace panel:', e); }

    // 8. 界面主题（实装：主题/字号/字体）
    try {
    var tm = document.createElement('div');
    tm.className = 'gs-panel p-theme';
    tm.setAttribute('data-panel-key','theme');
    // 读取已保存的设置
    var _savedTheme = localStorage.getItem('tm.theme') || 'plain';
    var _savedSize = localStorage.getItem('tm.fontSize') || 'md';
    var _savedBody = localStorage.getItem('tm.fontBody') || 'STKaiti';
    var _savedTitle = localStorage.getItem('tm.fontTitle') || 'STKaiti';
    var _actCls = function(k, cur){ return k===cur?' active':''; };
    tm.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">界 面 主 题</div><span class="gs-panel-cnt">4 色</span></div>'
      + '<div class="gs-theme-grid">'
      + '<div class="gs-theme-card' + _actCls('plain', _savedTheme) + '" data-theme="plain" onclick="_tmApplyTheme(\'plain\', this)"><div class="gs-theme-swatch"><span class="c" style="background:#b89a53;"></span><span class="c" style="background:#c9a85f;"></span><span class="c" style="background:#6a9a7f;"></span><span class="c" style="background:#b84738;"></span></div><div class="gs-theme-name">素 纸</div><div class="desc">宣纸金线·朱砂</div></div>'
      + '<div class="gs-theme-card' + _actCls('ink', _savedTheme) + '" data-theme="ink" onclick="_tmApplyTheme(\'ink\', this)"><div class="gs-theme-swatch"><span class="c" style="background:#3d342a;"></span><span class="c" style="background:#6b5d47;"></span><span class="c" style="background:#a69470;"></span><span class="c" style="background:#d9c9a9;"></span></div><div class="gs-theme-name">水 墨</div><div class="desc">墨分五色·冷调</div></div>'
      + '<div class="gs-theme-card' + _actCls('vermillion', _savedTheme) + '" data-theme="vermillion" onclick="_tmApplyTheme(\'vermillion\', this)"><div class="gs-theme-swatch"><span class="c" style="background:#8f3428;"></span><span class="c" style="background:#b84738;"></span><span class="c" style="background:#d15c47;"></span><span class="c" style="background:#c9a85f;"></span></div><div class="gs-theme-name">朱 砂</div><div class="desc">浓朱重赤·烈</div></div>'
      + '<div class="gs-theme-card' + _actCls('celadon', _savedTheme) + '" data-theme="celadon" onclick="_tmApplyTheme(\'celadon\', this)"><div class="gs-theme-swatch"><span class="c" style="background:#4a7a5f;"></span><span class="c" style="background:#6a9a7f;"></span><span class="c" style="background:#b89a53;"></span><span class="c" style="background:#d9c9a9;"></span></div><div class="gs-theme-name">青 绿</div><div class="desc">青绿山水·雅</div></div>'
      + '</div>'
      + '<div class="gs-font-row"><span class="lbl">字 号</span>'
      + '<div class="gs-font-sizes">'
      +   '<button class="gs-sz-btn sm' + _actCls('sm', _savedSize) + '" onclick="_tmApplySize(\'sm\', this)">小</button>'
      +   '<button class="gs-sz-btn md' + _actCls('md', _savedSize) + '" onclick="_tmApplySize(\'md\', this)">中</button>'
      +   '<button class="gs-sz-btn lg' + _actCls('lg', _savedSize) + '" onclick="_tmApplySize(\'lg\', this)">大</button>'
      +   '<button class="gs-sz-btn xl' + _actCls('xl', _savedSize) + '" onclick="_tmApplySize(\'xl\', this)">特大</button>'
      + '</div>'
      + '</div>'
      + '<div class="gs-font-row"><span class="lbl">正 文</span><select class="gs-font-select" onchange="_tmApplyBodyFont(this.value)">'
      +   '<option value="STKaiti"' + (_savedBody==='STKaiti'?' selected':'') + '>楷体 STKaiti</option>'
      +   '<option value="SimSun"' + (_savedBody==='SimSun'?' selected':'') + '>宋体 SimSun</option>'
      +   '<option value="FangSong"' + (_savedBody==='FangSong'?' selected':'') + '>仿宋 FangSong</option>'
      +   '<option value="FZQiTi"' + (_savedBody==='FZQiTi'?' selected':'') + '>方正启体</option>'
      +   '<option value="Noto Serif SC"' + (_savedBody==='Noto Serif SC'?' selected':'') + '>思源宋体</option>'
      +   '<option value="LXGW WenKai"' + (_savedBody==='LXGW WenKai'?' selected':'') + '>霞鹜文楷</option>'
      + '</select></div>'
      + '<div class="gs-font-row"><span class="lbl">标 题</span><select class="gs-font-select" onchange="_tmApplyTitleFont(this.value)">'
      +   '<option value="STKaiti"' + (_savedTitle==='STKaiti'?' selected':'') + '>楷体 STKaiti</option>'
      +   '<option value="STXingkai"' + (_savedTitle==='STXingkai'?' selected':'') + '>行楷</option>'
      +   '<option value="STLiti"' + (_savedTitle==='STLiti'?' selected':'') + '>隶书</option>'
      +   '<option value="STXinghkaiti"' + (_savedTitle==='STXinghkaiti'?' selected':'') + '>华文行楷</option>'
      + '</select></div>';
    gl.appendChild(tm);
    } catch(e) { console.warn('[shell-extras] theme panel:', e); }

    // 9. 帮助·典范
    try {
    var hp = document.createElement('div');
    hp.className = 'gs-panel p-help';
    hp.setAttribute('data-panel-key','help');
    hp.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">帮 助 · 典 范</div><span class="gs-panel-cnt">4</span></div>'
      + '<div class="gs-help-item" onclick="if(typeof openHelpNewbie===\'function\')openHelpNewbie();else toast(\'新手入门\')"><span class="ic">?</span><span class="t">新 手 入 门</span><span class="arr">›</span></div>'
      + '<div class="gs-help-item" onclick="if(typeof openHelpPresets===\'function\')openHelpPresets();else toast(\'历代典范\')"><span class="ic">典</span><span class="t">历 代 典 范</span><span class="arr">›</span></div>'
      + '<div class="gs-help-item" onclick="if(typeof openHelpAI===\'function\')openHelpAI();else toast(\'AI 推演原理\')"><span class="ic">AI</span><span class="t">AI 推 演 原 理</span><span class="arr">›</span></div>'
      + '<div class="gs-help-item" onclick="if(typeof openHelpHotkey===\'function\')openHelpHotkey();else toast(\'[ ] = 开关抽屉·Ctrl+1..9 切 tab·F1 帮助\')"><span class="ic">键</span><span class="t">键 位 速 查</span><span class="arr">›</span></div>';
    gl.appendChild(hp);
    } catch(e) { console.warn('[shell-extras] help panel:', e); }

    // 10. 音声调度
    try {
    var au = document.createElement('div');
    au.className = 'gs-panel p-audio';
    au.setAttribute('data-panel-key','audio');
    au.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">音 声 调 度</div><span class="gs-panel-cnt">开</span></div>'
      + '<div class="gs-audio-row"><span class="gs-audio-name">殿 乐</span><div class="gs-audio-ctrl"><div class="gs-audio-slider" style="--p:70%;"></div><span class="gs-audio-val">70</span></div></div>'
      + '<div class="gs-audio-row"><span class="gs-audio-name">朝 钟</span><div class="gs-audio-ctrl"><div class="gs-audio-slider" style="--p:45%;"></div><span class="gs-audio-val">45</span></div></div>'
      + '<div class="gs-audio-row"><span class="gs-audio-name">笔 墨</span><div class="gs-audio-ctrl"><div class="gs-audio-slider" style="--p:60%;"></div><span class="gs-audio-val">60</span></div></div>'
      + '<div class="gs-audio-now">正 奏：<span class="h">《秋声赋》</span>·古琴独奏</div>'
      + '<div class="gs-audio-custom">'
      + '<button class="gs-audio-import" onclick="var f=document.getElementById(\'shellAudioIn\');if(f)f.click();">导 入 曲 谱</button>'
      + '<input type="file" id="shellAudioIn" accept="audio/*" multiple style="display:none;">'
      + '<div class="gs-audio-lib">'
      + '<div class="gs-audio-song playing"><span class="title">秋声赋</span><span class="meta">古琴</span><button class="del">×</button></div>'
      + '<div class="gs-audio-song paused"><span class="title">流水</span><span class="meta">古琴</span><button class="del">×</button></div>'
      + '<div class="gs-audio-song paused"><span class="title">阳关三叠</span><span class="meta">琵琶</span><button class="del">×</button></div>'
      + '</div>'
      + '<div class="gs-audio-loop"><button class="gs-audio-loop-btn active">顺 序</button><button class="gs-audio-loop-btn">单 曲</button><button class="gs-audio-loop-btn">随 机</button></div>'
      + '</div>';
    gl.appendChild(au);
    } catch(e) { console.warn('[shell-extras] audio panel:', e); }
  };

  // ─────────────────────── 右抽屉 shell extras ───────────────────────
  window._renderShellExtrasRight = function(){
    var gr = $('gr'); if (!gr || typeof GM === 'undefined' || !GM.running) return;

    // 清除上次注入的 shell extras（防止重复）
    var _ex = gr.querySelector('#_shell_extras_right'); if (_ex) _ex.remove();
    var wrap = document.createElement('div');
    wrap.id = '_shell_extras_right';
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;';

    var pc = (typeof findPlayerChar === 'function' ? findPlayerChar() : null) || (GM.chars||[]).find(function(c){return c.isPlayer;}) || {};
    var pName = pc.name || (P.playerInfo && P.playerInfo.name) || '朕';
    var pAge = pc.age || (P.playerInfo && P.playerInfo.age) || 0;
    var pZi = pc.zi || pc.courtesy || '';
    var pGender = pc.gender || 'male';
    var pTitle = pc.officialTitle || pc.title || '皇帝';

    // 1. 朕亲卡
    var self = document.createElement('div');
    self.className = 'gs-self-card';
    self.setAttribute('data-panel-key','self');
    var _wc = pc.wuchang || {};
    var _wcDot = function(k){ var v=_wc[k]; var lv=v==null?'none':v>=60?'hi':v>=30?'mid':'lo'; return '<span class="gs-wc-dot '+lv+'">'+k+'</span>'; };
    var _statBar = function(cls, k, v){ v=Math.max(0,Math.min(100,v||0)); return '<div class="gs-stat '+cls+'"><span class="gs-stat-k">'+k+'</span><span class="gs-stat-bar"><span class="gs-stat-fill" style="width:'+v+'%"></span></span><span class="gs-stat-v">'+Math.round(v)+'</span></div>'; };
    var traits = (pc.traits||[]).slice(0,4);
    var _traitHtml = '';
    traits.forEach(function(t){ _traitHtml += '<span class="gs-self-tag trait-neu">'+esc(t)+'</span>'; });
    self.innerHTML = '<div class="gs-self-row">'
      + '<div class="gs-self-portrait">'+(pc.portrait?'<img src="'+esc(pc.portrait)+'" style="width:100%;height:100%;object-fit:cover;border-radius:1px;">':esc(pName.charAt(0)))+'</div>'
      + '<div class="gs-self-info">'
      + '<div class="gs-self-name">'+esc(pName)+'</div>'
      + '<div class="gs-self-title">'+esc(pTitle)+(pZi?'　字 '+esc(pZi):'')+'</div>'
      + '<div class="gs-self-meta">'+(pAge?'<span class="gs-self-tag">'+pAge+'岁</span>':'')+_traitHtml+'</div>'
      + '</div></div>'
      + '<div class="gs-self-stats">'
      + _statBar('zhi','智',pc.intelligence)
      + _statBar('zheng','政',pc.administration)
      + _statBar('jun','军',pc.military)
      + _statBar('jiao','交',pc.diplomacy||pc.charisma)
      + _statBar('ren','仁',pc.benevolence)
      + _statBar('wei','威',GM.huangwei||GM.authority||60)
      + '</div>'
      + '<div class="gs-self-wuchang"><span class="lbl">五常</span>'
      + _wcDot('仁')+_wcDot('义')+_wcDot('礼')+_wcDot('智')+_wcDot('信')
      + '</div>';
    wrap.appendChild(self);

    // 2. 十二时辰
    var tm = document.createElement('div');
    tm.className = 'gs-panel p-time';
    tm.setAttribute('data-panel-key','time');
    var _shi = Math.floor(((GM.currentDay||0)%1)*12) || 8;
    var _shiMap=['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
    var _shiName = _shiMap[_shi%12];
    var _deg = (_shi*30) - 90;
    tm.innerHTML = '<div class="gs-panel-hdr"><div class="gs-panel-title">十 二 时 辰</div><span class="gs-panel-cnt">'+_shiName+'时</span></div>'
      + '<div class="gs-time-dial">'
      + '<div class="gs-time-mark" style="top:10%;left:50%;">子</div>'
      + '<div class="gs-time-mark" style="top:23%;left:82%;">卯</div>'
      + '<div class="gs-time-mark" style="top:50%;left:90%;">午</div>'
      + '<div class="gs-time-mark cur" style="top:77%;left:82%;">申</div>'
      + '<div class="gs-time-mark" style="top:90%;left:50%;">酉</div>'
      + '<div class="gs-time-mark" style="top:77%;left:18%;">戌</div>'
      + '<div class="gs-time-mark" style="top:50%;left:10%;">卯</div>'
      + '<div class="gs-time-mark" style="top:23%;left:18%;">丑</div>'
      + '<div class="gs-time-hand" style="transform:translate(-50%,-100%) rotate('+_deg+'deg);"></div>'
      + '<div class="gs-time-center"></div>'
      + '</div>'
      + '<div class="gs-time-text"><div class="main">'+_shiName+' 时</div><div class="sub">日 昳 · 未 至 酉</div></div>';
    wrap.appendChild(tm);

    // 3. 紧要之臣·采用 preview-char-full.html 三·右侧栏人物卡片样式 (.gs-cd-*)·点击唤出快速详情面板 (openCharDetail)
    var chars = (GM.chars||[]).filter(function(c){ return c && c.alive !== false && !c.isPlayer; });
    chars.sort(function(a,b){ var ia=(a.importance||0)+(a.loyalty||0)*0.3; var ib=(b.importance||0)+(b.loyalty||0)*0.3; return ib-ia; });
    // 全部展示·列表容器滚动
    var cp = document.createElement('div');
    cp.className = 'gs-panel p-quick';
    cp.setAttribute('data-panel-key','char');
    var _cHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">紧 要 之 臣</div><span class="gs-panel-cnt">'+chars.length+'</span></div>'
      + '<div class="gs-cd-scroll" style="max-height:520px;overflow-y:auto;overflow-x:hidden;padding-right:4px;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';
    // 辅助 escape for JS onclick
    function _jsEsc(s) { return String(s||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/</g,'\\u003c'); }
    chars.forEach(function(c){
      var name = c.name || '';
      var nameJs = _jsEsc(name);
      var zi = c.zi || c.courtesy || '';
      var age = c.age || '?';
      var isFem = (c.gender === '女' || c.gender === 'female' || c.isFemale === true);
      var loy = Math.round(c.loyalty || 50);
      var loyCls = loy>=70?'hi':loy>=40?'mid':'lo';
      var amb = Math.round(c.ambition || 40);
      var stress = Math.round((c.resources && c.resources.stress) || c.stress || 0);
      var sCls = stress>=80?'crit':stress>=60?'warn':'';
      var sBadge = (sCls) ? '<span class="gs-cd-stress '+sCls+'" title="压力'+stress+'">'+(stress>=80?'崩':stress>=60?'紧':'压')+'</span>' : '';
      var officeT = c.officialTitle || c.title || '布衣';
      var rankT = (typeof c.rankLevel === 'number') ? (c.rankLevel<=3?'正一品':c.rankLevel<=5?'正三品':c.rankLevel<=8?'正五品':'九品') : '';
      var fac = c.faction || '';
      // 情绪
      var mood = c.mood || c.currentMood || '';
      var moodCls = /忧|愁/.test(mood)?'worry':/喜|乐/.test(mood)?'happy':/怒|恨/.test(mood)?'angry':/敬/.test(mood)?'respect':/平/.test(mood)?'peace':'';
      var moodIcon = mood ? '<span class="gs-cd-mood '+moodCls+'">〔'+esc(mood)+'〕</span>' : '';
      // 在途
      var travelBadge = c._enRouteToOffice ? '<span class="gs-cd-loc-badge">→'+esc((c._enRouteToOffice||'').slice(0,6))+'</span>' :
        c._travelTo ? '<span class="gs-cd-loc-badge">→'+esc((c._travelTo||'').slice(0,6))+'</span>' :
        c.location ? '<span class="gs-cd-loc-badge">'+esc((c.location||'').slice(0,6))+'</span>' : '';
      // 配偶/脸面
      var spouseBadge = c.spouse ? '<span class="gs-cd-spouse">🌸</span>' : '';
      var faceBadge = (c._faceLost || c._humiliated) ? '<span class="gs-cd-face-badge">颜面尽失</span>' : '';
      // 特质 tags (最多 3 个)·优先 traitIds(英文 id→中文 name)·后 traits 数组
      var tagsHtml = '';
      function _resolveTraitName(t) {
        if (!t) return '';
        if (typeof t === 'object') return t.name || t.label || t.id || '';
        var s = String(t);
        // 若疑似英文 id(全 ASCII)·查 P.traitDefinitions 取中文 name
        if (/^[a-z_][a-z0-9_]*$/i.test(s) && typeof P !== 'undefined' && Array.isArray(P.traitDefinitions)) {
          var d = P.traitDefinitions.find(function(x){ return x && x.id === s; });
          if (d && d.name) return d.name;
          // 二级兜底·TraitDefinitions map
          if (typeof TraitDefinitions !== 'undefined' && TraitDefinitions[s] && TraitDefinitions[s].name) return TraitDefinitions[s].name;
        }
        return s;
      }
      var _rawTraits = [];
      if (Array.isArray(c.traitIds) && c.traitIds.length) _rawTraits = c.traitIds.slice(0, 3);
      else if (Array.isArray(c.traits) && c.traits.length) _rawTraits = c.traits.slice(0, 3);
      _rawTraits.forEach(function(tr){
        var nm = _resolveTraitName(tr);
        if (!nm) return;
        var tCls = /忠|仁|爱民|温|恕|慈/.test(nm)?'heart':/勇|武|权|狡|悍|烈|凶/.test(nm)?'valor':/智|谋|深|慎|敏/.test(nm)?'mind':/清|简|廉|直|正/.test(nm)?'gold':'gold';
        tagsHtml += '<span class="gs-cd-tag '+tCls+'">'+esc(nm.slice(0,4))+'</span>';
      });
      // 立场 tag·reform/conserve·从 ch.stance 读
      if (c.stance) {
        var stText = String(c.stance).trim();
        var stCls = /改革|变法|维新|革新|兴|除弊/.test(stText)?'reform':/保守|循规|遵法|祖制|稳|中庸/.test(stText)?'conserve':'';
        if (stCls) tagsHtml += '<span class="gs-cd-tag '+stCls+'">'+esc(stText.slice(0,4))+'</span>';
      }
      if (c.party) tagsHtml += '<span class="gs-cd-tag party">'+esc(c.party.slice(0,4))+'</span>';
      // 五常 (若有)
      var wuchang = '';
      var hasWc = typeof c.benevolence === 'number' || typeof c.righteousness === 'number';
      if (hasWc) {
        var ren = Math.round(c.benevolence||c.ren||50);
        var yi = Math.round(c.righteousness||c.yi||50);
        var li = Math.round(c.li||c.propriety||50);
        var zhi = Math.round(c.intelligence||c.zhi||50);
        var xin = Math.round(c.honesty||c.xin||50);
        wuchang = '<div class="gs-cd-wuchang">仁'+ren+' 义'+yi+' 礼'+li+' 智'+zhi+' 信'+xin;
        var avg = (ren+yi+li+zhi+xin)/5;
        var qz = avg>=75?'士人':avg>=60?'雅儒':avg>=40?'寻常':'粗野';
        wuchang += '<span class="gs-cd-wuchang-qz">· '+qz+'</span></div>';
      }
      // 资源 (公库/私产·含 SVG 图标·钱粮布 3 种)
      var pub = (c.resources && c.resources.publicPurse) || {};
      var priv = (c.resources && c.resources.privateWealth) || {};
      var fmt = function(v){ v = v||0; if (Math.abs(v)>=10000) return (v/10000).toFixed(1)+'万'; return String(Math.round(v)); };
      // SVG 图标·钱粮布(与 preview 三·右侧栏一致)
      var svgCoin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width:9px;height:9px;color:var(--gold-400);opacity:0.85;"><circle cx="12" cy="12" r="8"/><rect x="9.5" y="9.5" width="5" height="5" stroke-width="1.3"/></svg>';
      var svgGrain = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="width:9px;height:9px;color:var(--gold-400);opacity:0.85;"><path d="M12 21V6"/><path d="M12 11C9 11 6.5 9.5 5.5 7.5"/><path d="M12 11C15 11 17.5 9.5 18.5 7.5"/></svg>';
      var svgCloth = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" style="width:9px;height:9px;color:var(--gold-400);opacity:0.85;"><path d="M4 8Q12 5 20 8L20 10Q12 7 4 10Z"/><path d="M4 13Q12 10 20 13L20 15Q12 12 4 15Z"/></svg>';
      var hasRes = (pub.money||priv.money||pub.grain||priv.grain||pub.cloth||priv.cloth);
      var resHtml = '';
      if (hasRes) {
        resHtml = '<div class="gs-cd-resources">'
          + '<div class="gs-cd-res-grp"><span class="gs-cd-res-grp-lb">公</span>'
          + '<span class="gs-cd-res-it">'+svgCoin+'<span class="gs-cd-res-val'+(pub.money<0?' neg':'')+'">'+fmt(pub.money)+'</span></span>'
          + (pub.grain?'<span class="gs-cd-res-it">'+svgGrain+'<span class="gs-cd-res-val">'+fmt(pub.grain)+'</span></span>':'')
          + (pub.cloth?'<span class="gs-cd-res-it">'+svgCloth+'<span class="gs-cd-res-val">'+fmt(pub.cloth)+'</span></span>':'')
          + '</div>';
        if (priv.money || priv.grain || priv.cloth) {
          resHtml += '<div class="gs-cd-res-sep"></div>'
            + '<div class="gs-cd-res-grp"><span class="gs-cd-res-grp-lb">私</span>'
            + '<span class="gs-cd-res-it">'+svgCoin+'<span class="gs-cd-res-val'+(priv.money<0?' neg':'')+'">'+fmt(priv.money)+'</span></span>'
            + (priv.grain?'<span class="gs-cd-res-it">'+svgGrain+'<span class="gs-cd-res-val">'+fmt(priv.grain)+'</span></span>':'')
            + (priv.cloth?'<span class="gs-cd-res-it">'+svgCloth+'<span class="gs-cd-res-val">'+fmt(priv.cloth)+'</span></span>':'')
            + '</div>';
        }
        resHtml += '</div>';
      }
      // 数值胶囊·名望/贤能/健康/压力
      var fame = Math.round((c.resources && c.resources.fame) || 0);
      var virt = Math.round((c.resources && c.resources.virtueMerit) || 0);
      var health = Math.round((c.resources && c.resources.health) || c.health || 80);
      var pillsHtml = '<div class="gs-cd-stats-pills">'
        + '<span class="gs-cd-pill"><span class="gs-cd-pill-lb">名</span><span class="gs-cd-pill-val'+(fame<0?' neg':'')+'">'+(fame>=0?'+':'')+fame+'</span></span>'
        + '<span class="gs-cd-pill"><span class="gs-cd-pill-lb">贤</span><span class="gs-cd-pill-val">'+virt+'</span></span>'
        + '<span class="gs-cd-pill"><span class="gs-cd-pill-lb">健</span><span class="gs-cd-pill-val">'+health+'</span></span>'
        + '<span class="gs-cd-pill'+(stress>=80?' warn':'')+'"><span class="gs-cd-pill-lb">压</span><span class="gs-cd-pill-val">'+stress+'</span></span>'
        + '</div>';
      // 志向·带满足度百分比(cd-goal-pct)
      var goal = c.personalGoal || c.longGoal || '';
      var goalHtml = '';
      if (goal) {
        var gsat = c._goalSatisfaction !== undefined ? Math.round(c._goalSatisfaction) : -1;
        goalHtml = '<div class="gs-cd-goal" title="'+esc(goal)+'">志：'+esc(goal.slice(0,20))+(goal.length>20?'…':'');
        if (gsat >= 0) {
          var gpcCls = gsat>=60?'hi':gsat>=30?'mid':'lo';
          goalHtml += ' <span class="gs-cd-goal-pct '+gpcCls+'">'+gsat+'%</span>';
        }
        goalHtml += '</div>';
      }
      // 恩怨
      var enyuan = '';
      if (Array.isArray(c.feuds) && c.feuds.length) enyuan = '积怨：'+c.feuds.slice(0,2).map(function(f){return typeof f==='string'?f:(f.with||f.target||'');}).filter(Boolean).join('·');
      else if (c.mentor) enyuan = '师承：'+c.mentor;
      var enyuanHtml = enyuan ? '<div class="gs-cd-enyuan">'+esc(enyuan.slice(0,40))+'</div>' : '';

      // 立绘或姓氏首字
      var portraitInner = '';
      if (c.portrait) portraitInner = '<img src="'+esc(c.portrait)+'" onerror="this.style.display=\'none\';this.parentElement.textContent=\''+esc(name.charAt(0))+'\';" />';
      else portraitInner = esc(name.charAt(0));
      // 女性头像边框色
      var portraitStyle = isFem ? 'color:#e84393;border-color:#e84393;' : '';

      _cHtml += '<div class="gs-cd" onclick="if(typeof openCharDetail===\'function\')openCharDetail(\''+nameJs+'\')" title="点击查看详情">'
        + '<div class="gs-cd-main">'
          + '<div class="gs-cd-portrait"'+(portraitStyle?' style="'+portraitStyle+'"':'')+'>'+portraitInner+'</div>'
          + '<div class="gs-cd-body">'
            + '<div class="gs-cd-name-row">'
              + '<div class="gs-cd-name-left">'
                + moodIcon + esc(name)
                + (zi?'<span class="gs-cd-courtesy">· '+esc(zi)+'</span>':'')
                + '<span class="gs-cd-gender-age'+(isFem?' female':'')+'">'+(isFem?'♀':'♂')+age+'</span>'
                + travelBadge + spouseBadge + faceBadge
              + '</div>'
              + '<div class="gs-cd-name-right">'
                + '<span class="gs-cd-loy '+loyCls+'">忠'+loy+'</span>'
                + '<span class="gs-cd-amb">野'+amb+'</span>'
                + sBadge
              + '</div>'
            + '</div>'
            + '<div class="gs-cd-subrow">'
              + '<span class="gs-cd-office">'+esc(officeT)+(rankT?' · '+rankT:'')+'</span>'
              + (fac?'<span class="gs-cd-faction">'+esc(fac)+'</span>':'')
            + '</div>'
            + (tagsHtml?'<div class="gs-cd-tags">'+tagsHtml+'</div>':'')
            + wuchang
            + resHtml
            + pillsHtml
            + goalHtml
            + enyuanHtml
          + '</div>'
        + '</div>'
      + '</div>';
    });
    _cHtml += '</div>';  // close .gs-cd-scroll
    cp.innerHTML = _cHtml;
    wrap.appendChild(cp);

    // 4. 当前议题 — 复用 GM.currentIssues / pendingConsequences
    var issues = (GM.currentIssues||[]);
    var pendingIssues = issues.filter(function(i){return i.status !== 'resolved';});
    if (issues.length) {
      var ip = document.createElement('div');
      ip.className = 'gs-panel p-issue';
      ip.setAttribute('data-panel-key','issue');
      var _nums=['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五','十六','十七','十八','十九','廿'];
      var _iHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">当 前 议 题</div><span class="gs-panel-cnt">'+pendingIssues.length+' 要</span></div>';
      _iHtml += '<div class="gs-scroll-list" style="max-height:220px;overflow-y:auto;overflow-x:hidden;padding-right:4px;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';
      pendingIssues.forEach(function(iss,i){
        var sev = iss.severity || iss.level || 'warn';
        var cls = sev === 'urgent' || sev === 'high' ? 'urgent' : sev === 'info' ? 'info' : 'warn';
        var txt = iss.text || iss.title || iss.description || iss.name || '(未详)';
        var tm = iss.time || (iss.urgent?'即刻':'本回');
        _iHtml += '<div class="gs-issue-item '+cls+'"><span class="gs-issue-num">'+(_nums[i]||(i+1))+'</span><span class="gs-issue-text">'+esc(txt)+'</span><span class="gs-issue-time">'+esc(tm)+'</span></div>';
      });
      _iHtml += '</div>';
      ip.innerHTML = _iHtml;
      wrap.appendChild(ip);
    }

    // 5. 朕之大志
    if (pc.goals && pc.goals.length) {
      var gp = document.createElement('div');
      gp.className = 'gs-panel p-goal';
      gp.setAttribute('data-panel-key','goal');
      var _gHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">朕 之 大 志</div><span class="gs-panel-cnt">'+pc.goals.length+' 纲</span></div>';
      pc.goals.slice(0,3).forEach(function(g){
        var prog = g.progress || 0;
        var prio = g.priority || '甲';
        _gHtml += '<div class="gs-goal-item"><div class="gs-goal-hdr"><span class="gs-goal-title">'+esc(g.title||g.name||'')+'</span><span class="gs-goal-prio">'+esc(prio)+'</span></div>'
          + '<div class="gs-goal-desc">'+esc(g.longTerm||g.shortTerm||g.description||'')+'</div>'
          + '<div class="gs-goal-prog"><div class="gs-goal-prog-fill" style="width:'+Math.min(100,prog)+'%;"></div></div></div>';
      });
      gp.innerHTML = _gHtml;
      wrap.appendChild(gp);
    }

    // 6. 岁入岁出（近6回合 mini 图）
    var fp = document.createElement('div');
    fp.className = 'gs-panel p-finance';
    fp.setAttribute('data-panel-key','fin');
    var hist = (GM.guoku && GM.guoku.history) || [];
    var pairs=[];
    for (var i=0; i<6; i++) {
      var h = hist[hist.length-6+i] || {};
      var inP = Math.max(10, Math.min(100, (h.income||50)/Math.max(1,(GM.guoku&&GM.guoku.annualIncome)||100)*100));
      var outP = Math.max(10, Math.min(100, (h.expense||60)/Math.max(1,(GM.guoku&&GM.guoku.annualIncome)||100)*100));
      pairs.push({in:inP||70, out:outP||75, m:((GM.turn||1)-6+i)});
    }
    var _finHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">岁 入 岁 出</div><span class="gs-panel-cnt">近 6 回</span></div>'
      + '<div class="gs-fin-chart"><div class="gs-fin-bars">';
    pairs.forEach(function(p){
      _finHtml += '<div class="gs-fin-group"><div class="gs-fin-bar-stack"><div class="gs-fin-bar income" style="height:'+p.in+'%;"></div></div><div class="gs-fin-lbl">'+Math.max(0,p.m)+'</div></div>';
      _finHtml += '<div class="gs-fin-group"><div class="gs-fin-bar-stack"><div class="gs-fin-bar expense" style="height:'+p.out+'%;"></div></div><div class="gs-fin-lbl">·</div></div>';
    });
    _finHtml += '</div><div class="gs-fin-legend"><span class="in">岁 入</span><span class="out">岁 出</span></div></div>';
    fp.innerHTML = _finHtml;
    wrap.appendChild(fp);

    // 7. 近事快报
    var news = (GM.qijuHistory||[]).slice(0, 30).reverse();
    if (news.length) {
      var np = document.createElement('div');
      np.className = 'gs-panel p-news';
      np.setAttribute('data-panel-key','news');
      var _nHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">近 事 快 报</div><span class="gs-panel-cnt">近 '+news.length+'</span></div>';
      _nHtml += '<div class="gs-scroll-list" style="max-height:240px;overflow-y:auto;overflow-x:hidden;padding-right:4px;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';
      news.forEach(function(q){
        var cat = q.category || q.cat || '事';
        var clsMap = {'\u8BCF\u4EE4':'edict','\u594F\u758F':'memo','\u671D\u8BAE':'chaoyi','\u9E3F\u96C1':'letter','\u4EBA\u4E8B':'person'};
        var ccls = clsMap[cat] || 'person';
        var txt = q.content || q.text || q.zhengwen || '';
        if (txt.length > 60) txt = txt.slice(0, 60) + '…';
        var tm = q.time || q.date || '';
        _nHtml += '<div class="gs-news-item '+ccls+'"><span class="t">'+esc((tm+'').slice(0,3))+'</span><span class="body">'+esc(txt)+'</span></div>';
      });
      _nHtml += '</div>';
      np.innerHTML = _nHtml;
      wrap.appendChild(np);
    }

    // 8. 风闻坊录
    var rumors = (GM.rumors||GM._rumors||[]).slice(0,4);
    if (rumors.length) {
      var rp = document.createElement('div');
      rp.className = 'gs-panel p-rumor';
      rp.setAttribute('data-panel-key','rumor');
      var _rHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">风 闻 坊 录</div><span class="gs-panel-cnt">'+rumors.length+'</span></div>';
      rumors.forEach(function(r){
        var cred = r.credibility || r.confidence || '中';
        _rHtml += '<div class="gs-rumor-item">'+esc(r.text||r.content||r.name||'')+'<span class="cred">·'+esc(cred)+'</span></div>';
      });
      rp.innerHTML = _rHtml;
      wrap.appendChild(rp);
    }

    // 7.5 人脉关系网（朕中心 + 6 近臣放射）
    var _relChars = (GM.chars||[]).filter(function(c){return c && c.alive!==false && !c.isPlayer;})
      .sort(function(a,b){ return (b.importance||0)+(b.loyalty||0)*0.3 - ((a.importance||0)+(a.loyalty||0)*0.3); })
      .slice(0, 6);
    if (_relChars.length) {
      var relP = document.createElement('div');
      relP.className = 'gs-panel p-rel';
      relP.setAttribute('data-panel-key','rel');
      var _rHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">人 脉 关 系</div><span class="gs-panel-cnt">'+_relChars.length+'</span></div>';
      _rHtml += '<div class="gs-rel-net">';
      var _positions = [ // 6 方位（相对中心）
        {top:'20%',left:'76%',deg:-55},
        {top:'82%',left:'72%',deg:42},
        {top:'38%',left:'6%',deg:170},
        {top:'72%',left:'14%',deg:130},
        {top:'12%',left:'28%',deg:-130},
        {top:'82%',left:'40%',deg:90}
      ];
      _relChars.forEach(function(c,i){
        var pos = _positions[i] || {top:'50%',left:'50%',deg:0};
        var loy = c.loyalty || 50, amb = c.ambition || 40;
        var cls = loy >= 65 ? 'friend' : loy < 35 || amb > 75 ? 'foe' : 'neutral';
        var edgeCls = cls === 'friend' ? 'friend' : cls === 'foe' ? 'foe' : 'dashed';
        var edgeLen = 44 + Math.round(Math.random()*20);
        _rHtml += '<div class="gs-rel-edge '+edgeCls+'" style="top:50%;left:50%;width:'+edgeLen+'px;transform:rotate('+pos.deg+'deg);"></div>';
        _rHtml += '<div class="gs-rel-node '+cls+'" style="top:calc('+pos.top+' - 11px);left:calc('+pos.left+' - 11px);" title="'+esc(c.name)+'(忠'+Math.round(loy)+')">'+esc(c.name.charAt(0))+'</div>';
      });
      _rHtml += '<div class="gs-rel-node center" style="top:calc(50% - 14px);left:calc(50% - 14px);">朕</div>';
      _rHtml += '</div>';
      relP.innerHTML = _rHtml;
      wrap.appendChild(relP);
    }

    // 7.6 祭祀礼仪（月历 + 待办清单）
    var jp = document.createElement('div');
    jp.className = 'gs-panel p-jifa';
    jp.setAttribute('data-panel-key','jifa');
    var _today = ((GM.turn||1) % 12) + 1;
    var _jifaHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">祭 祀 礼 仪</div><span class="gs-panel-cnt">本月</span></div>';
    _jifaHtml += '<div class="gs-jifa-calendar">';
    var _dayLabels = ['朔','初二','祭太庙','初四','吉日','初六','初七','初八','初九','祀天','十一','望'];
    var _jifaCls = [ '', '', 'jisi', '', 'auspicious', '', '', '', '', 'jisi', '', '' ];
    for (var _di=0; _di<12; _di++){
      var c = _jifaCls[_di], isToday = (_di+1 === _today);
      _jifaHtml += '<div class="gs-jifa-cell'+(c?' '+c:'')+(isToday?' today auspicious':'')+'">'+(isToday?'今 日':_dayLabels[_di])+'</div>';
    }
    _jifaHtml += '</div>';
    _jifaHtml += '<div class="gs-jifa-row"><span class="gs-jifa-type">【祀天】</span><span class="gs-jifa-name">秋分大祀·圜丘</span><span class="gs-jifa-due">2日后</span></div>';
    _jifaHtml += '<div class="gs-jifa-row"><span class="gs-jifa-type">【祭祖】</span><span class="gs-jifa-name">太庙告庙·升祔</span><span class="gs-jifa-due">已备</span></div>';
    _jifaHtml += '<div class="gs-jifa-row"><span class="gs-jifa-type">【朝贺】</span><span class="gs-jifa-name">万寿节·百官朝贺</span><span class="gs-jifa-due">下月</span></div>';
    jp.innerHTML = _jifaHtml;
    wrap.appendChild(jp);

    // 7.7 监察百司
    var cp2 = document.createElement('div');
    cp2.className = 'gs-panel p-censor';
    cp2.setAttribute('data-panel-key','censor');
    // 尝试从 GM.memorials 统计
    var _mems = GM.memorials || [];
    var _tanhe = _mems.filter(function(m){return (m.type||m.subtype||'').indexOf('弹')>=0 || (m.content||'').indexOf('弹劾')>=0;}).length;
    var _mizou = _mems.filter(function(m){return m.subtype === '密折' || m.subtype === '密揭';}).length;
    var _censorHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">监 察 百 司</div><span class="gs-panel-cnt">4 司</span></div>';
    _censorHtml += '<div class="gs-censor-row"><span class="gs-censor-icon" style="--ce-c:var(--indigo-400,#5a6fa8);">都</span><span class="gs-censor-name">都察院</span><span class="gs-censor-alert '+(_tanhe>3?'hi':_tanhe>0?'mid':'lo')+'">弹劾 '+_tanhe+'</span></div>';
    _censorHtml += '<div class="gs-censor-row"><span class="gs-censor-icon" style="--ce-c:var(--purple-400,#8e6aa8);">厂</span><span class="gs-censor-name">东厂</span><span class="gs-censor-alert '+(_mizou>0?'hi':'lo')+'">密奏 '+_mizou+'</span></div>';
    _censorHtml += '<div class="gs-censor-row"><span class="gs-censor-icon" style="--ce-c:var(--vermillion-400);">锦</span><span class="gs-censor-name">锦衣卫</span><span class="gs-censor-alert lo">巡视</span></div>';
    _censorHtml += '<div class="gs-censor-row"><span class="gs-censor-icon" style="--ce-c:var(--celadon-400,#7eb8a7);">理</span><span class="gs-censor-name">大理寺</span><span class="gs-censor-alert mid">刑案 '+((GM.pendingCases||[]).length||0)+'</span></div>';
    cp2.innerHTML = _censorHtml;
    wrap.appendChild(cp2);

    // 7.8 宫廷日程（明日安排）
    var ap = document.createElement('div');
    ap.className = 'gs-panel p-agenda';
    ap.setAttribute('data-panel-key','agenda');
    var _aHtml = '<div class="gs-panel-hdr"><div class="gs-panel-title">宫 廷 日 程</div><span class="gs-panel-cnt">明日</span></div>';
    _aHtml += '<div class="gs-agenda-row chaoyi"><span class="gs-agenda-time">卯时</span><span class="gs-agenda-name">常 朝</span><span class="gs-agenda-with">群臣</span></div>';
    if (_relChars && _relChars[0]) _aHtml += '<div class="gs-agenda-row zhaojian"><span class="gs-agenda-time">辰时</span><span class="gs-agenda-name">召 见</span><span class="gs-agenda-with">'+esc(_relChars[0].name)+'</span></div>';
    var _memoCt = (GM.memorials||[]).filter(function(m){return !m.reviewed;}).length;
    _aHtml += '<div class="gs-agenda-row"><span class="gs-agenda-time">巳时</span><span class="gs-agenda-name">批 阅 奏 疏</span><span class="gs-agenda-with">'+_memoCt+' 封</span></div>';
    if ((GM.currentIssues||[]).length) _aHtml += '<div class="gs-agenda-row chaoyi"><span class="gs-agenda-time">午时</span><span class="gs-agenda-name">廷 议</span><span class="gs-agenda-with">'+esc((GM.currentIssues[0].title||GM.currentIssues[0].text||'要务').slice(0,6))+'</span></div>';
    _aHtml += '<div class="gs-agenda-row jisi"><span class="gs-agenda-time">申时</span><span class="gs-agenda-name">祀 节 气</span><span class="gs-agenda-with">圜丘</span></div>';
    ap.innerHTML = _aHtml;
    wrap.appendChild(ap);

    // 9. 精力气血
    var en = document.createElement('div');
    en.className = 'gs-energy';
    en.setAttribute('data-panel-key','energy');
    var energy = GM._energy != null ? GM._energy : 80;
    var energyMax = GM._energyMax || 100;
    var pct = Math.round((energy/energyMax)*100);
    en.innerHTML = '<div class="gs-energy-hdr"><span class="gs-energy-lbl">精 力 气 血</span><span class="gs-energy-val">'+Math.round(energy)+' <span class="max">/ '+energyMax+'</span></span></div>'
      + '<div class="gs-energy-bar"><div class="gs-energy-fill" style="width:'+pct+'%;"></div></div>'
      + '<div class="gs-energy-tick"><span>疲</span><span>可议</span><span>充</span></div>';
    wrap.appendChild(en);

    gr.appendChild(wrap);
  };

  // 四时物候圆盘颜色（通过 data-season 属性）
  try {
    var _style = document.createElement('style');
    _style.textContent = '.gs-season-disc[data-season="春"]::after{content:"春";color:var(--celadon-400,#7eb8a7);}'
      + '.gs-season-disc[data-season="夏"]::after{content:"夏";color:var(--amber-400,#c9a045);}'
      + '.gs-season-disc[data-season="秋"]::after{content:"秋";color:var(--amber-400,#c9a045);}'
      + '.gs-season-disc[data-season="冬"]::after{content:"冬";color:var(--indigo-400,#5a6fa8);}';
    document.head.appendChild(_style);
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-shell-extras');}catch(_){}}

  // ═══════════════════════════════════════════════════════════════════
  //  界面主题 · 字号 · 字体 实装（暴露为 window 全局·给 onclick 调用）
  // ═══════════════════════════════════════════════════════════════════

  // 主题 → 覆盖 :root CSS 变量（通过 <style id="_tmThemeOverride">）
  var THEME_PALETTES = {
    plain: { // 素纸·默认金-朱
      bg:'#1a1510', surface:'#2a2218', fg:'#f4eadd',
      primary:'#c9a85f', accent:'#b84738', info:'#7eb8a7', warn:'#c9a045',
      gold1:'#b89a53', gold2:'#c9a85f', gold3:'#d4be7a',
      verm1:'#8f3428', verm2:'#b84738', verm3:'#d15c47',
      cela:'#6a9a7f'
    },
    ink: { // 水墨·冷调
      bg:'#1a1a22', surface:'#282834', fg:'#d9c9a9',
      primary:'#a69470', accent:'#6b5d47', info:'#b0b8c4', warn:'#c9c4a8',
      gold1:'#6b5d47', gold2:'#a69470', gold3:'#c2b596',
      verm1:'#5a4038', verm2:'#7a5548', verm3:'#a07058',
      cela:'#607080'
    },
    vermillion: { // 朱砂·浓朱
      bg:'#1e0f0c', surface:'#2e1a14', fg:'#fce6d8',
      primary:'#d15c47', accent:'#8f3428', info:'#c9a045', warn:'#e89078',
      gold1:'#b89a53', gold2:'#c9a85f', gold3:'#e8c888',
      verm1:'#8f3428', verm2:'#b84738', verm3:'#d15c47',
      cela:'#8a7050'
    },
    celadon: { // 青绿·山水
      bg:'#0f1814', surface:'#1a2420', fg:'#e8f0e0',
      primary:'#6a9a7f', accent:'#4a7a5f', info:'#b89a53', warn:'#d9c9a9',
      gold1:'#8a9060', gold2:'#b89a53', gold3:'#d9c9a9',
      verm1:'#7a5548', verm2:'#a07058', verm3:'#c08878',
      cela:'#6a9a7f'
    }
  };
  window._tmApplyTheme = function(name, el) {
    var pal = THEME_PALETTES[name] || THEME_PALETTES.plain;
    var css = ':root{'
      + '--color-background:' + pal.bg + ';'
      + '--color-surface:' + pal.surface + ';'
      + '--color-foreground:' + pal.fg + ';'
      + '--color-primary:' + pal.primary + ';'
      + '--color-accent:' + pal.accent + ';'
      + '--color-info:' + pal.info + ';'
      + '--color-warning:' + pal.warn + ';'
      + '--gold-400:' + pal.gold2 + ';'
      + '--gold-500:' + pal.gold1 + ';'
      + '--gold-300:' + pal.gold3 + ';'
      + '--vermillion-400:' + pal.verm2 + ';'
      + '--vermillion-500:' + pal.verm1 + ';'
      + '--vermillion-300:' + pal.verm3 + ';'
      + '--celadon-400:' + pal.cela + ';'
      + '--bg-2:' + pal.bg + ';'
      + '--bg-3:' + pal.surface + ';'
      + '}';
    var st = document.getElementById('_tmThemeOverride');
    if (!st) { st = document.createElement('style'); st.id = '_tmThemeOverride'; document.head.appendChild(st); }
    st.textContent = css;
    try { localStorage.setItem('tm.theme', name); } catch(_){}
    // UI: 高亮当前卡
    if (el) {
      var parent = el.parentElement;
      if (parent) {
        parent.querySelectorAll('.gs-theme-card').forEach(function(c){ c.classList.remove('active'); });
        el.classList.add('active');
      }
    }
    if (typeof toast === 'function') toast('主题·' + (name==='plain'?'素纸':name==='ink'?'水墨':name==='vermillion'?'朱砂':'青绿'));
  };

  // 字号 → 覆盖 --text-* 比例
  var SIZE_SCALES = { sm: 0.85, md: 1.0, lg: 1.15, xl: 1.32 };
  var SIZE_BASE = { xs:0.95, sm:1.05, base:1.18, md:1.28, lg:1.42, xl:1.60, xl2:1.90, xl3:2.45 };
  window._tmApplySize = function(size, el) {
    var s = SIZE_SCALES[size] || 1.0;
    var css = ':root{'
      + '--text-xs:' + (SIZE_BASE.xs*s).toFixed(2) + 'rem;'
      + '--text-sm:' + (SIZE_BASE.sm*s).toFixed(2) + 'rem;'
      + '--text-base:' + (SIZE_BASE.base*s).toFixed(2) + 'rem;'
      + '--text-md:' + (SIZE_BASE.md*s).toFixed(2) + 'rem;'
      + '--text-lg:' + (SIZE_BASE.lg*s).toFixed(2) + 'rem;'
      + '--text-xl:' + (SIZE_BASE.xl*s).toFixed(2) + 'rem;'
      + '--text-2xl:' + (SIZE_BASE.xl2*s).toFixed(2) + 'rem;'
      + '--text-3xl:' + (SIZE_BASE.xl3*s).toFixed(2) + 'rem;'
      + '}';
    var st = document.getElementById('_tmSizeOverride');
    if (!st) { st = document.createElement('style'); st.id = '_tmSizeOverride'; document.head.appendChild(st); }
    st.textContent = css;
    try { localStorage.setItem('tm.fontSize', size); } catch(_){}
    if (el) {
      var parent = el.parentElement;
      if (parent) {
        parent.querySelectorAll('.gs-sz-btn').forEach(function(b){ b.classList.remove('active'); });
        el.classList.add('active');
      }
    }
    if (typeof toast === 'function') toast('字号·' + (size==='sm'?'小':size==='md'?'中':size==='lg'?'大':'特大'));
  };

  window._tmApplyBodyFont = function(font) {
    var css = ':root{--font-serif:"' + font + '","STKaiti","KaiTi","楷体","Noto Serif SC","SimSun",serif;}';
    var st = document.getElementById('_tmBodyFontOverride');
    if (!st) { st = document.createElement('style'); st.id = '_tmBodyFontOverride'; document.head.appendChild(st); }
    st.textContent = css;
    try { localStorage.setItem('tm.fontBody', font); } catch(_){}
    if (typeof toast === 'function') toast('正文字体·' + font);
  };

  window._tmApplyTitleFont = function(font) {
    var css = '.home-title,.turn-summary-bar,.gs-panel-title,.gs-drawer-title,.mem-title,.wdp-title,.hy-title,.bn-title,h1,h2,h3,h4{font-family:"' + font + '","STKaiti","KaiTi","楷体",serif !important;}';
    var st = document.getElementById('_tmTitleFontOverride');
    if (!st) { st = document.createElement('style'); st.id = '_tmTitleFontOverride'; document.head.appendChild(st); }
    st.textContent = css;
    try { localStorage.setItem('tm.fontTitle', font); } catch(_){}
    if (typeof toast === 'function') toast('标题字体·' + font);
  };

  // 启动时恢复已保存的设置
  try {
    var _sv = localStorage.getItem('tm.theme'); if (_sv && _sv !== 'plain') window._tmApplyTheme(_sv);
    var _sz = localStorage.getItem('tm.fontSize'); if (_sz && _sz !== 'md') window._tmApplySize(_sz);
    var _bf = localStorage.getItem('tm.fontBody'); if (_bf && _bf !== 'STKaiti') window._tmApplyBodyFont(_bf);
    var _tf = localStorage.getItem('tm.fontTitle'); if (_tf && _tf !== 'STKaiti') window._tmApplyTitleFont(_tf);
  } catch(_){}
})();

// ===================================================================
// 御案时政·名录 / 详情 / 召对·密召入口
// ===================================================================
function openShizhengTasks() {
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});};
  var GM = window.GM || {};
  var all = (GM.currentIssues || []).slice();
  var pending = all.filter(function(i){ return i.status !== 'resolved'; })
                   .sort(function(a,b){ return (b.raisedTurn||0) - (a.raisedTurn||0); });
  var resolved = all.filter(function(i){ return i.status === 'resolved'; })
                    .sort(function(a,b){ return (b.resolvedTurn||b.raisedTurn||0) - (a.resolvedTurn||a.raisedTurn||0); });

  var exist = document.getElementById('shizheng-tasks-overlay');
  if (exist) exist.remove();

  var overlay = document.createElement('div');
  overlay.id = 'shizheng-tasks-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(18,12,6,0.85);z-index:9998;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
  overlay.onclick = function(e){ if (e.target === overlay) closeShizhengTasks(); };

  var panel = document.createElement('div');
  panel.style.cssText = 'width:min(92vw,1020px);max-height:78vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#1e1610,#14100a);border:1px solid var(--gold-d);border-radius:6px;box-shadow:0 8px 40px rgba(0,0,0,0.7);overflow:hidden;';

  var html = '';
  html += '<div style="padding:0.9rem 1.4rem;display:flex;align-items:center;gap:1rem;border-bottom:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,rgba(201,168,76,0.06),transparent);">';
  html += '<button onclick="closeShizhengTasks()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);padding:0.35rem 0.9rem;cursor:pointer;font-size:0.88rem;border-radius:3px;letter-spacing:0.15em;font-family:\'STKaiti\',\'KaiTi\',serif;">‹ 返 回</button>';
  html += '<div style="flex:1;text-align:center;font-size:1.25rem;letter-spacing:0.7rem;color:var(--gold);font-family:\'STKaiti\',\'KaiTi\',serif;text-shadow:0 2px 8px rgba(201,168,76,0.2);">御 案 时 政</div>';
  html += '<div style="width:5rem;text-align:right;"><span style="color:var(--txt-d);font-size:0.72rem;">'+pending.length+' 待 / '+resolved.length+' 决</span></div>';
  html += '</div>';

  html += '<div style="flex:1;overflow-y:auto;padding:1.1rem 1.4rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';

  if (pending.length === 0 && resolved.length === 0) {
    html += '<div style="text-align:center;padding:4rem 2rem;color:var(--txt-d);font-size:0.95rem;font-family:\'STKaiti\',\'KaiTi\',serif;letter-spacing:0.3em;">四海升平·暂无要务</div>';
  } else {
    html += '<div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:0.85rem;">';
    pending.forEach(function(issue){ html += _renderShizhengCard(issue, _esc); });
    resolved.forEach(function(issue){ html += _renderShizhengCard(issue, _esc); });
    html += '</div>';
  }

  html += '</div>';
  panel.innerHTML = html;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

function closeShizhengTasks() {
  var el = document.getElementById('shizheng-tasks-overlay');
  if (el) el.remove();
  var det = document.getElementById('shizheng-task-detail');
  if (det) det.remove();
}

function _renderShizhengCard(issue, _esc) {
  _esc = _esc || ((typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s);});
  var isPending = issue.status !== 'resolved';
  var safeId = String(issue.id || '').replace(/'/g, "\\'");
  var _tsT = (typeof getTSText === 'function') ? getTSText : null;
  var dateStr = issue.raisedDate || (_tsT ? _tsT(issue.raisedTurn||1) : ('第'+(issue.raisedTurn||1)+'回合'));
  var title = issue.title || '(未详)';
  var rawDesc = String(issue.description || '');
  var desc = rawDesc.length > 70 ? rawDesc.slice(0, 70) + '…' : rawDesc;

  var cardBg = isPending ? '#f4e8cc' : '#e8ddbf';
  var cardBorder = isPending ? '#c9a85f' : '#a39373';
  var titleColor = isPending ? '#3d2f1a' : '#6b5d47';
  var descColor = isPending ? '#5a4a32' : '#8b7d68';
  var badgeStyle = isPending
    ? 'background:rgba(192,64,48,0.08);border:1px solid rgba(192,64,48,0.45);color:#a13c2e;'
    : 'background:rgba(90,90,90,0.08);border:1px solid rgba(90,90,90,0.45);color:#6b6b6b;';
  var badgeText = isPending ? '待解决' : '已解决';

  var h = '<div class="shizheng-card" data-issue-id="'+_esc(safeId)+'" ';
  h += 'style="background:'+cardBg+';border:1px solid '+cardBorder+';border-radius:4px;padding:0.9rem 1.1rem 0.95rem;cursor:pointer;position:relative;min-height:116px;transition:transform 0.15s ease-out,box-shadow 0.15s ease-out;'+(isPending?'':'opacity:0.78;')+'" ';
  h += 'onmouseover="this.style.transform=\'translateY(-2px)\';this.style.boxShadow=\'0 4px 14px rgba(201,168,76,0.25)\';" ';
  h += 'onmouseout="this.style.transform=\'\';this.style.boxShadow=\'\';" ';
  h += 'onclick="_openShizhengDetail(\''+safeId+'\')">';
  h += '<div style="position:absolute;top:10px;right:10px;'+badgeStyle+'padding:2px 10px;border-radius:2px;font-size:0.7rem;font-weight:bold;transform:rotate(6deg);letter-spacing:0.1em;">'+badgeText+'</div>';
  h += '<div style="font-weight:700;font-size:1rem;color:'+titleColor+';margin-bottom:0.3rem;padding-right:60px;line-height:1.4;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(title)+'</div>';
  h += '<div style="font-size:0.72rem;color:#8b7355;margin-bottom:0.5rem;letter-spacing:0.05em;">'+_esc(dateStr)+'</div>';
  h += '<div style="font-size:0.8rem;color:'+descColor+';line-height:1.65;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(desc)+'</div>';
  h += '</div>';
  return h;
}

function _openShizhengDetail(issueId) {
  var GM = window.GM || {};
  var issue = (GM.currentIssues||[]).find(function(i){ return String(i.id) === String(issueId); });
  if (!issue) { if (typeof toast === 'function') toast('议题已失效'); return; }
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s);};
  var _tsT2 = (typeof getTSText === 'function') ? getTSText : null;

  var prev = document.getElementById('shizheng-task-detail');
  if (prev) prev.remove();

  var det = document.createElement('div');
  det.id = 'shizheng-task-detail';
  det.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,5,0.88);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  det.onclick = function(e){ if (e.target === det) det.remove(); };

  var panel = document.createElement('div');
  panel.style.cssText = 'width:min(90vw,760px);max-height:82vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#1e1610,#14100a);border:1px solid var(--gold-d);border-radius:6px;box-shadow:0 10px 48px rgba(0,0,0,0.75);overflow:hidden;';

  var isPending = issue.status !== 'resolved';
  var badgeStyle = isPending
    ? 'background:rgba(192,64,48,0.12);border:1px solid rgba(192,64,48,0.5);color:#c05030;'
    : 'background:rgba(120,120,120,0.12);border:1px solid rgba(120,120,120,0.5);color:#888;';
  var badgeText = isPending ? '待解决' : '已解决';

  var h = '';
  h += '<div style="padding:0.85rem 1.3rem;display:flex;align-items:center;border-bottom:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,rgba(201,168,76,0.05),transparent);">';
  h += '<button onclick="document.getElementById(\'shizheng-task-detail\').remove()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);padding:0.35rem 0.9rem;cursor:pointer;font-size:0.85rem;border-radius:3px;letter-spacing:0.15em;font-family:\'STKaiti\',\'KaiTi\',serif;">‹ 返 回</button>';
  h += '<div style="flex:1;"></div>';
  h += '<button onclick="document.getElementById(\'shizheng-task-detail\').remove()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);width:1.9rem;height:1.9rem;cursor:pointer;font-size:0.85rem;border-radius:3px;">✕</button>';
  h += '</div>';

  // 滚动正文
  h += '<div style="flex:1;overflow-y:auto;padding:1.4rem 1.8rem 1.6rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';

  // 标题区
  h += '<div style="text-align:center;margin-bottom:1.3rem;">';
  h += '<div style="font-size:1.55rem;font-weight:bold;color:var(--gold);font-family:\'STKaiti\',\'KaiTi\',serif;letter-spacing:0.18em;margin-bottom:0.5rem;text-shadow:0 2px 12px rgba(201,168,76,0.2);">'+_esc(issue.title||'')+'</div>';
  var _rDate = issue.raisedDate || (_tsT2 ? _tsT2(issue.raisedTurn||1) : ('第'+(issue.raisedTurn||1)+'回合'));
  h += '<div style="display:inline-flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:0.6rem;color:var(--txt-d);font-size:0.8rem;">';
  h += '<span>'+_esc(_rDate)+'</span>';
  if (issue.category) h += '<span style="color:var(--gold-d);">·</span><span>'+_esc(issue.category)+'</span>';
  if (issue.affectedRegion) h += '<span style="color:var(--gold-d);">·</span><span style="color:var(--vermillion-300);">影响·'+_esc(issue.affectedRegion)+'</span>';
  if (issue.severity) {
    var _sevMap = {urgent:'紧急',high:'重要',warn:'警戒',info:'平常'};
    h += '<span style="color:var(--gold-d);">·</span><span>'+_esc(_sevMap[issue.severity]||issue.severity)+'</span>';
  }
  h += '<span style="'+badgeStyle+'padding:2px 10px;border-radius:2px;font-size:0.72rem;font-weight:bold;letter-spacing:0.1em;">'+badgeText+'</span>';
  h += '</div></div>';

  // 核心描述
  h += '<div style="font-size:0.95rem;line-height:2.05;color:var(--txt-l);margin-bottom:1.2rem;text-align:justify;white-space:pre-wrap;font-family:\'STKaiti\',\'KaiTi\',serif;letter-spacing:0.02em;padding:0.8rem 1rem;background:rgba(201,168,76,0.025);border-left:2px solid var(--gold-d);">'+_esc(issue.description||'')+'</div>';

  // 详情奏闻（narrative）
  if (issue.narrative && issue.narrative !== issue.description) {
    h += '<div style="margin-bottom:1.2rem;">';
    h += '<div style="font-size:0.78rem;color:var(--gold);letter-spacing:0.28em;margin-bottom:0.5rem;font-family:\'STKaiti\',\'KaiTi\',serif;">〔 详 情 奏 闻 〕</div>';
    h += '<div style="font-size:0.88rem;line-height:2;color:var(--txt-s);text-align:justify;white-space:pre-wrap;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(issue.narrative)+'</div>';
    h += '</div>';
  }

  // 关涉人物 + 势力
  var hasChars = Array.isArray(issue.linkedChars) && issue.linkedChars.length > 0;
  var hasFacs = Array.isArray(issue.linkedFactions) && issue.linkedFactions.length > 0;
  if (hasChars || hasFacs) {
    h += '<div style="margin-bottom:1.2rem;display:grid;grid-template-columns:'+(hasChars&&hasFacs?'1fr 1fr':'1fr')+';gap:0.8rem;">';
    if (hasChars) {
      h += '<div><div style="font-size:0.75rem;color:var(--gold);letter-spacing:0.25em;margin-bottom:0.35rem;font-family:\'STKaiti\',\'KaiTi\',serif;">关 涉 群 臣</div>';
      h += '<div style="font-size:0.82rem;line-height:1.9;">';
      h += issue.linkedChars.map(function(n){return '<span style="display:inline-block;padding:1px 8px;margin:2px 3px 2px 0;background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);border-radius:2px;color:var(--gold-l);font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(n)+'</span>';}).join('');
      h += '</div></div>';
    }
    if (hasFacs) {
      h += '<div><div style="font-size:0.75rem;color:var(--gold);letter-spacing:0.25em;margin-bottom:0.35rem;font-family:\'STKaiti\',\'KaiTi\',serif;">牵 动 势 力</div>';
      h += '<div style="font-size:0.82rem;line-height:1.9;">';
      h += issue.linkedFactions.map(function(n){return '<span style="display:inline-block;padding:1px 8px;margin:2px 3px 2px 0;background:rgba(192,64,48,0.08);border:1px solid rgba(192,64,48,0.25);border-radius:2px;color:var(--vermillion-300);font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(n)+'</span>';}).join('');
      h += '</div></div>';
    }
    h += '</div>';
  }

  // 风势推演（长期后果）
  if (issue.longTermConsequences && typeof issue.longTermConsequences === 'object') {
    h += '<div style="margin-bottom:1.2rem;background:rgba(201,168,76,0.04);border:1px solid var(--gold-d);border-radius:3px;padding:0.8rem 1.1rem;">';
    h += '<div style="font-size:0.78rem;color:var(--gold);letter-spacing:0.28em;margin-bottom:0.45rem;font-family:\'STKaiti\',\'KaiTi\',serif;">〔 风 势 推 演 〕</div>';
    Object.keys(issue.longTermConsequences).forEach(function(k) {
      h += '<div style="font-size:0.82rem;color:var(--txt-s);line-height:1.85;margin-bottom:0.2rem;font-family:\'STKaiti\',\'KaiTi\',serif;"><b style="color:var(--gold-d);">'+_esc(k)+'：</b>'+_esc(issue.longTermConsequences[k])+'</div>';
    });
    h += '</div>';
  }

  // 史料
  if (issue.historicalNote) {
    h += '<div style="margin-bottom:1.2rem;font-size:0.78rem;color:var(--ink-400);font-style:italic;line-height:1.85;border-left:2px solid rgba(201,168,76,0.4);padding:0.45rem 0.9rem;background:rgba(201,168,76,0.025);font-family:\'STKaiti\',\'KaiTi\',serif;">〔 史 馆 旧 案 〕 '+_esc(issue.historicalNote)+'</div>';
  }

  // 已选决断（若已决）
  if (issue.chosenText) {
    h += '<div style="margin-bottom:1.2rem;font-size:0.82rem;color:var(--celadon-400,#7eb8a7);line-height:1.8;padding:0.5rem 0.9rem;background:rgba(106,154,127,0.06);border:1px solid rgba(106,154,127,0.3);border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;">〔 陛 下 已 断 〕 '+_esc(issue.chosenText)+'</div>';
  }

  // 陛下决断·选项按钮
  if (Array.isArray(issue.choices) && issue.choices.length > 0 && isPending) {
    h += '<div style="margin-bottom:1.2rem;">';
    h += '<div style="font-size:0.78rem;color:var(--gold);letter-spacing:0.28em;margin-bottom:0.5rem;font-family:\'STKaiti\',\'KaiTi\',serif;text-align:center;">〔 陛 下 决 断 〕</div>';
    var safeIid = String(issue.id || '').replace(/'/g, "\\'");
    issue.choices.forEach(function(ch, idx) {
      h += '<button class="bt bsm" style="display:block;width:100%;text-align:left;margin-bottom:0.35rem;padding:0.55rem 0.85rem;background:rgba(201,168,76,0.05);border:1px solid var(--gold-d);color:var(--txt-l);cursor:pointer;line-height:1.5;white-space:normal;border-radius:3px;" onclick="if(typeof _chooseIssueOption===\'function\'){document.getElementById(\'shizheng-task-detail\').remove();document.getElementById(\'shizheng-tasks-overlay\')&&document.getElementById(\'shizheng-tasks-overlay\').remove();_chooseIssueOption(\''+safeIid+'\','+idx+');}">';
      h += '<div style="font-weight:600;font-size:0.85rem;margin-bottom:0.15rem;color:var(--gold-l);font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(ch.text||'选项'+(idx+1))+'</div>';
      if (ch.desc) h += '<div style="font-size:0.72rem;color:var(--txt-d);">'+_esc(ch.desc)+'</div>';
      h += '</button>';
    });
    h += '</div>';
  }

  // 解决时间（若已决）
  if (!isPending && issue.resolvedTurn) {
    var _resolveDateStr = issue.resolvedDate || (_tsT2 ? _tsT2(issue.resolvedTurn) : ('第'+issue.resolvedTurn+'回合'));
    h += '<div style="text-align:center;font-size:0.8rem;color:var(--celadon-400,#7eb8a7);letter-spacing:0.2em;margin-top:0.6rem;margin-bottom:0.3rem;">· 于 '+_esc(_resolveDateStr)+' 议决 ·</div>';
  }

  h += '</div>'; // /滚动正文

  // 底部操作栏
  if (isPending) {
    var safeId = String(issue.id || '').replace(/'/g, "\\'");
    h += '<div style="padding:0.8rem 1.3rem;display:flex;justify-content:center;gap:1.2rem;border-top:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,transparent,rgba(201,168,76,0.04));">';
    h += '<button onclick="_shizhengConvene(\''+safeId+'\')" style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold);color:var(--gold);padding:0.55rem 1.4rem;cursor:pointer;font-size:0.92rem;letter-spacing:0.28em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;transition:all 0.2s;" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.08))\';this.style.color=\'#f0d77a\';" onmouseout="this.style.background=\'linear-gradient(135deg,#3d2f1a,#2a2010)\';this.style.color=\'var(--gold)\';">御 前 召 对 群 臣</button>';
    h += '<button onclick="_shizhengSecret(\''+safeId+'\')" style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold);color:var(--gold);padding:0.55rem 1.4rem;cursor:pointer;font-size:0.92rem;letter-spacing:0.28em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;transition:all 0.2s;" onmouseover="this.style.background=\'linear-gradient(135deg,rgba(201,168,76,0.18),rgba(201,168,76,0.08))\';this.style.color=\'#f0d77a\';" onmouseout="this.style.background=\'linear-gradient(135deg,#3d2f1a,#2a2010)\';this.style.color=\'var(--gold)\';">独 召 密 问</button>';
    h += '</div>';
  }

  panel.innerHTML = h;
  det.appendChild(panel);
  document.body.appendChild(det);
}

function _shizhengConvene(issueId) {
  var GM = window.GM || {};
  var issue = (GM.currentIssues||[]).find(function(i){ return String(i.id) === String(issueId); });
  var det = document.getElementById('shizheng-task-detail'); if (det) det.remove();
  var ov = document.getElementById('shizheng-tasks-overlay'); if (ov) ov.remove();
  if (typeof openChaoyi === 'function') {
    openChaoyi();
    if (issue && issue.title) {
      // 延迟预填议题
      setTimeout(function(){
        try {
          var topicInp = document.getElementById('cy-topic-input');
          if (topicInp) {
            topicInp.value = issue.title + (issue.description ? '·' + String(issue.description).slice(0, 60) : '');
          }
          if (window.CY) window.CY.topic = issue.title + (issue.description ? '·' + String(issue.description).slice(0, 60) : '');
        } catch(_){}
      }, 120);
    }
  } else if (typeof toast === 'function') { toast('朝议系统加载中'); }
}

function _shizhengSecret(issueId) {
  // 关闭当前详情（保留 shizheng-tasks-overlay 以便返回）
  var det = document.getElementById('shizheng-task-detail'); if (det) det.remove();
  var ov = document.getElementById('shizheng-tasks-overlay'); if (ov) ov.remove();
  // 弹出"选议政大臣与核心议题"两栏面板·预选当前议题
  if (typeof openMiZhaoPicker === 'function') {
    openMiZhaoPicker(issueId);
  } else if (typeof toast === 'function') { toast('密召面板加载中'); }
}

window.openShizhengTasks = openShizhengTasks;
window.closeShizhengTasks = closeShizhengTasks;
window._openShizhengDetail = _openShizhengDetail;
window._shizhengConvene = _shizhengConvene;
window._shizhengSecret = _shizhengSecret;

// ===================================================================
// 独召密问·选人选议题两栏面板 + 问对式 AI 回答
// ===================================================================
function openMiZhaoPicker(prefilledIssueId) {
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s);};
  var GM = window.GM || {};
  var capital = GM._capital || '京师';

  // 可召对：与玩家同一所在地·在世·在任·无阻状态
  var playerLoc = (typeof _getPlayerLocation === 'function') ? _getPlayerLocation() : (GM._capital || '京师');
  var chars = (GM.chars||[]).filter(function(c){
    if (!c || c.isPlayer) return false;
    if (c.alive === false) return false;
    if (c.imprisoned || c.exiled || c.retired || c.mourning || c.fled || c.missing) return false;
    if (c._travelTo) return false; // 在赶路
    var loc = c.location || playerLoc;
    var sameLoc = (typeof _isSameLocation === 'function') ? _isSameLocation(loc, playerLoc) : (loc === playerLoc);
    if (!sameLoc) return false;
    return !!(c.officialTitle || c.title);
  }).sort(function(a,b){
    return (b.importance||0) + (b.loyalty||0)*0.15 - ((a.importance||0) + (a.loyalty||0)*0.15);
  });

  var _tsT = (typeof getTSText === 'function') ? getTSText : null;
  var issues = (GM.currentIssues||[]).filter(function(i){ return i.status !== 'resolved'; })
    .sort(function(a,b){ return (b.raisedTurn||0) - (a.raisedTurn||0); });

  var exist = document.getElementById('mizhao-picker'); if (exist) exist.remove();
  var overlay = document.createElement('div');
  overlay.id = 'mizhao-picker';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,5,0.88);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
  overlay.onclick = function(e){ if (e.target === overlay) overlay.remove(); };

  var panel = document.createElement('div');
  panel.style.cssText = 'width:min(94vw,960px);max-height:80vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#1e1610,#14100a);border:1px solid var(--gold-d);border-radius:6px;box-shadow:0 10px 48px rgba(0,0,0,0.75);overflow:hidden;';

  // 状态容器
  var state = { selectedChars: [], selectedIssue: prefilledIssueId || null };

  var h = '';
  h += '<div style="padding:0.8rem 1.3rem;display:flex;align-items:center;border-bottom:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,rgba(201,168,76,0.06),transparent);">';
  h += '<button onclick="document.getElementById(\'mizhao-picker\').remove()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);padding:0.3rem 0.85rem;cursor:pointer;font-size:0.82rem;border-radius:3px;letter-spacing:0.12em;font-family:\'STKaiti\',\'KaiTi\',serif;">‹ 返 回</button>';
  h += '<div style="flex:1;text-align:center;font-size:1.15rem;letter-spacing:0.5rem;color:var(--gold);font-family:\'STKaiti\',\'KaiTi\',serif;">选 择 议 政 大 臣 与 核 心 议 题</div>';
  h += '<div style="width:4rem;"></div>';
  h += '</div>';

  h += '<div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;padding:0.9rem 1rem;overflow:hidden;">';
  // 左：大臣
  h += '<div style="display:flex;flex-direction:column;border:1px solid rgba(201,168,76,0.25);border-radius:4px;overflow:hidden;">';
  h += '<div style="padding:0.45rem 0.8rem;font-size:0.78rem;color:var(--gold);letter-spacing:0.28em;border-bottom:1px solid rgba(201,168,76,0.2);background:rgba(201,168,76,0.04);font-family:\'STKaiti\',\'KaiTi\',serif;">请 选 择 大 臣</div>';
  h += '<div id="mz-chars" style="flex:1;overflow-y:auto;padding:0.5rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';
  if (chars.length === 0) {
    h += '<div style="text-align:center;padding:2rem;color:var(--txt-d);font-size:0.8rem;">京中无可召之臣</div>';
  } else {
    chars.forEach(function(c){
      var safeName = String(c.name).replace(/'/g, "\\'");
      h += '<div class="mz-char-card" data-name="'+_esc(c.name)+'" onclick="_mzToggleChar(this,\''+safeName+'\')" style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem 0.65rem;margin-bottom:0.35rem;background:rgba(40,30,18,0.6);border:1px solid rgba(201,168,76,0.2);border-radius:3px;cursor:pointer;transition:all 0.15s;">';
      var _avatar = (c.name||'?').charAt(0);
      h += '<div style="width:38px;height:38px;flex-shrink:0;border-radius:50%;background:linear-gradient(135deg,#5a4a2d,#3d2f1a);border:1px solid var(--gold-d);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:1.1rem;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(_avatar)+'</div>';
      h += '<div style="flex:1;min-width:0;">';
      h += '<div style="font-size:0.92rem;color:var(--gold-l);font-weight:600;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(c.name||'')+'</div>';
      h += '<div style="font-size:0.72rem;color:var(--txt-d);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+_esc((c.officialTitle||c.title||'')+(c.party?' · '+c.party:''))+'</div>';
      h += '</div>';
      h += '</div>';
    });
  }
  h += '</div></div>';

  // 右：议题
  h += '<div style="display:flex;flex-direction:column;border:1px solid rgba(201,168,76,0.25);border-radius:4px;overflow:hidden;">';
  h += '<div style="padding:0.45rem 0.8rem;font-size:0.78rem;color:var(--gold);letter-spacing:0.28em;border-bottom:1px solid rgba(201,168,76,0.2);background:rgba(201,168,76,0.04);font-family:\'STKaiti\',\'KaiTi\',serif;">请 选 择 一 个 议 题</div>';
  h += '<div id="mz-issues" style="flex:1;overflow-y:auto;padding:0.5rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';
  if (issues.length === 0) {
    h += '<div style="text-align:center;padding:2rem;color:var(--txt-d);font-size:0.8rem;">当前无待议要务</div>';
  } else {
    issues.forEach(function(iss){
      var safeIid = String(iss.id||'').replace(/'/g, "\\'");
      var dateStr = iss.raisedDate || (_tsT ? _tsT(iss.raisedTurn||1) : ('第'+(iss.raisedTurn||1)+'回合'));
      var preSel = String(iss.id) === String(prefilledIssueId);
      h += '<div class="mz-issue-card" data-id="'+_esc(safeIid)+'" onclick="_mzSelectIssue(this,\''+safeIid+'\')" style="padding:0.6rem 0.8rem;margin-bottom:0.4rem;background:'+(preSel?'linear-gradient(180deg,#f4e8cc,#e8dbb4)':'rgba(244,232,204,0.88)')+';border:'+(preSel?'2px solid #c9a85f':'1px solid #b89a73')+';border-radius:3px;cursor:pointer;transition:all 0.15s;">';
      h += '<div style="font-weight:700;font-size:0.92rem;color:#3d2f1a;margin-bottom:0.2rem;line-height:1.4;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(iss.title||'')+'</div>';
      h += '<div style="font-size:0.7rem;color:#8b7355;">'+_esc(dateStr)+'</div>';
      h += '</div>';
    });
  }
  h += '</div></div>';
  h += '</div>'; // /grid

  // 底部操作
  h += '<div style="padding:0.65rem 1.3rem;display:flex;justify-content:center;align-items:center;gap:1rem;border-top:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,transparent,rgba(201,168,76,0.04));">';
  h += '<span id="mz-hint" style="font-size:0.72rem;color:var(--txt-d);">· 未选 ·</span>';
  h += '<button id="mz-next" onclick="_mzProceed()" disabled style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold-d);color:var(--gold-d);padding:0.5rem 1.8rem;cursor:not-allowed;font-size:0.92rem;letter-spacing:0.3em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;opacity:0.6;">下 一 步</button>';
  h += '</div>';

  panel.innerHTML = h;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  window._mzState = state;
}

function _mzToggleChar(el, name) {
  var s = window._mzState; if (!s) return;
  var idx = s.selectedChars.indexOf(name);
  if (idx >= 0) {
    s.selectedChars.splice(idx, 1);
    el.style.background = 'rgba(40,30,18,0.6)';
    el.style.border = '1px solid rgba(201,168,76,0.2)';
  } else {
    // 不限人数·依序叠加
    s.selectedChars.push(name);
    el.style.background = 'linear-gradient(180deg,rgba(201,168,76,0.22),rgba(201,168,76,0.08))';
    el.style.border = '1px solid var(--gold)';
  }
  _mzUpdateHint();
}

function _mzSelectIssue(el, issueId) {
  var s = window._mzState; if (!s) return;
  // 清除旧选中
  document.querySelectorAll('.mz-issue-card').forEach(function(c){
    c.style.background = 'rgba(244,232,204,0.88)';
    c.style.border = '1px solid #b89a73';
  });
  s.selectedIssue = issueId;
  el.style.background = 'linear-gradient(180deg,#f4e8cc,#e8dbb4)';
  el.style.border = '2px solid #c9a85f';
  _mzUpdateHint();
}

function _mzUpdateHint() {
  var s = window._mzState; if (!s) return;
  var hint = document.getElementById('mz-hint');
  var btn = document.getElementById('mz-next');
  var ready = s.selectedChars.length >= 1 && s.selectedIssue;
  if (hint) hint.textContent = '· 已选 ' + s.selectedChars.length + ' 臣 · ' + (s.selectedIssue ? '1 题' : '0 题') + ' ·';
  if (btn) {
    btn.disabled = !ready;
    btn.style.cursor = ready ? 'pointer' : 'not-allowed';
    btn.style.opacity = ready ? '1' : '0.6';
    btn.style.color = ready ? 'var(--gold-l)' : 'var(--gold-d)';
    btn.style.borderColor = ready ? 'var(--gold)' : 'var(--gold-d)';
  }
}

function _mzProceed() {
  var s = window._mzState; if (!s) return;
  if (s.selectedChars.length < 1 || !s.selectedIssue) return;
  var overlay = document.getElementById('mizhao-picker'); if (overlay) overlay.remove();
  _openMiZhaoDialogue(s.selectedChars, s.selectedIssue);
}

// 独召问对·不限人数·依序流式·初始 2 轮·玩家发言后再追 2 轮
function _openMiZhaoDialogue(charNames, issueId) {
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s);};
  var GM = window.GM || {};
  var issue = (GM.currentIssues||[]).find(function(i){ return String(i.id) === String(issueId); });
  if (!issue) { if (typeof toast === 'function') toast('议题已失效'); return; }

  var chars = charNames.map(function(n){ return (GM.chars||[]).find(function(c){ return c.name === n; }); }).filter(Boolean);
  if (chars.length < 1) { if (typeof toast === 'function') toast('无可召之臣'); return; }

  var exist = document.getElementById('mizhao-dialog'); if (exist) exist.remove();
  var overlay = document.createElement('div');
  overlay.id = 'mizhao-dialog';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,10,5,0.88);z-index:10001;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';

  var panel = document.createElement('div');
  // 固定尺寸·聊天区内部滚动·面板不随消息数伸缩
  panel.style.cssText = 'width:min(94vw,920px);display:flex;flex-direction:column;background:linear-gradient(180deg,#1e1610,#14100a);border:1px solid var(--gold-d);border-radius:6px;box-shadow:0 10px 48px rgba(0,0,0,0.75);overflow:hidden;';

  var h = '';
  h += '<div style="padding:0.7rem 1.2rem;display:flex;align-items:center;border-bottom:1px solid rgba(201,168,76,0.2);background:linear-gradient(180deg,rgba(201,168,76,0.06),transparent);flex-shrink:0;">';
  h += '<button onclick="_mzEndDialogue()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);padding:0.3rem 0.8rem;cursor:pointer;font-size:0.82rem;border-radius:3px;letter-spacing:0.12em;font-family:\'STKaiti\',\'KaiTi\',serif;">‹ 退 朝</button>';
  h += '<div style="flex:1;text-align:center;font-size:1.05rem;letter-spacing:0.45rem;color:var(--gold);font-family:\'STKaiti\',\'KaiTi\',serif;">独 召 密 问 · '+_esc(issue.title||'')+'</div>';
  h += '<button onclick="_mzShowSummary()" title="建言要点：AI 归总每位大臣之主张，陛下可择一纳入诏书建议库" style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold-d);color:var(--gold);padding:0.3rem 0.8rem;cursor:pointer;font-size:0.78rem;border-radius:3px;letter-spacing:0.1em;font-family:\'STKaiti\',\'KaiTi\',serif;">建 言 要 点</button>';
  h += '</div>';

  h += '<div style="padding:0.6rem 1.2rem;background:rgba(201,168,76,0.025);border-bottom:1px solid rgba(201,168,76,0.15);font-size:0.8rem;color:var(--txt-s);line-height:1.7;font-family:\'STKaiti\',\'KaiTi\',serif;display:flex;gap:0.5rem;align-items:center;flex-shrink:0;">';
  h += '<span style="color:var(--gold);flex-shrink:0;">议题 · </span><span style="flex:1;">' + _esc(String(issue.description||'').slice(0, 200)) + (String(issue.description||'').length > 200 ? '…' : '') + '</span>';
  h += '</div>';

  // 浮动划选按钮（选文字后显示）·mousedown preventDefault 防止按钮点击清除选区
  h += '<div id="mz-selbtn" style="position:absolute;display:none;z-index:10;background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold);color:var(--gold);padding:0.3rem 0.7rem;cursor:pointer;font-size:0.78rem;letter-spacing:0.1em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;box-shadow:0 3px 10px rgba(0,0,0,0.55);user-select:none;" onmousedown="event.preventDefault();" onclick="_mzCaptureSelection()">划 入 诏 书</div>';

  h += '<div id="mz-dlg-body" style="height:420px;overflow-y:auto;overflow-x:hidden;padding:1rem 1.3rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;background:rgba(0,0,0,0.15);"></div>';

  // 追问输入
  h += '<div id="mz-input-bar" style="padding:0.7rem 1.2rem;border-top:1px solid rgba(201,168,76,0.2);display:flex;gap:0.6rem;background:linear-gradient(180deg,transparent,rgba(201,168,76,0.04));opacity:0.5;pointer-events:none;flex-shrink:0;">';
  h += '<input type="text" id="mz-dlg-input" placeholder="大臣奏对中…" disabled style="flex:1;background:rgba(40,30,18,0.6);border:1px solid var(--gold-d);color:var(--gold-l);padding:0.55rem 0.85rem;font-size:0.88rem;font-family:\'STKaiti\',\'KaiTi\',serif;border-radius:3px;outline:none;" onkeydown="if(event.key===\'Enter\')_mzSendQuery()">';
  h += '<button id="mz-send-btn" disabled onclick="_mzSendQuery()" style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold);color:var(--gold);padding:0.5rem 1.4rem;cursor:pointer;font-size:0.9rem;letter-spacing:0.3em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;">发 问</button>';
  h += '</div>';

  panel.style.position = 'relative';
  panel.innerHTML = h;
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  // 选文字监听·缓存文字·按钮相对 panel 定位
  var body = document.getElementById('mz-dlg-body');
  if (body) {
    body.addEventListener('mouseup', function(){
      setTimeout(function(){
        var sel = window.getSelection();
        var btn = document.getElementById('mz-selbtn');
        if (!btn) return;
        var txt = sel ? sel.toString().trim() : '';
        if (!txt) { btn.style.display = 'none'; window._mzSelCache = ''; return; }
        // 缓存文字·防止点击按钮后选区丢失
        window._mzSelCache = txt;
        try {
          var rng = sel.getRangeAt(0);
          var rect = rng.getBoundingClientRect();
          var pRect = panel.getBoundingClientRect();
          btn.style.display = 'block';
          btn.style.top = Math.max(4, (rect.top - pRect.top - 34)) + 'px';
          btn.style.left = Math.max(8, Math.min(pRect.width - 96, rect.left - pRect.left + rect.width/2 - 40)) + 'px';
        } catch(_){}
      }, 10);
    });
    // 点击非选中区域时隐藏按钮
    body.addEventListener('mousedown', function(e){
      if (e.target && e.target.id === 'mz-selbtn') return;
      var btn = document.getElementById('mz-selbtn');
      if (btn) btn.style.display = 'none';
    });
  }

  window._mzDlg = {
    chars: chars,
    issue: issue,
    history: [],              // [{role:'player'|charName, content:''}]
    perMinisterReplies: {},   // name -> [reply1, reply2, ...]
    slotIdx: 0,               // 当前发言槽号·每次发言后 +1
    maxSlot: 2 * chars.length,// 初始 2 轮 × N 臣
    extraRoundsPerQuery: 2,
    speaking: false
  };
  chars.forEach(function(c){ window._mzDlg.perMinisterReplies[c.name] = []; });

  _mzProcessQueue();
}

function _mzEndDialogue() {
  // 记忆归档 + 纪事档案 + 关闭
  try {
    var d = window._mzDlg;
    if (!d) { var el0=document.getElementById('mizhao-dialog'); if(el0)el0.remove(); return; }
    var GM = window.GM || {};
    var issueTitle = (d.issue && d.issue.title) || '议题';
    // 1. NPC 记忆
    if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
      d.chars.forEach(function(c){
        var lines = d.perMinisterReplies[c.name] || [];
        if (lines.length > 0) {
          var summary = lines.join('｜').slice(0, 120);
          NpcMemorySystem.remember(c.name, '御前独召·议「' + issueTitle + '」·臣奏曰：' + summary, '敬', 7, '天子', { type: 'dialogue', source: 'witnessed', credibility: 100 });
        }
      });
    }
    // 2. 纪事档案（每位大臣一条·供推演读取）
    if (!GM.jishiRecords) GM.jishiRecords = [];
    d.chars.forEach(function(c){
      var lines = d.perMinisterReplies[c.name] || [];
      if (lines.length === 0) return;
      GM.jishiRecords.push({
        turn: GM.turn || 1,
        char: c.name,
        playerSaid: '独召密问·议「' + issueTitle + '」',
        npcSaid: lines.join('\n'),
        mode: 'mizhao',
        issueId: (d.issue && d.issue.id) || '',
        issueTitle: issueTitle
      });
    });
    // 3. 起居注（简短记录召对事实）
    if (!GM.qijuHistory) GM.qijuHistory = [];
    var _tsT = (typeof getTSText === 'function') ? getTSText(GM.turn || 1) : '';
    GM.qijuHistory.unshift({
      turn: GM.turn || 1,
      date: _tsT,
      category: '问对',
      content: '独召密问·议「' + issueTitle + '」·召见' + d.chars.map(function(c){return c.name;}).join('、')
    });
    if (typeof addEB === 'function') addEB('问对', '独召密问·议' + issueTitle + '·' + d.chars.length + '臣奏对毕');
  } catch(_){}
  var el = document.getElementById('mizhao-dialog'); if (el) el.remove();
  window._mzDlg = null;
}

function _mzProcessQueue() {
  var d = window._mzDlg; if (!d) return;
  if (d.speaking) return;
  if (d.slotIdx >= d.maxSlot) {
    // 轮次用尽·等玩家输入或退朝
    _mzEnableInput(true);
    _mzAddSystemLine('· 群臣已进言·陛下若欲再问·请续发之；不复发问则此番独召终止 ·');
    return;
  }
  _mzEnableInput(false);
  d.speaking = true;
  var slotIdx = d.slotIdx;
  var charIdx = slotIdx % d.chars.length;
  var ch = d.chars[charIdx];
  var roundNum = Math.floor(slotIdx / d.chars.length) + 1;
  d.slotIdx += 1;

  var body = document.getElementById('mz-dlg-body');
  if (!body) { d.speaking = false; return; }
  var blockId = 'mz-reply-' + slotIdx;
  body.insertAdjacentHTML('beforeend', _mzRenderMinisterBlock(ch, blockId, roundNum));
  body.scrollTop = body.scrollHeight;

  _mzSpeakMinister(ch, blockId, roundNum).then(function(){
    d.speaking = false;
    setTimeout(_mzProcessQueue, 180);
  }).catch(function(){
    d.speaking = false;
    setTimeout(_mzProcessQueue, 180);
  });
}

function _mzEnableInput(enable) {
  var inp = document.getElementById('mz-dlg-input');
  var btn = document.getElementById('mz-send-btn');
  var bar = document.getElementById('mz-input-bar');
  if (inp) { inp.disabled = !enable; inp.placeholder = enable ? '陛下垂问…（Enter 发送）' : '大臣奏对中…'; }
  if (btn) btn.disabled = !enable;
  if (bar) { bar.style.opacity = enable ? '1' : '0.5'; bar.style.pointerEvents = enable ? 'auto' : 'none'; }
  if (enable && inp) inp.focus();
}

function _mzAddSystemLine(text) {
  var body = document.getElementById('mz-dlg-body'); if (!body) return;
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s);};
  body.insertAdjacentHTML('beforeend', '<div style="text-align:center;margin:0.8rem 0;font-size:0.74rem;color:var(--txt-d);font-style:italic;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(text)+'</div>');
  body.scrollTop = body.scrollHeight;
}

function _mzRenderMinisterBlock(c, blockId, roundNum) {
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s==null?'':s);};
  var avatar = (c.name||'?').charAt(0);
  return '<div style="margin-bottom:0.9rem;display:flex;gap:0.7rem;align-items:flex-start;">'
    + '<div style="width:42px;height:42px;flex-shrink:0;border-radius:50%;background:linear-gradient(135deg,#5a4a2d,#3d2f1a);border:1px solid var(--gold-d);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:1.15rem;font-family:\'STKaiti\',\'KaiTi\',serif;">'+_esc(avatar)+'</div>'
    + '<div style="flex:1;min-width:0;">'
      + '<div style="font-size:0.86rem;color:var(--gold-l);font-family:\'STKaiti\',\'KaiTi\',serif;margin-bottom:0.2rem;"><b>'+_esc(c.name||'')+'</b> <span style="color:var(--txt-d);font-size:0.7rem;">· '+_esc(c.officialTitle||c.title||'')+' · 第'+roundNum+'言</span></div>'
      + '<div id="'+blockId+'" style="background:rgba(40,30,18,0.45);border:1px solid rgba(201,168,76,0.2);border-left:3px solid var(--gold-d);padding:0.55rem 0.85rem;font-size:0.86rem;color:var(--txt-l);line-height:1.85;font-family:\'STKaiti\',\'KaiTi\',serif;border-radius:3px;min-height:1.5em;user-select:text;"><span style="color:var(--txt-d);font-style:italic;">· 沉吟中 ·</span></div>'
    + '</div>'
  + '</div>';
}

function _mzSpeakMinister(ch, blockId, roundNum) {
  var d = window._mzDlg; if (!d) return Promise.reject();
  var P = window.P || {};
  var GM = window.GM || {};
  var target = document.getElementById(blockId);

  var brief = (typeof getCharacterPersonalityBrief === 'function') ? getCharacterPersonalityBrief(ch) : ch.name;
  var memCtx = (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.getMemoryContext) ? NpcMemorySystem.getMemoryContext(ch.name) : '';

  // ── 与问对(wendui)一致的基础身份/性格/立场/记忆构建 ──
  var sysP = '你是' + ch.name + '·' + (ch.officialTitle||ch.title||'') + '·当前在京师御前独对。\n性格：' + brief;
  if (ch.stance) sysP += '\n政治立场：' + ch.stance;
  if (ch.party) sysP += '\n党派：' + ch.party + (ch.partyRank?'·'+ch.partyRank:'');
  if (ch.loyalty != null) sysP += '\n对君忠诚：' + ch.loyalty;
  if (memCtx) sysP += '\n近期心绪：' + memCtx;
  if (typeof _buildTemporalConstraint === 'function') { try { sysP += _buildTemporalConstraint(ch); } catch(_){} }

  // 议题完整上下文
  sysP += '\n\n【议题】' + (d.issue.title||'') + '\n' + String(d.issue.description||'').slice(0, 400);
  if (d.issue.narrative) sysP += '\n' + String(d.issue.narrative).slice(0, 400);
  if (d.issue.longTermConsequences && typeof d.issue.longTermConsequences === 'object') {
    sysP += '\n\n【风势推演参考】';
    Object.keys(d.issue.longTermConsequences).forEach(function(k){ sysP += '\n' + k + '：' + d.issue.longTermConsequences[k]; });
  }

  // ── 独召特色：大臣间对话历史 ──
  var histText = '';
  if (d.history.length > 0) {
    histText = '\n\n【已往对答·可附和可驳斥可补充】\n' + d.history.slice(-10).map(function(m){
      return (m.role === 'player' ? '陛下' : m.role) + '曰：' + m.content;
    }).join('\n');
  }

  var selfReplies = d.perMinisterReplies[ch.name] || [];
  var selfHint = '';
  if (selfReplies.length > 0) {
    selfHint = '\n\n你之前已进言 ' + selfReplies.length + ' 次·今番须接续或深化前论·不得重复';
  }
  sysP += histText + selfHint;

  // ── 字数提示（复用问对字数设置 wdMin/wdMax）──
  var wdHint = (typeof _aiDialogueWordHint === 'function') ? _aiDialogueWordHint('wd') : '（每条发言约 120-250 字）';

  // ── JSON 返回规范（与问对一致）──
  sysP += '\n\n【奏对要求】';
  sysP += '\n1. 以尔角色口吻·臣/末将/罪臣等称谓得当';
  sysP += '\n2. 古典白话' + wdHint;
  sysP += '\n3. 针对议题具体表态·切忌套话';
  sysP += '\n4. 可进言陈策·可委婉劝阻·必须明立场';
  sysP += '\n5. 若他臣已有奏对·可附和·可反驳·可补充';
  sysP += '\n\n【返回 JSON 格式】';
  sysP += '\n{';
  sysP += '\n  "reply": "奏对正文·古典白话",';
  sysP += '\n  "loyaltyDelta": -3~+3 的整数·无明显变化填 0,';
  sysP += '\n  "emotionState": "镇定/恭敬/紧张/焦虑/激动/愤怒 任选一",';
  sysP += '\n  "toneEffect": "一句话描述此番奏对之态·如 \'恭敬中略含忧色\' (可留空)",';
  sysP += '\n  "suggestions": [{"topic":"议题要点","content":"具体施政建言·50-80字·可入诏书建议库"}],';
  sysP += '\n  "memoryImpact": {"event":"从大臣视角简述此次被召见·30字内","emotion":"敬/忧/惧/怒/喜/恨/平","importance":1-10}';
  sysP += '\n}';
  sysP += '\n只返回 JSON·无前言无解释·reply 字段务必填写。';

  // 首次 chunk 到达前保留"沉吟中"占位
  var firstChunkReceived = false;
  var _extractReply = function(raw) {
    if (!raw) return '';
    var parsed = (typeof extractJSON === 'function') ? extractJSON(raw) : null;
    if (parsed && parsed.reply) return { reply: String(parsed.reply).trim(), parsed: parsed };
    return { reply: String(raw).trim(), parsed: null };
  };
  var _finish = function(rawTxt) {
    var res = _extractReply(rawTxt);
    var finalTxt = res.reply || ('臣' + ch.name + '叩首·请容臣三思。');
    var parsed = res.parsed;
    // 对话模式 validator 接入（非阻断）——检查 reply 必填+字段漂移
    if (parsed && window.TM && TM.validateAIOutput) {
      try { TM.validateAIOutput(parsed, 'mz-dialogue-' + (ch.name||'?'), 'dialogue'); } catch(_vme){}
    }
    if (target) target.textContent = finalTxt;
    d.history.push({ role: ch.name, content: finalTxt });
    if (!d.perMinisterReplies[ch.name]) d.perMinisterReplies[ch.name] = [];
    d.perMinisterReplies[ch.name].push(finalTxt);

    // 处理忠诚/情绪/建议/记忆（与问对一致）
    try {
      if (parsed) {
        // 忠诚微调
        var loyD = parseInt(parsed.loyaltyDelta, 10); if (!isNaN(loyD) && loyD !== 0) {
          var clamp = function(v,l,h){return Math.max(l, Math.min(h, v));};
          ch.loyalty = clamp((ch.loyalty || 50) + clamp(loyD, -3, 3), 0, 100);
          if (typeof OpinionSystem !== 'undefined' && OpinionSystem.addEventOpinion) {
            try { OpinionSystem.addEventOpinion(ch.name, '玩家', loyD * 3, '独召·' + (loyD>0?'受信任':'被冷落')); } catch(_){}
          }
        }
        // 建议入诏书建议库
        if (Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0) {
          if (!GM._edictSuggestions) GM._edictSuggestions = [];
          parsed.suggestions.forEach(function(sg){
            if (!sg) return;
            if (typeof sg === 'string') {
              GM._edictSuggestions.push({ source: '独召', from: ch.name, content: sg, turn: GM.turn||1, used: false });
            } else if (sg.content) {
              GM._edictSuggestions.push({ source: '独召', from: ch.name, topic: sg.topic||(d.issue.title||''), content: sg.content, turn: GM.turn||1, used: false });
            }
          });
          try { if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions(); } catch(_){}
        }
        // NPC 记忆（AI 返回优先）
        if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.remember) {
          var pm = parsed.memoryImpact || {};
          var evt = pm.event || ('御前独召·议「'+(d.issue.title||'')+'」·'+finalTxt.slice(0,25));
          var emo = pm.emotion || (loyD>0?'敬':loyD<0?'忧':'平');
          var imp = Math.max(1, Math.min(10, parseFloat(pm.importance) || 6));
          NpcMemorySystem.remember(ch.name, evt, emo, imp, '天子', { type:'dialogue', source:'witnessed', credibility:100 });
        }
      }
    } catch(_finishE){ console.warn('[独召] finish 处理异常', _finishE); }
  };

  // ── max_tokens 与 tier 策略（与问对/朝议一致·次 API 配置则走次 API·否则主 API）──
  var maxTok = (typeof _aiDialogueTok === 'function') ? _aiDialogueTok('wd', 1) : 800;
  var _tier = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined;
  var apiOpts = { tier: _tier };
  apiOpts.onChunk = function(txt) {
    if (!txt) return;
    if (!firstChunkReceived) {
      firstChunkReceived = true;
      if (target) target.textContent = '';
    }
    // 尝试流式提取 reply 字段显示（避免玩家看到裸 JSON）
    var disp = txt;
    try {
      var m = txt.match(/"reply"\s*:\s*"([^"]*)/);
      if (m && m[1]) disp = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } catch(_){}
    if (target) target.textContent = disp;
    var body = document.getElementById('mz-dlg-body'); if (body) body.scrollTop = body.scrollHeight;
  };

  if (typeof callAIMessagesStream === 'function' && P.ai && P.ai.key) {
    return callAIMessagesStream([{role:'user', content: sysP}], maxTok, apiOpts).then(function(finalTxt){
      _finish(finalTxt);
    }).catch(function(err){
      console.warn('[独召] stream 失败·回退 callAI', err);
      if (typeof callAI === 'function') {
        return callAI(sysP, maxTok, null, _tier).then(function(reply){ _finish(reply); }).catch(function(){
          if (target) target.textContent = '臣' + ch.name + '叩首·API 异常·请容臣三思后奏。';
        });
      } else {
        if (target) target.textContent = '臣' + ch.name + '叩首·请容臣三思后奏。';
      }
    });
  } else if (typeof callAI === 'function' && P.ai && P.ai.key) {
    return callAI(sysP, maxTok, null, _tier).then(function(reply){ _finish(reply); }).catch(function(){
      if (target) target.textContent = '臣' + ch.name + '叩首·请容臣三思后奏。';
    });
  } else {
    if (target) target.textContent = '臣' + ch.name + '叩首·API 未配置·容臣书面具奏。';
    return Promise.resolve();
  }
}

function _mzSendQuery() {
  var d = window._mzDlg; if (!d) return;
  if (d.speaking) return;
  var inp = document.getElementById('mz-dlg-input');
  if (!inp || !inp.value.trim()) return;
  var q = inp.value.trim();
  inp.value = '';
  var body = document.getElementById('mz-dlg-body');
  if (body) {
    var esc = (typeof escHtml==='function')?escHtml:function(s){return String(s);};
    body.insertAdjacentHTML('beforeend', '<div style="margin:0.6rem 0 1rem;text-align:right;"><span style="display:inline-block;background:rgba(201,168,76,0.1);border:1px solid var(--gold-d);color:var(--gold-l);padding:0.5rem 0.9rem;border-radius:3px;font-size:0.86rem;font-family:\'STKaiti\',\'KaiTi\',serif;max-width:75%;line-height:1.8;user-select:text;">陛下曰：' + esc(q) + '</span></div>');
    body.scrollTop = body.scrollHeight;
  }
  d.history.push({ role: 'player', content: q });
  // 续追 extraRoundsPerQuery 轮 × N 臣
  d.maxSlot += d.extraRoundsPerQuery * d.chars.length;
  _mzProcessQueue();
}

// 建言要点·AI 归总每人主张→陛下择一纳入诏书建议库
function _mzShowSummary() {
  var d = window._mzDlg; if (!d) return;
  if (d.speaking) { if (typeof toast === 'function') toast('大臣奏对中·稍候'); return; }
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s);};

  var exist = document.getElementById('mz-summary-panel'); if (exist) exist.remove();
  var layer = document.createElement('div');
  layer.id = 'mz-summary-panel';
  layer.style.cssText = 'position:fixed;inset:0;background:rgba(10,8,4,0.85);z-index:10010;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
  layer.onclick = function(e){ if (e.target === layer) layer.remove(); };

  var p = document.createElement('div');
  p.style.cssText = 'width:min(90vw,720px);max-height:80vh;display:flex;flex-direction:column;background:linear-gradient(180deg,#1e1610,#14100a);border:1px solid var(--gold-d);border-radius:6px;box-shadow:0 10px 48px rgba(0,0,0,0.75);overflow:hidden;';

  var h = '<div style="padding:0.75rem 1.2rem;display:flex;align-items:center;border-bottom:1px solid rgba(201,168,76,0.2);background:rgba(201,168,76,0.04);">';
  h += '<div style="flex:1;text-align:center;font-size:1.05rem;letter-spacing:0.4rem;color:var(--gold);font-family:\'STKaiti\',\'KaiTi\',serif;">建 言 要 点</div>';
  h += '<button onclick="document.getElementById(\'mz-summary-panel\').remove()" style="background:transparent;border:1px solid var(--gold-d);color:var(--gold);width:1.8rem;height:1.8rem;cursor:pointer;border-radius:3px;">✕</button>';
  h += '</div>';
  h += '<div id="mz-summary-body" style="flex:1;overflow-y:auto;padding:1rem 1.3rem;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.4) transparent;">';
  h += '<div style="text-align:center;color:var(--txt-d);font-size:0.85rem;padding:2rem;font-style:italic;font-family:\'STKaiti\',\'KaiTi\',serif;">· 史官归纳中 ·</div>';
  h += '</div>';
  p.innerHTML = h;
  layer.appendChild(p);
  document.body.appendChild(layer);

  // 并发为每位大臣调 AI 归纳要点
  var body = document.getElementById('mz-summary-body');
  body.innerHTML = '';
  var tasks = d.chars.map(function(c){
    var replies = d.perMinisterReplies[c.name] || [];
    if (replies.length === 0) return null;
    var containerId = 'mz-sum-' + c.name.replace(/[^a-zA-Z0-9]/g,'_');
    body.insertAdjacentHTML('beforeend', _mzRenderSummaryBlock(c, containerId, replies.length));
    return { ch: c, replies: replies, containerId: containerId };
  }).filter(Boolean);

  tasks.forEach(function(t){
    _mzSummarizeOne(t.ch, t.replies, t.containerId, d.issue);
  });
}

function _mzRenderSummaryBlock(c, containerId, replyCount) {
  var _esc = (typeof escHtml === 'function') ? escHtml : function(s){return String(s);};
  return '<div style="margin-bottom:1rem;padding:0.8rem 1rem;background:rgba(40,30,18,0.4);border:1px solid rgba(201,168,76,0.25);border-left:3px solid var(--gold-d);border-radius:3px;">'
    + '<div style="font-size:0.88rem;color:var(--gold-l);margin-bottom:0.35rem;font-family:\'STKaiti\',\'KaiTi\',serif;"><b>' + _esc(c.name||'') + '</b> <span style="color:var(--txt-d);font-size:0.7rem;">· ' + _esc(c.officialTitle||c.title||'') + ' · 奏对 ' + replyCount + ' 次</span></div>'
    + '<div id="' + containerId + '" style="font-size:0.83rem;line-height:1.85;color:var(--txt-s);font-family:\'STKaiti\',\'KaiTi\',serif;min-height:1.5em;"><span style="color:var(--txt-d);font-style:italic;">· 归纳中 ·</span></div>'
    + '<div id="' + containerId + '-act" style="margin-top:0.5rem;text-align:right;display:none;">'
      + '<button onclick="_mzPickToEdict(\'' + containerId + '\',\'' + _esc(c.name).replace(/\'/g,"\\\'") + '\')" style="background:linear-gradient(135deg,#3d2f1a,#2a2010);border:1px solid var(--gold);color:var(--gold);padding:0.3rem 0.9rem;cursor:pointer;font-size:0.78rem;letter-spacing:0.15em;border-radius:3px;font-family:\'STKaiti\',\'KaiTi\',serif;">纳 入 诏 书 建 议 库</button>'
    + '</div>'
  + '</div>';
}

function _mzSummarizeOne(ch, replies, containerId, issue) {
  var P = window.P || {};
  var target = document.getElementById(containerId);
  var actBar = document.getElementById(containerId + '-act');
  var joined = replies.join('\n');

  var prompt = '以下为 ' + ch.name + '(' + (ch.officialTitle||ch.title||'') + ') 在御前独召时就「' + (issue.title||'议题') + '」所进之奏对：\n\n' + joined;
  prompt += '\n\n【任务】请以一段 60-120 字的古典白话·精要归纳其立场·核心主张·建议策略。';
  prompt += '\n不用"臣"字·改为第三人称描述(如"该臣主张…")。直接输出归纳正文·无前言。';

  if (typeof callAI === 'function' && P.ai && P.ai.key) {
    var _sumTier = (typeof _useSecondaryTier === 'function' && _useSecondaryTier()) ? 'secondary' : undefined;
    callAI(prompt, 400, null, _sumTier).then(function(reply){
      var txt = (reply || '').trim() || (ch.name + '主张：' + replies[0].slice(0, 60));
      if (target) target.textContent = txt;
      if (actBar) actBar.style.display = 'block';
      target.dataset.summary = txt;
    }).catch(function(){
      if (target) target.textContent = ch.name + ' 主张（归纳失败，取首言）：' + (replies[0]||'').slice(0, 60);
      if (actBar) actBar.style.display = 'block';
      target.dataset.summary = (replies[0]||'').slice(0, 60);
    });
  } else {
    var fb = ch.name + ' 主张（取首言）：' + (replies[0]||'').slice(0, 80);
    if (target) target.textContent = fb;
    if (actBar) actBar.style.display = 'block';
    target.dataset.summary = fb;
  }
}

function _mzPickToEdict(containerId, charName) {
  var target = document.getElementById(containerId); if (!target) return;
  var d = window._mzDlg;
  var summary = target.dataset.summary || target.textContent || '';
  var issueTitle = (d && d.issue && d.issue.title) || '议题';
  if (typeof GM === 'undefined' || !GM) return;
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  GM._edictSuggestions.push({
    source: '独召·建言要点',
    from: charName,
    topic: issueTitle,
    content: summary,
    turn: GM.turn || 1,
    used: false
  });
  if (typeof toast === 'function') toast('「' + charName + '」之见已纳入诏书建议库');
  // 视觉反馈
  var actBar = document.getElementById(containerId + '-act');
  if (actBar) actBar.innerHTML = '<span style="color:var(--celadon-400,#7eb8a7);font-size:0.78rem;letter-spacing:0.15em;">· 已 纳 入 诏 书 建 议 库 ·</span>';
}

function _mzCaptureSelection() {
  // 优先读当前选区，回退到 mouseup 时缓存的文字（点击按钮后选区可能已清）
  var sel = window.getSelection();
  var txt = sel && sel.toString() ? sel.toString().trim() : '';
  if (!txt) txt = window._mzSelCache || '';
  if (!txt) {
    if (typeof toast === 'function') toast('请先划选一段大臣发言');
    return;
  }
  var d = window._mzDlg;
  var issueTitle = (d && d.issue && d.issue.title) || '议题';
  var GM = window.GM; if (!GM) return;
  if (!GM._edictSuggestions) GM._edictSuggestions = [];
  // 尝试识别发言者（从选区最近的 bubble 的姓名标签）
  var fromName = '';
  try {
    var anc = sel && sel.anchorNode;
    while (anc && anc.nodeType !== 1) anc = anc.parentNode;
    while (anc) {
      if (anc.previousSibling && anc.previousSibling.textContent && /^[\u4e00-\u9fa5]+/.test(anc.previousSibling.textContent)) break;
      anc = anc.parentNode;
    }
    // 回溯到气泡外层的姓名 <b> 标签
    var parent = sel && sel.anchorNode ? sel.anchorNode.parentNode : null;
    while (parent) {
      var bold = parent.querySelector && parent.querySelector('b');
      if (bold && bold.textContent && bold.textContent.length < 10) { fromName = bold.textContent.trim(); break; }
      parent = parent.parentNode;
      if (parent === document.body) break;
    }
  } catch(_){}
  GM._edictSuggestions.push({
    source: '独召·划选',
    from: fromName || '独召群臣',
    topic: issueTitle,
    content: txt.slice(0, 800),
    turn: GM.turn || 1,
    used: false
  });
  if (typeof toast === 'function') toast('划选之语 (' + txt.length + ' 字) 已纳入诏书建议库');
  try { if (typeof _renderEdictSuggestions === 'function') _renderEdictSuggestions(); } catch(_){}
  // 清除选择 + 隐藏浮按钮 + 清缓存
  try { if (sel && sel.removeAllRanges) sel.removeAllRanges(); } catch(_){}
  window._mzSelCache = '';
  var btn = document.getElementById('mz-selbtn'); if (btn) btn.style.display = 'none';
}

window.openMiZhaoPicker = openMiZhaoPicker;
window._mzToggleChar = _mzToggleChar;
window._mzSelectIssue = _mzSelectIssue;
window._mzUpdateHint = _mzUpdateHint;
window._mzProceed = _mzProceed;
window._mzSendQuery = _mzSendQuery;
window._mzEndDialogue = _mzEndDialogue;
window._mzShowSummary = _mzShowSummary;
window._mzPickToEdict = _mzPickToEdict;
window._mzCaptureSelection = _mzCaptureSelection;
