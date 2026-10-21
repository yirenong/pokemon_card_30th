(() => {
  const widget = document.createElement('aside');
  widget.className = 'music-widget';
  widget.setAttribute('aria-label', 'Pokémon chill music');
  widget.innerHTML = '<section class="music-panel" id="musicPanel"><div class="music-heading"><div><span class="music-eyebrow">A LITTLE BACKGROUND COMPANY</span><h2>Pokémon &amp; chill</h2></div><button class="music-close" type="button" aria-label="Close music player">×</button></div><p>Lo-fi Pokémon beats by GlitchxCity.</p><div class="music-screen"><button class="music-start" type="button">▶ Play chill mix</button></div><a class="music-source" href="https://www.youtube.com/watch?v=m1vtEX64gmE" target="_blank" rel="noopener">Listen on YouTube ↗</a></section><button class="music-reopen" type="button" aria-label="Open music player" aria-controls="musicPanel" aria-expanded="true" hidden>♫ Music</button>';
  document.body.append(widget);
  const panel = widget.querySelector('.music-panel');
  const screen = widget.querySelector('.music-screen');
  const reopen = widget.querySelector('.music-reopen');
  const start = widget.querySelector('.music-start');
  start.addEventListener('click', () => {
    const player = document.createElement('iframe');
    player.title = 'Pokémon Lofi Music — 1 Hour Mix by GlitchxCity';
    player.src = 'https://www.youtube-nocookie.com/embed/m1vtEX64gmE?autoplay=1&playsinline=1';
    player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    player.referrerPolicy = 'strict-origin-when-cross-origin';
    player.allowFullscreen = true;
    screen.replaceChildren(player);
  });
  widget.querySelector('.music-close').addEventListener('click', () => {
    // Removing the frame stops playback immediately, including in the background.
    screen.replaceChildren(start);
    panel.hidden = true;
    reopen.hidden = false;
    reopen.setAttribute('aria-expanded', 'false');
    reopen.focus();
  });
  reopen.addEventListener('click', () => {
    panel.hidden = false;
    reopen.hidden = true;
    reopen.setAttribute('aria-expanded', 'true');
    start.focus();
  });
})();
