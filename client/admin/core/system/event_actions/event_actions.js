/**
 *  Assigns handlers/listeners for `[data-action]` links.
 *
 *  Actions associated with a link will be invoked via Wire with the jQuery
 *  event object as an argument.
 **/


'use strict';


// Emits specified event
//
// data - event payload
//
function handleAction(apiPath, data) {
  N.loader.loadAssets(apiPath.split('.')[0], function () {
    if (N.wire.has(apiPath)) {
      N.wire.emit(apiPath, data);
    } else {
      N.logger.error('Unknown client Wire channel: %s', apiPath);
    }
  });
}


N.wire.once('navigate.done', function () {

  // add the dataTransfer property for use with the native `drop` event
  // to capture information about files dropped into the browser window
  // http://api.jquery.com/category/events/event-object/
  $.event.props.push('dataTransfer');

  $(document).on('dragenter dragleave dragover drop', '[data-on-dragdrop]', function (event) {
    var data = {
      event: event,
      $this: $(this)
    };
    var apiPath = data.$this.data('onDragdrop');

    handleAction(apiPath, data);
    event.preventDefault();
  });

  $(document).on('click', '[data-on-click]', function (event) {
    var data = {
      event: event,
      $this: $(this)
    };
    var apiPath = data.$this.data('onClick');

    handleAction(apiPath, data);
    event.preventDefault();
  });

  $(document).on('submit', '[data-on-submit]', function (event) {
    var data = {
      event: event,
      $this: $(this),
      fields: {}
    };
    var apiPath = data.$this.data('onSubmit');

    // Fill fields
    $.each(data.$this.serializeArray(), function () {
      data.fields[this.name] = this.value;
    });

    handleAction(apiPath, data);
    event.preventDefault();
  });

  $(document).on('input', '[data-on-input]', function (event) {
    var data = {
      event: event,
      $this: $(this)
    };
    var apiPath = data.$this.data('onInput');

    handleAction(apiPath, data);
    event.preventDefault();
  });

  $(document).on('change', '[data-on-change]', function (event) {
    var data = {
      event: event,
      $this: $(this)
    };
    var apiPath = data.$this.data('onChange');

    handleAction(apiPath, data);
    event.preventDefault();
  });
});
