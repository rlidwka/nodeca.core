/**
 *  Renders and injects debug stats on successful RPC requests.
 **/


'use strict';


N.wire.on('io.complete', function debug_timeline(info) {

  // Skip if puncher stats not recieved.
  if (!info.res ||
      !info.res.puncher_stats) {
    return;
  }

  var $timeline = $('#debug_timeline');

  // Skip if there is no #debug_timeline
  if (0 === $timeline.length) {
    return;
  }

  $timeline.replaceWith(
    N.runtime.render(module.apiPath, {
      stats: info.res.puncher_stats
    })
  );
});

// Toggle timeline view. By defaul it hide elements with small value
// to make output shorter
N.wire.on('common.blocks.debug_timeline:toggle_hidden', function debug_timeline_toggle_hidden(data) {
  data.$this.toggleClass('debug-timeline__m-show-hidden');
});
