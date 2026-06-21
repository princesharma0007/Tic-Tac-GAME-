var WINS=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
var board,turn,over,mode,diff;
var scores={X:0,O:0,D:0};
var settings={anim:true,thought:true,variety:true,first:'X'};
var firstPlayer='X',roundCount=0;
var playerHistory={firstMoves:[],preferredCells:{},roundMoves:[]};
var inputLocked=false;   // ← true while it's NOT the human player's turn

var moveMemory={};
function boardKey(b){return b.join('');}
function recordMove(key,idx){
  if(!moveMemory[key])moveMemory[key]={};
  moveMemory[key][idx]=(moveMemory[key][idx]||0)+1;
}
function pickLeastUsed(key,candidates){
  if(candidates.length===1)return candidates[0];
  var used=moveMemory[key]||{};
  var counts=candidates.map(function(idx){return{idx:idx,c:used[idx]||0};});
  var minC=Math.min.apply(null,counts.map(function(o){return o.c;}));
  var fresh=counts.filter(function(o){return o.c===minC;}).map(function(o){return o.idx;});
  return fresh[Math.floor(Math.random()*fresh.length)];
}

function goTo(id){document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active');});document.getElementById(id).classList.add('active');}
function toggleSetting(k){settings[k]=!settings[k];document.getElementById('tog-'+k).classList.toggle('on',settings[k]);}

function setBoardLocked(state){
  inputLocked=state;
  var b=document.getElementById('board');
  if(!b)return;
  if(state) b.classList.add('locked'); else b.classList.remove('locked');
}

function startGame(m,d){
  mode=m;diff=d||'easy';
  scores={X:0,O:0,D:0};
  ['x','o','d'].forEach(function(k){document.getElementById('sc-'+k).textContent=0;});
  roundCount=0;
  playerHistory={firstMoves:[],preferredCells:{},roundMoves:[]};
  if(mode==='ai'){
    document.getElementById('lbl-x').textContent='You';
    document.getElementById('lbl-o').textContent='AI';
    document.getElementById('leg-x').textContent='Your win chance';
    document.getElementById('leg-o').textContent='AI win chance';
    var ind=document.getElementById('diff-ind');
    ind.style.display='inline-block';
    var labels={easy:'🌿 Easy',medium:'🔥 Medium',hard:'👿 Hard'};
    var cls={easy:'di-easy',medium:'di-medium',hard:'di-hard'};
    ind.textContent=labels[diff];
    ind.className='diff-ind '+cls[diff];
    document.getElementById('memo-note').textContent=diff==='hard'?'AI remembers '+Object.keys(moveMemory).length+' positions played':'';
  } else {
    document.getElementById('lbl-x').textContent='Player X';
    document.getElementById('lbl-o').textContent='Player O';
    document.getElementById('leg-x').textContent='X win chance';
    document.getElementById('leg-o').textContent='O win chance';
    document.getElementById('diff-ind').style.display='none';
    document.getElementById('memo-note').textContent='';
  }
  firstPlayer=getFirstPlayer();
  initBoard();goTo('game');
}

function getFirstPlayer(){var f=document.getElementById('first-sel').value;if(f==='alt')return roundCount%2===0?'X':'O';return f;}

function initBoard(){
  board=['','','','','','','','',''];
  over=false;turn=firstPlayer;
  playerHistory.roundMoves=[];
  renderBoard();
  setThought('');
  setStatus(mode==='ai'&&turn==='X'?'Your turn':turn+"'s turn");
  highlight(turn);
  resetWinBarsTo5050();
  // Lock the board immediately if AI moves first this round
  setBoardLocked(mode==='ai'&&turn==='O');
  if(mode==='ai'&&turn==='O'){setStatus('AI thinking…');setTimeout(aiMove,700);}
}

function newRound(){roundCount++;firstPlayer=getFirstPlayer();initBoard();}
function goHome(){goTo('home');}

function renderBoard(){
  var b=document.getElementById('board');b.innerHTML='';
  if(inputLocked) b.classList.add('locked'); else b.classList.remove('locked');
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
  // Single source of truth: blocked if game over, cell taken, OR it isn't
  // the human's turn to move (input is locked while AI is "thinking").
  if(over||board[i]||inputLocked)return;

  playerHistory.preferredCells[i]=(playerHistory.preferredCells[i]||0)+1;
  playerHistory.roundMoves.push(i);
  if(playerHistory.roundMoves.length===1)playerHistory.firstMoves.push(i);

  board[i]=turn;renderBoard();
  updateWinBars();
  var w=getWin();if(w){endGame(w);return;}
  if(isDraw()){endDraw();return;}

  turn=turn==='X'?'O':'X';

  if(mode==='ai'&&turn==='O'){
    setBoardLocked(true);              // ← lock immediately, before the delay
    setStatus('AI thinking…');
    var delay=diff==='easy'?300:diff==='medium'?500:600;
    setTimeout(aiMove,delay);
  } else {
    setBoardLocked(false);
    setStatus(mode==='ai'?'Your turn':turn+"'s turn");
    highlight(turn);
  }
}

function resetWinBarsTo5050(){
  document.getElementById('bar-x').style.height='50%';
  document.getElementById('bar-o').style.height='50%';
  document.getElementById('bar-d').style.width='0%';
  document.getElementById('pct-x').textContent='50%';
  document.getElementById('pct-o').textContent='50%';
  document.getElementById('pct-d').textContent='0%';
  document.getElementById('tag-x').textContent='Even';document.getElementById('tag-x').className='chance-tag tag-even';
  document.getElementById('tag-o').textContent='Even';document.getElementById('tag-o').className='chance-tag tag-even';
}

function computeWinProbability(){
  var simCount=250,xWins=0,oWins=0,draws=0;
  var empty=getEmpty(board);
  var w0=getWinOn(board);
  if(w0==='X')return{x:100,o:0,d:0};
  if(w0==='O')return{x:0,o:100,d:0};
  if(!empty.length)return{x:0,o:0,d:100};
  for(var s=0;s<simCount;s++){
    var sim=board.slice(),simTurn=turn,result=null,moves=empty.slice();
    for(var i=moves.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=moves[i];moves[i]=moves[j];moves[j]=t;}
    var mi=0;
    while(mi<moves.length){
      sim[moves[mi]]=simTurn;
      var ww=getWinOn(sim);
      if(ww){result=ww;break;}
      if(sim.every(function(v){return v!=='';})){result='D';break;}
      simTurn=simTurn==='X'?'O':'X';mi++;
    }
    if(result==='X')xWins++;else if(result==='O')oWins++;else draws++;
  }
  return{x:Math.round(xWins/simCount*100),o:Math.round(oWins/simCount*100),d:Math.round(draws/simCount*100)};
}

function updateWinBars(){
  var prob=computeWinProbability();
  var xp=prob.x,op=prob.o,dp=prob.d,total=xp+op+dp;
  if(total>0){xp=Math.round(xp/total*100);op=Math.round(op/total*100);dp=100-xp-op;}
  document.getElementById('bar-x').style.height=xp+'%';
  document.getElementById('bar-o').style.height=op+'%';
  document.getElementById('bar-d').style.width=dp+'%';
  document.getElementById('pct-x').textContent=xp+'%';
  document.getElementById('pct-o').textContent=op+'%';
  document.getElementById('pct-d').textContent=dp+'%';
  var tx=document.getElementById('tag-x'),to=document.getElementById('tag-o');
  if(xp>op+10){tx.textContent='Winning';tx.className='chance-tag tag-x';to.textContent='Losing';to.className='chance-tag tag-o';}
  else if(op>xp+10){tx.textContent='Losing';tx.className='chance-tag tag-o';to.textContent='Winning';to.className='chance-tag tag-x';}
  else{tx.textContent='Even';tx.className='chance-tag tag-even';to.textContent='Even';to.className='chance-tag tag-even';}
}

function setFinalBars(winner){
  if(winner==='X'){
    document.getElementById('bar-x').style.height='100%';document.getElementById('bar-o').style.height='0%';document.getElementById('bar-d').style.width='0%';
    document.getElementById('pct-x').textContent='100%';document.getElementById('pct-o').textContent='0%';document.getElementById('pct-d').textContent='0%';
    document.getElementById('tag-x').textContent='Winner!';document.getElementById('tag-x').className='chance-tag tag-x';
    document.getElementById('tag-o').textContent='Lost';document.getElementById('tag-o').className='chance-tag tag-o';
  } else if(winner==='O'){
    document.getElementById('bar-x').style.height='0%';document.getElementById('bar-o').style.height='100%';document.getElementById('bar-d').style.width='0%';
    document.getElementById('pct-x').textContent='0%';document.getElementById('pct-o').textContent='100%';document.getElementById('pct-d').textContent='0%';
    document.getElementById('tag-x').textContent='Lost';document.getElementById('tag-x').className='chance-tag tag-o';
    document.getElementById('tag-o').textContent='Winner!';document.getElementById('tag-o').className='chance-tag tag-x';
  } else {
    document.getElementById('bar-x').style.height='0%';document.getElementById('bar-o').style.height='0%';document.getElementById('bar-d').style.width='100%';
    document.getElementById('pct-x').textContent='0%';document.getElementById('pct-o').textContent='0%';document.getElementById('pct-d').textContent='100%';
    document.getElementById('tag-x').textContent='Draw';document.getElementById('tag-x').className='chance-tag tag-d';
    document.getElementById('tag-o').textContent='Draw';document.getElementById('tag-o').className='chance-tag tag-d';
  }
}

function findWinBlock(b,p){var e=getEmpty(b);for(var i=0;i<e.length;i++){b[e[i]]=p;if(getWinOn(b)){b[e[i]]='';return e[i];}b[e[i]]='';}return null;}

function findAllForks(b,player){
  var empty=getEmpty(b),forks=[];
  for(var i=0;i<empty.length;i++){
    var nb=b.slice();nb[empty[i]]=player;
    var threats=0;
    for(var w=0;w<WINS.length;w++){var l=WINS[w],cnt=0,emp=0;for(var j=0;j<3;j++){if(nb[l[j]]===player)cnt++;else if(!nb[l[j]])emp++;}if(cnt===2&&emp===1)threats++;}
    if(threats>=2)forks.push(empty[i]);
  }
  return forks;
}

function blockFork(b){
  var pf=findAllForks(b,'X');if(!pf.length)return null;
  var empty=getEmpty(b),safe=[];
  for(var i=0;i<empty.length;i++){
    var nb=b.slice();nb[empty[i]]='O';
    for(var w=0;w<WINS.length;w++){var l=WINS[w],cnt=0,emp=0,bc=-1;for(var j=0;j<3;j++){if(nb[l[j]]==='O')cnt++;else if(!nb[l[j]]){emp++;bc=l[j];}}
    if(cnt===2&&emp===1){var nb2=nb.slice();nb2[bc]='X';if(findAllForks(nb2,'X').length===0)safe.push(empty[i]);}}
  }
  return safe.length?safe:pf;
}

function minimax(b,player,alpha,beta,depth){
  var w=getWinOn(b);
  if(w==='O')return{score:10-depth};
  if(w==='X')return{score:depth-10};
  var empty=getEmpty(b);
  if(!empty.length)return{score:0};
  var best=player==='O'?{score:-99,idx:-1}:{score:99,idx:-1};
  for(var i=0;i<empty.length;i++){
    var nb=b.slice();nb[empty[i]]=player;
    var res=minimax(nb,player==='O'?'X':'O',alpha,beta,depth+1);
    if(player==='O'){if(res.score>best.score)best={score:res.score,idx:empty[i]};alpha=Math.max(alpha,best.score);}
    else{if(res.score<best.score)best={score:res.score,idx:empty[i]};beta=Math.min(beta,best.score);}
    if(beta<=alpha)break;
  }
  return best;
}

function bestMovesFull(b,player){
  var empty=getEmpty(b),scored=[];
  for(var i=0;i<empty.length;i++){
    var nb=b.slice();nb[empty[i]]=player;
    var res=minimax(nb,player==='O'?'X':'O',-Infinity,Infinity,1);
    scored.push({idx:empty[i],score:res.score});
  }
  var best=player==='O'?Math.max.apply(null,scored.map(function(s){return s.score;}))
                        :Math.min.apply(null,scored.map(function(s){return s.score;}));
  return scored.filter(function(s){return s.score===best;}).map(function(s){return s.idx;});
}

function variedOpeningReply(b){
  var filled=getEmpty(b).length===8;
  if(!filled) return null;
  var xMove=-1;
  for(var i=0;i<9;i++) if(b[i]==='X') xMove=i;
  var corners=[0,2,6,8], edges=[1,3,5,7], center=4;
  if(xMove===center) return null;
  if(corners.indexOf(xMove)>-1){
    var r=Math.random();
    if(r<0.7){ setThought('Taking center — the safest reply'); return center; }
    setThought('Trying a riskier opening for variety…');
    var alt=corners.filter(function(c){return c!==xMove;}).concat(edges);
    return alt[Math.floor(Math.random()*alt.length)];
  }
  if(edges.indexOf(xMove)>-1){
    var r2=Math.random();
    if(r2<0.7){ setThought('Taking center — strongest reply'); return center; }
    setThought('Trying a different opening this time…');
    return corners[Math.floor(Math.random()*corners.length)];
  }
  return null;
}

function aiEasy(){setThought('Playing randomly…');var e=getEmpty(board);return e[Math.floor(Math.random()*e.length)];}

function aiMedium(){
  var b=board.slice();
  var win=findWinBlock(b,'O');if(win!==null){setThought('I see a winning move!');return win;}
  var block=findWinBlock(b,'X');if(block!==null){setThought('Blocking your move…');return block;}
  if(Math.random()<0.6){
    var order=[4,0,2,6,8,1,3,5,7];
    for(var i=0;i<order.length;i++){
      if(!b[order[i]]&&Math.random()<0.7){setThought('Taking a strong position…');return order[i];}
    }
  }
  setThought('Hmm, thinking…');
  var e=getEmpty(b);return e[Math.floor(Math.random()*e.length)];
}

function aiHard(){
  var b=board.slice();
  var key=boardKey(b);
  var win=findWinBlock(b,'O');
  if(win!==null){setThought('Found a winning move!');recordMove(key,win);return win;}
  var block=findWinBlock(b,'X');
  if(block!==null){setThought('Blocking your winning move!');recordMove(key,block);return block;}
  if(settings.variety){
    var opening=variedOpeningReply(b);
    if(opening!==null){recordMove(key,opening);return opening;}
  }
  var bf=blockFork(b);
  if(bf!==null){
    var choice=Array.isArray(bf)?pickLeastUsed(key,bf):bf;
    setThought('Blocking your fork attempt!');recordMove(key,choice);return choice;
  }
  var forks=findAllForks(b,'O');
  if(forks.length){
    var fc=pickLeastUsed(key,forks);
    setThought('Setting up a fork trap!');recordMove(key,fc);return fc;
  }
  setThought('Calculating optimal move…');
  var top=bestMovesFull(b,'O');
  var chosen=pickLeastUsed(key,top);
  recordMove(key,chosen);
  return chosen;
}

function aiMove(){
  if(over){setBoardLocked(false);return;}
  var idx;
  if(diff==='easy')idx=aiEasy();
  else if(diff==='medium')idx=aiMedium();
  else idx=aiHard();
  if(idx===undefined||idx===null){var e=getEmpty(board);idx=e[0];}
  board[idx]='O';renderBoard();
  updateWinBars();
  if(diff==='hard')document.getElementById('memo-note').textContent='AI remembers '+Object.keys(moveMemory).length+' positions played';
  var w=getWin();
  if(w){endGame(w);return;}
  if(isDraw()){endDraw();return;}
  turn='X';
  setBoardLocked(false);     // ← unlock: it's the human's turn again
  setStatus('Your turn');
  highlight('X');
}

function getEmpty(b){var e=[];for(var i=0;i<9;i++)if(!b[i])e.push(i);return e;}
function getWin(){return getWinOn(board);}
function getWinOn(b){for(var i=0;i<WINS.length;i++){var a=WINS[i][0],bb=WINS[i][1],cc=WINS[i][2];if(b[a]&&b[a]===b[bb]&&b[a]===b[cc])return b[a];}return null;}
function isDraw(){return board.every(function(v){return v!=='';});}

function endGame(line){
  over=true;
  setBoardLocked(false); // unlock visually; .over check still blocks new clicks
  var winLine=null;
  for(var i=0;i<WINS.length;i++){var l=WINS[i];if(board[l[0]]&&board[l[0]]===board[l[1]]&&board[l[0]]===board[l[2]]){winLine=l;break;}}
  var wp=winLine?board[winLine[0]]:turn;
  scores[wp]++;document.getElementById('sc-'+wp.toLowerCase()).textContent=scores[wp];
  if(winLine){var cells=document.getElementById('board').children;for(var i=0;i<winLine.length;i++){(function(ci){setTimeout(function(){cells[ci].classList.add('win-cell');},ci*80);})(winLine[i]);}}
  var who=mode==='ai'&&wp==='O'?'AI wins! 🤖':mode==='ai'&&wp==='X'?'You win! 🎉':wp+' wins! 🎉';
  setTimeout(function(){setStatus('<span class="win-txt">'+who+'</span>');setThought('');setFinalBars(wp);},300);
  document.getElementById('box-x').classList.remove('active');document.getElementById('box-o').classList.remove('active');
}

function endDraw(){
  over=true;
  setBoardLocked(false);
  scores.D++;document.getElementById('sc-d').textContent=scores.D;
  setStatus('<span class="draw-txt">Draw! 🤝</span>');setThought('');setFinalBars('D');
  document.getElementById('box-x').classList.remove('active');document.getElementById('box-o').classList.remove('active');
}

function setStatus(html){document.getElementById('game-status').innerHTML=html;}
function setThought(txt){var el=document.getElementById('ai-thought');if(settings.thought&&mode==='ai'&&txt)el.textContent='🤖 '+txt;else el.textContent='';}
function highlight(t){document.getElementById('box-x').classList.toggle('active',t==='X');document.getElementById('box-o').classList.toggle('active',t==='O');}

renderBoard();
resetWinBarsTo5050();
