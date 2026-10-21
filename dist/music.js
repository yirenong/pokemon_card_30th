(() => {
  const mixes = [
    {id:'m1vtEX64gmE', title:'Pok?mon Lofi ? Mix 1'},
    {id:'43DV570YjFU', title:'Pok?mon Lofi ? Mix 2'}
  ];
  const widget = document.createElement('aside');
  widget.className = 'music-widget';
  widget.setAttribute('aria-label', 'Pok?mon chill music');
  widget.innerHTML = '<section class="music-panel" id="musicPanel"><div class="music-heading"><div><span class="music-eyebrow">A LITTLE BACKGROUND COMPANY</span><h2>Pok?mon &amp; chill</h2></div><button class="music-close" type="button" aria-label="Close music player">&times;</button></div><p class="music-track"></p><div class="music-screen"><div id="musicVideo"></div></div><div class="music-controls"><button type="button" data-music="previous" aria-label="Previous mix" title="Previous mix">&#9198;</button><button type="button" data-music="play" aria-label="Play" title="Play">&#9654;</button><button type="button" data-music="stop" aria-label="Stop" title="Stop">&#9632;</button><button type="button" data-music="next" aria-label="Next mix" title="Next mix">&#9197;</button></div><p class="music-status" role="status">Connecting to chill radio?</p><a class="music-source" target="_blank" rel="noopener">GlitchxCity ? Listen on YouTube ?</a></section><button class="music-reopen" type="button" aria-label="Open music player" aria-controls="musicPanel" aria-expanded="true" hidden>? Music</button>';
  document.body.append(widget);
  const panel = widget.querySelector('.music-panel');
  const reopen = widget.querySelector('.music-reopen');
  const play = widget.querySelector('[data-music="play"]');
  const status = widget.querySelector('.music-status');
  let index = 0, player = null, ready = false, playing = false, wantsPlay = true, closed = false;
  function label() {
    widget.querySelector('.music-track').textContent = mixes[index].title + ' ? GlitchxCity';
    widget.querySelector('.music-source').href = 'https://www.youtube.com/watch?v=' + mixes[index].id;
  }
  function playState(value) {
    playing = value;
    play.innerHTML = value ? '&#10074;&#10074;' : '&#9654;';
    play.setAttribute('aria-label', value ? 'Pause' : 'Play');
    play.title = value ? 'Pause' : 'Play';
  }
  function change(delta) {
    index = (index + delta + mixes.length) % mixes.length;
    label(); wantsPlay = true; playState(false);
    status.textContent = 'Loading mix?';
    if (ready) player.loadVideoById(mixes[index].id);
  }
  widget.querySelector('[data-music="previous"]').onclick = () => change(-1);
  widget.querySelector('[data-music="next"]').onclick = () => change(1);
  play.onclick = () => {
    if (!ready) { wantsPlay = true; status.textContent = 'Connecting? If unavailable, listen on YouTube below.'; return; }
    wantsPlay = !playing;
    if (playing) player.pauseVideo(); else player.playVideo();
  };
  widget.querySelector('[data-music="stop"]').onclick = () => {
    wantsPlay = false;
    if (ready) player.stopVideo();
    playState(false); status.textContent = 'Stopped ? Press play to restart.';
  };
  widget.querySelector('.music-close').onclick = () => {
    closed = true; wantsPlay = false;
    if (ready) player.stopVideo();
    playState(false); panel.hidden = true; reopen.hidden = false;
    reopen.setAttribute('aria-expanded', 'false'); reopen.focus();
  };
  reopen.onclick = () => {
    closed = false; panel.hidden = false; reopen.hidden = true;
    reopen.setAttribute('aria-expanded', 'true');
    status.textContent = 'Press play to continue.'; play.focus();
  };
  function init() {
    if (player) return;
    player = new window.YT.Player('musicVideo', {
      host:'https://www.youtube-nocookie.com', width:'100%', height:'200',
      videoId:mixes[index].id,
      playerVars:{autoplay:1, playsinline:1, origin:location.origin},
      events:{
        onReady(event) {
          ready = true;
          const frame = event.target.getIframe();
          frame.title = 'Pok?mon chill mix player';
          frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
          event.target.setVolume(30);
          if (wantsPlay && !closed) event.target.loadVideoById(mixes[index].id);
          else event.target.stopVideo();
        },
        onStateChange(event) {
          if (closed || !wantsPlay && event.data === 1) { player.stopVideo(); playState(false); return; }
          if (event.data === 1) { playState(true); status.textContent = 'Now playing ? Sit back and collect.'; }
          else if (event.data === 2) { playState(false); status.textContent = 'Paused'; }
          else if (event.data === 0 && wantsPlay) change(1);
        },
        onAutoplayBlocked() { playState(false); status.textContent = 'Your browser needs a click ? Press play to start.'; },
        onError() { playState(false); status.textContent = 'Mix unavailable ? Try next or listen on YouTube.'; }
      }
    });
  }
  label();
  if (window.YT?.Player) init();
  else {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (previous) previous(); init(); };
    const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { status.textContent = 'Player unavailable ? Listen on YouTube below.'; };
    document.head.append(script);
  }
})();
