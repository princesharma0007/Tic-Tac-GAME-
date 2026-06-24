var WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
var board,turn,over,mode,diff;
var scores={X:0,O:0,D:0};
var settings={anim:true,thought:true,variety:true,first:'X'};
var firstPlayer='X',roundCount=0;
var inputLocked=false;
var roundToken=0;
var countdownTimer=null;
var playerHistory={firstMoves:[],preferredCells:{},roundMoves:[]};
var moveMemory={};

function boardKey(b){return b.join('');}
function recordMove(key,idx){if(!moveMemory[key])moveMemory[key]={};moveMemory[key][idx]=(moveMemory[key][idx]||0)+1;}
function pickLeastUsed(key,candidates){
  if(candidates.length===1)return candidates[0];
  var used=moveMemory[key]||{};
  var counts=candidates.map(function(i){return{idx:i,c:used[i]||0};});
  var minC=Math.min.apply(null,counts.map(function(o){return o.c;}));
  var fresh=counts.filter(function(o){return o.c===minC;}).map(function(o){return o.idx;});
  return fresh[Math.floor(Math.random()*fresh.length)];
}
function goTo(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});document.getElementById(id).classList.add('active');}
function toggleSetting(k){settings[k]=!settings[k];document.getElementById('tog-'+k).classList.toggle('on',settings[k]);}
function setBoardLocked(v){inputLocked=v;var b=document.getElementById('board');if(!b)return;if(v)b.classList.add('locked');else b.classList.remove('locked');}

function startGame(m,d){
  mode=m;diff=d||'easy';
  scores={X:0,O:0,D:0};
  ['x','o','d'].forEach(function(k){document.getElementById('sc-'+k).textContent=0;});
  roundCount=0;
  playerHistory={firstMoves:[],preferredCells:{},roundMoves:[]};
  if(mode==='ai'){
    document.getElementById('lbl-x').textContent='You';
    document.getElementById('lbl-o').textContent='AI';
    document.getElementById('leg-x').textContent='Your win %';
    document.getElementById('leg-o').textContent='AI win %';
    var ind=document.getElementById('diff-ind');
    ind.style.display='inline-block';
    var labels={easy:'🌿 Easy',medium:'🔥 Medium',hard:'👿 Hard'};
    var cls={easy:'di-easy',medium:'di-medium',hard:'di-hard'};
    ind.textContent=labels[diff]; ind.className='diff-ind '+cls[diff];
    document.getElementById('memo-note').textContent=diff==='hard'?'AI remembers '+Object.keys(moveMemory).length+' positions':'';
  } else {
    document.getElementById('lbl-x').textContent='Player X';
    document.getElementById('lbl-o').textContent='Player O';
    document.getElementById('leg-x').textContent='X win %';
    document.getElementById('leg-o').textContent='O win %';
    document.getElementById('diff-ind').style.display='none';
    document.getElementById('memo-note').textContent='';
  }
  firstPlayer=getFirstPlayer();
  initBoard(); goTo('game');
}
function getFirstPlayer(){var f=document.getElementById('first-sel').value;if(f==='alt')return roundCount%2===0?'X':'O';return f;}

function initBoard(){
  roundToken++;
  var myToken=roundToken;
  board=['','','','','','','','',''];
  over=false; turn=firstPlayer;
  playerHistory.roundMoves=[];
  setBoardLocked(mode==='ai'&&turn==='O');
  renderBoard(); triggerBoardAnim();
  setThought(''); setStatus(mode==='ai'&&turn==='X'?'Your turn':turn+"'s turn");
  highlight(turn); resetBars();
  if(mode==='ai'&&turn==='O'){setStatus('AI thinking…');setTimeout(function(){if(myToken!==roundToken)return;aiMove(myToken);},700);}
}
function triggerBoardAnim(){var b=document.getElementById('board');if(!b)return;b.classList.remove('refresh');void b.offsetWidth;b.classList.add('refresh');}
function newRound(){if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}removeOverlay();roundCount++;firstPlayer=getFirstPlayer();initBoard();}
function goHome(){if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}removeOverlay();goTo('home');}

function renderBoard(){
  var b=document.getElementById('board');b.innerHTML='';
  if(inputLocked)b.classList.add('locked');else b.classList.remove('locked');
  for(var i=0;i<9;i++){
    (function(idx){
      var c=document.createElement('div');
      c.className='cell'+(board[idx]?' taken':'')+(board[idx]==='X'?' cx':board[idx]==='O'?' co':'');
      if(board[idx]){var sp=document.createElement('span');sp.textContent=board[idx];if(settings.anim)sp.className='pop';c.appendChild(sp);}
      c.onclick=function(){clickCell(idx);};
      b.appendChild(c);
    })(i);
  }
}

function clickCell(i){
  if(over||board[i]||inputLocked)return;
  var myToken=roundToken;
  playerHistory.preferredCells[i]=(playerHistory.preferredCells[i]||0)+1;
  playerHistory.roundMoves.push(i);
  if(playerHistory.roundMoves.length===1)playerHistory.firstMoves.push(i);
  board[i]=turn; renderBoard(); updateBars();
  var w=getWin();if(w){endGame(w,myToken);return;}
  if(isDraw()){endDraw(myToken);return;}
  turn=turn==='X'?'O':'X';
  if(mode==='ai'&&turn==='O'){
    setBoardLocked(true); setStatus('AI thinking…');
    var delay=diff==='easy'?300:diff==='medium'?480:550;
    setTimeout(function(){if(myToken!==roundToken)return;aiMove(myToken);},delay);
  } else {
    setBoardLocked(false);
    setStatus(mode==='ai'?'Your turn':turn+"'s turn");
    highlight(turn);
  }
}

/* ══════════ RESULT OVERLAY + COUNTDOWN ══════════ */
function showResultOverlay(type, title, sub, emoji, myToken){
  removeOverlay();
  var ov=document.createElement('div');
  ov.className='result-overlay'; ov.id='result-overlay';

  var card=document.createElement('div');
  card.className='result-card '+(type==='win'?'win-card':type==='lose'?'lose-card':'draw-card');

  // Confetti for win
  if(type==='win'){
    var colors=['#34d399','#60a5fa','#a78bfa','#fbbf24','#f472b6'];
    for(var p=0;p<14;p++){
      var cp=document.createElement('div');
      cp.className='confetti-piece';
      cp.style.cssText='left:'+(15+Math.random()*70)+'%;top:'+(Math.random()*30)+'%;background:'+colors[p%colors.length]+';transform:rotate('+(Math.random()*360)+'deg);animation-delay:'+(Math.random()*.5)+'s;animation-duration:'+(0.9+Math.random()*.6)+'s';
      card.appendChild(cp);
    }
    var sb=document.createElement('div');sb.className='star-burst';card.appendChild(sb);
  }

  var emEl=document.createElement('span');emEl.className='result-emoji';emEl.textContent=emoji;
  var ttEl=document.createElement('div');ttEl.className='result-title';
  ttEl.style.color=type==='win'?'#34d399':type==='lose'?'#f472b6':'#fbbf24';
  ttEl.textContent=title;
  var sbEl=document.createElement('div');sbEl.className='result-sub';sbEl.textContent=sub;

  var cw=document.createElement('div');cw.className='countdown-wrap';
  var cl=document.createElement('div');cl.className='countdown-label';cl.textContent='Next round in';
  var cn=document.createElement('div');cn.className='countdown-num';cn.id='cnt-num';cn.textContent='3';
  var cbt=document.createElement('div');cbt.className='countdown-bar-track';
  var cb=document.createElement('div');cb.className='countdown-bar';cb.id='cnt-bar';
  cb.style.cssText='width:100%;background:'+(type==='win'?'#34d399':type==='lose'?'#f472b6':'#fbbf24');
  cbt.appendChild(cb); cw.appendChild(cl);cw.appendChild(cn);cw.appendChild(cbt);

  var skip=document.createElement('button');skip.className='skip-btn';skip.textContent='Skip →';
  skip.onclick=function(){if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}removeOverlay();roundCount++;firstPlayer=getFirstPlayer();initBoard();};

  card.appendChild(emEl);card.appendChild(ttEl);card.appendChild(sbEl);card.appendChild(cw);card.appendChild(skip);
  ov.appendChild(card);
  document.body.appendChild(ov);

  // Countdown 3 → 2 → 1 → go
  var count=3;
  function tick(){
    var numEl=document.getElementById('cnt-num');
    var barEl=document.getElementById('cnt-bar');
    if(!numEl||!barEl){clearInterval(countdownTimer);countdownTimer=null;return;}
    count--;
    if(count<=0){
      clearInterval(countdownTimer);countdownTimer=null;
      removeOverlay();
      if(myToken!==roundToken)return; // user already started a new round manually
      roundCount++;firstPlayer=getFirstPlayer();initBoard();
      return;
    }
    numEl.textContent=count;
    // Re-trigger animation
    numEl.classList.remove('tick');void numEl.offsetWidth;numEl.classList.add('tick');
    barEl.style.transition='none';barEl.style.width='100%';
    void barEl.offsetWidth;
    barEl.style.transition='width 1s linear';
    barEl.style.width='0%';
  }
  // Start bar draining for first second
  setTimeout(function(){
    var b2=document.getElementById('cnt-bar');
    if(b2){b2.style.transition='width 1s linear';b2.style.width='0%';}
    document.getElementById('cnt-num').classList.add('tick');
  },50);
  countdownTimer=setInterval(tick,1000);
}

function removeOverlay(){
  var ov=document.getElementById('result-overlay');
  if(!ov)return;
  ov.classList.add('hiding');
  setTimeout(function(){if(ov.parentNode)ov.parentNode.removeChild(ov);},300);
}

/* ══════════ WIN / LOSE / DRAW END ══════════ */
function endGame(line,myToken){
  over=true; setBoardLocked(false);
  var winLine=null;
  for(var i=0;i<WINS.length;i++){var l=WINS[i];if(board[l[0]]&&board[l[0]]===board[l[1]]&&board[l[0]]===board[l[2]]){winLine=l;break;}}
  var wp=winLine?board[winLine[0]]:turn;
  scores[wp]++;document.getElementById('sc-'+wp.toLowerCase()).textContent=scores[wp];
  document.getElementById('box-x').classList.remove('active');
  document.getElementById('box-o').classList.remove('active');

  // Highlight winning cells first, then show overlay
  if(winLine){
    var cells=document.getElementById('board').children;
    for(var i=0;i<winLine.length;i++){
      (function(ci){setTimeout(function(){
        if(myToken!==roundToken)return;
        if(cells[ci])cells[ci].classList.add('win-cell');
      },ci*100);})(winLine[i]);
    }
  }
  setFinalBars(wp);

  setTimeout(function(){
    if(myToken!==roundToken)return;
    var isPlayerWin=(mode==='ai'&&wp==='X')||(mode==='pvp');
    var isAiWin=(mode==='ai'&&wp==='O');
    if(isAiWin){
      showResultOverlay('lose','AI Wins!','Better luck next round 💪','🤖',myToken);
    } else if(mode==='pvp'){
      showResultOverlay('win',wp+' Wins!','Nice game! 🎉','🏆',myToken);
    } else {
      showResultOverlay('win','You Win!','Amazing! Keep it up 🔥','🎉',myToken);
    }
  },500);
}

function endDraw(myToken){
  over=true; setBoardLocked(false);
  scores.D++;document.getElementById('sc-d').textContent=scores.D;
  document.getElementById('box-x').classList.remove('active');
  document.getElementById('box-o').classList.remove('active');
  setFinalBars('D');
  setTimeout(function(){
    if(myToken!==roundToken)return;
    showResultOverlay('draw','It\'s a Draw!','Perfectly balanced ⚖️','🤝',myToken);
  },400);
}

/* ══════════ WIN PROBABILITY ══════════ */
function resetBars(){
  document.getElementById('bar-x').style.height='50%';document.getElementById('bar-o').style.height='50%';document.getElementById('bar-d').style.width='0%';
  document.getElementById('pct-x').textContent='50%';document.getElementById('pct-o').textContent='50%';document.getElementById('pct-d').textContent='0%';
  document.getElementById('tag-x').textContent='Even';document.getElementById('tag-x').className='chance-tag tag-even';
  document.getElementById('tag-o').textContent='Even';document.getElementById('tag-o').className='chance-tag tag-even';
}
function computeProb(){
  var simCount=250,xW=0,oW=0,dr=0,empty=getEmpty(board),w0=getWinOn(board);
  if(w0==='X')return{x:100,o:0,d:0};if(w0==='O')return{x:0,o:100,d:0};
  if(!empty.length)return{x:0,o:0,d:100};
  for(var s=0;s<simCount;s++){
    var sim=board.slice(),st=turn,res=null,mv=empty.slice();
    for(var i=mv.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=mv[i];mv[i]=mv[j];mv[j]=t;}
    var mi=0;
    while(mi<mv.length){sim[mv[mi]]=st;var ww=getWinOn(sim);if(ww){res=ww;break;}if(sim.every(function(v){return v!=='';})){res='D';break;}st=st==='X'?'O':'X';mi++;}
    if(res==='X')xW++;else if(res==='O')oW++;else dr++;
  }
  return{x:Math.round(xW/simCount*100),o:Math.round(oW/simCount*100),d:Math.round(dr/simCount*100)};
}
function updateBars(){
  var p=computeProb(),xp=p.x,op=p.o,dp=p.d,tot=xp+op+dp;
  if(tot>0){xp=Math.round(xp/tot*100);op=Math.round(op/tot*100);dp=100-xp-op;}
  document.getElementById('bar-x').style.height=xp+'%';document.getElementById('bar-o').style.height=op+'%';document.getElementById('bar-d').style.width=dp+'%';
  document.getElementById('pct-x').textContent=xp+'%';document.getElementById('pct-o').textContent=op+'%';document.getElementById('pct-d').textContent=dp+'%';
  var tx=document.getElementById('tag-x'),to=document.getElementById('tag-o');
  if(xp>op+10){tx.textContent='Winning';tx.className='chance-tag tag-x';to.textContent='Losing';to.className='chance-tag tag-o';}
  else if(op>xp+10){tx.textContent='Losing';tx.className='chance-tag tag-o';to.textContent='Winning';to.className='chance-tag tag-x';}
  else{tx.textContent='Even';tx.className='chance-tag tag-even';to.textContent='Even';to.className='chance-tag tag-even';}
}
function setFinalBars(w){
  if(w==='X'){document.getElementById('bar-x').style.height='100%';document.getElementById('bar-o').style.height='0%';document.getElementById('bar-d').style.width='0%';document.getElementById('pct-x').textContent='100%';document.getElementById('pct-o').textContent='0%';document.getElementById('pct-d').textContent='0%';document.getElementById('tag-x').textContent='Winner!';document.getElementById('tag-x').className='chance-tag tag-x';document.getElementById('tag-o').textContent='Lost';document.getElementById('tag-o').className='chance-tag tag-o';}
  else if(w==='O'){document.getElementById('bar-x').style.height='0%';document.getElementById('bar-o').style.height='100%';document.getElementById('bar-d').style.width='0%';document.getElementById('pct-x').textContent='0%';document.getElementById('pct-o').textContent='100%';document.getElementById('pct-d').textContent='0%';document.getElementById('tag-x').textContent='Lost';document.getElementById('tag-x').className='chance-tag tag-o';document.getElementById('tag-o').textContent='Winner!';document.getElementById('tag-o').className='chance-tag tag-x';}
  else{document.getElementById('bar-x').style.height='0%';document.getElementById('bar-o').style.height='0%';document.getElementById('bar-d').style.width='100%';document.getElementById('pct-x').textContent='0%';document.getElementById('pct-o').textContent='0%';document.getElementById('pct-d').textContent='100%';document.getElementById('tag-x').textContent='Draw';document.getElementById('tag-x').className='chance-tag tag-d';document.getElementById('tag-o').textContent='Draw';document.getElementById('tag-o').className='chance-tag tag-d';}
}

/* ══════════ AI ENGINE ══════════ */
function findWB(b,p){var e=getEmpty(b);for(var i=0;i<e.length;i++){b[e[i]]=p;if(getWinOn(b)){b[e[i]]='';return e[i];}b[e[i]]='';}return null;}
function findForks(b,p){
  var e=getEmpty(b),f=[];
  for(var i=0;i<e.length;i++){var nb=b.slice();nb[e[i]]=p;var t=0;for(var w=0;w<WINS.length;w++){var l=WINS[w],c=0,em=0;for(var j=0;j<3;j++){if(nb[l[j]]===p)c++;else if(!nb[l[j]])em++;}if(c===2&&em===1)t++;}if(t>=2)f.push(e[i]);}
  return f;
}
function blockFork(b){
  var pf=findForks(b,'X');if(!pf.length)return null;
  var e=getEmpty(b),safe=[];
  for(var i=0;i<e.length;i++){var nb=b.slice();nb[e[i]]='O';for(var w=0;w<WINS.length;w++){var l=WINS[w],c=0,em=0,bc=-1;for(var j=0;j<3;j++){if(nb[l[j]]==='O')c++;else if(!nb[l[j]]){em++;bc=l[j];}}if(c===2&&em===1){var nb2=nb.slice();nb2[bc]='X';if(findForks(nb2,'X').length===0)safe.push(e[i]);}}}
  return safe.length?safe:pf;
}
function minimax(b,p,a,be,d){
  var w=getWinOn(b);if(w==='O')return{s:10-d};if(w==='X')return{s:d-10};
  var e=getEmpty(b);if(!e.length)return{s:0};
  var best=p==='O'?{s:-99,i:-1}:{s:99,i:-1};
  for(var i=0;i<e.length;i++){var nb=b.slice();nb[e[i]]=p;var r=minimax(nb,p==='O'?'X':'O',a,be,d+1);if(p==='O'){if(r.s>best.s)best={s:r.s,i:e[i]};a=Math.max(a,best.s);}else{if(r.s<best.s)best={s:r.s,i:e[i]};be=Math.min(be,best.s);}if(be<=a)break;}
  return best;
}
function bestMoves(b,p){
  var e=getEmpty(b),sc=[];
  for(var i=0;i<e.length;i++){var nb=b.slice();nb[e[i]]=p;var r=minimax(nb,p==='O'?'X':'O',-Infinity,Infinity,1);sc.push({i:e[i],s:r.s});}
  var best=p==='O'?Math.max.apply(null,sc.map(function(x){return x.s;})):Math.min.apply(null,sc.map(function(x){return x.s;}));
  return sc.filter(function(x){return x.s===best;}).map(function(x){return x.i;});
}
function variedOpening(b){
  if(getEmpty(b).length!==8)return null;
  var xm=-1;for(var i=0;i<9;i++)if(b[i]==='X')xm=i;
  var corners=[0,2,6,8],edges=[1,3,5,7];
  if(xm===4)return null;
  if(corners.indexOf(xm)>-1){
    if(Math.random()<0.70){setThought('Taking center — safest reply');return 4;}
    setThought('Trying a riskier opening…');
    var alt=corners.filter(function(c){return c!==xm;}).concat(edges);
    return alt[Math.floor(Math.random()*alt.length)];
  }
  if(edges.indexOf(xm)>-1){
    if(Math.random()<0.70){setThought('Taking center — strongest reply');return 4;}
    setThought('Trying a different opening…');
    return corners[Math.floor(Math.random()*corners.length)];
  }
  return null;
}
function aiEasy(){setThought('Playing randomly…');var e=getEmpty(board);return e[Math.floor(Math.random()*e.length)];}
function aiMedium(){
  var b=board.slice();
  var w=findWB(b,'O');if(w!==null){setThought('I see a winning move!');return w;}
  var bl=findWB(b,'X');if(bl!==null){setThought('Blocking your move…');return bl;}
  if(Math.random()<0.6){var order=[4,0,2,6,8,1,3,5,7];for(var i=0;i<order.length;i++){if(!b[order[i]]&&Math.random()<0.7){setThought('Taking a strong position…');return order[i];}}}
  setThought('Hmm, thinking…');var e=getEmpty(b);return e[Math.floor(Math.random()*e.length)];
}
function aiHard(){
  var b=board.slice(),key=boardKey(b);
  var w=findWB(b,'O');if(w!==null){setThought('Found a winning move!');recordMove(key,w);return w;}
  var bl=findWB(b,'X');if(bl!==null){setThought('Blocking your winning move!');recordMove(key,bl);return bl;}
  if(settings.variety){var op=variedOpening(b);if(op!==null){recordMove(key,op);return op;}}
  var bf=blockFork(b);
  if(bf!==null){var ch=Array.isArray(bf)?pickLeastUsed(key,bf):bf;setThought('Blocking your fork!');recordMove(key,ch);return ch;}
  var fk=findForks(b,'O');if(fk.length){var fc=pickLeastUsed(key,fk);setThought('Setting up a fork trap!');recordMove(key,fc);return fc;}
  setThought('Calculating optimal move…');
  var top=bestMoves(b,'O');var ch2=pickLeastUsed(key,top);recordMove(key,ch2);return ch2;
}
function aiMove(myToken){
  if(myToken!==undefined&&myToken!==roundToken)return;
  if(over){setBoardLocked(false);return;}
  var idx;
  if(diff==='easy')idx=aiEasy();
  else if(diff==='medium')idx=aiMedium();
  else idx=aiHard();
  if(idx===undefined||idx===null){var e=getEmpty(board);idx=e[0];}
  board[idx]='O';renderBoard();updateBars();
  if(diff==='hard')document.getElementById('memo-note').textContent='AI remembers '+Object.keys(moveMemory).length+' positions';
  var w=getWin();if(w){endGame(w,roundToken);return;}
  if(isDraw()){endDraw(roundToken);return;}
  turn='X';setBoardLocked(false);setStatus('Your turn');highlight('X');
}

function getEmpty(b){var e=[];for(var i=0;i<9;i++)if(!b[i])e.push(i);return e;}
function getWin(){return getWinOn(board);}
function getWinOn(b){for(var i=0;i<WINS.length;i++){var a=WINS[i][0],bb=WINS[i][1],cc=WINS[i][2];if(b[a]&&b[a]===b[bb]&&b[a]===b[cc])return b[a];}return null;}
function isDraw(){return board.every(function(v){return v!=='';});}
function setStatus(h){document.getElementById('game-status').innerHTML=h;}
function setThought(t){var el=document.getElementById('ai-thought');if(settings.thought&&mode==='ai'&&t)el.textContent='🤖 '+t;else el.textContent='';}
function highlight(t){document.getElementById('box-x').classList.toggle('active',t==='X');document.getElementById('box-o').classList.toggle('active',t==='O');}

renderBoard();resetBars();
