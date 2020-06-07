$(function () {
  var url = window.location.href;
  var dirUrl = url.substring(0, url.lastIndexOf("/") + 1);

  var highlighterUrl = window.HighlighterBase || dirUrl + '../../';

  var viewerUrl = window.HighlightingViewerUrl || '../../viewer/';

  var initialPdf = window.PdfExampleUrlCorsSafe || dirUrl + '../alice.pdf';


  //var viewerCustomScript = '/examples/redact/redact-viewer.js';
  var viewerCustomScript = dirUrl + 'redact-viewer.js';
  var pdfFrame = window.parent.frames[1];
  var extraViewerOptions = 'script=' + encodeURIComponent(viewerCustomScript) + '&hlCopy=1&';
  var currentPdf;
  var DBL_CLICK_SPEED = 300;
  var navigation = 'page-to-page';

  // extraViewerOptions += 'hlSrv=../..&';
  
  var allKeywords = {};

  var STATE_FOUND = 0;
  var STATE_REDACTED = 1;
  var STATE_SKIP = 2;

  var STATE_PROPS = {
    0: { // FOUND
      state: STATE_FOUND,
      color: [1, 1, 0]
    },
    1: { // REDACTED
      state: STATE_REDACTED,
      color: [0, 0, 0]
    },
    2: { // SKIP
      state: STATE_SKIP,
      color: [0, 0.3, 0]
    }
  };

  var $input = $('#queryInput').selectize({
    plugins: ['remove_button'],
    delimiter: '\n',
    persist: false,
    create: function (keyword) {
      // console.log('create', keyword);
      if (!currentPdf) return;
      return {
        value: keyword,
        text: keyword
      }
    },
    onItemAdd: function (keyword, $item) {
      // console.log('onItemAdd', keyword, $item);
      pdfHighlighter.sendHighlightRequest(
        {
          highlighterUrl: highlighterUrl
        },
        {
          uri: currentPdf,
          query: keyword,
          navigation: navigation,
          include: 'hits,matchText',
          language: 'general'
        },
        function (data) {
          onNewHighlights(keyword, data);
        },
        function (req) {
          console.error('Error executing highlighting request', req);
        });
    },
    onItemRemove: function (value, $item) {
      // console.log('onItemRemove', value, $item);
      delete allKeywords[value];
      updatePdfHighlights();
    }
  });
  var selectize = $input[0].selectize;

  var $pdfInput = $('#pdfUrlInput').selectize({
    //plugins: ['restore_on_backspace'],
    create: true,
    sortField: 'text',
    onChange: function (value) {
      currentPdf = value;
      selectize.clear(true);
      allKeywords = {};
      pdfFrame.location = viewerUrl + '?file=' + encodeURIComponent(value) + '&' + extraViewerOptions;
      setTimeout(listenPdfJsWindowEvents, 500);
    }
  });
  var pdfSelectize = $pdfInput[0].selectize;
  if (initialPdf)
    pdfSelectize.createItem(initialPdf);

  function onNewHighlights(id, data, defaultState) {
    data.jumpToFirstHighlightedHit = false; // fixme works but still need to force page refresh
    allKeywords[id] = data;
    updateHitsState(data.matches, defaultState || STATE_FOUND, id);
    updatePdfHighlights();
  }

  function listenPdfJsWindowEvents() {
    pdfFrame.addEventListener('message', function (e) {
      var args = e.data;
      if (typeof args !== 'object' || !('pdfjsHighlighterEvent' in args)) {
        return;
      }
      switch (args.pdfjsHighlighterEvent) {
        case 'hl_page_click':
          pdfPageClick(args.data);
          break;
        case 'hl_text_selection_loaded':
          onTextSelectionLoaded(args.data);
          break;
      }
    });
  }

  function updatePdfHighlights() {
    var allResponses = [];
    for (k in allKeywords) {
      if (allKeywords[k].success)
        allResponses.push(allKeywords[k]);
    }
    console.log('ALL', allResponses);
    pdfFrame.postMessage({
      pdfjsHighlighterAction: 'PDFHighlighter_UpdateForHighlightResults',
      data: allResponses
    });
  }

  function updateHitsState(list, state, searchId) {
    if (list) {
      var props = STATE_PROPS[state];
      for(var i = 0; i < list.length; i++) {
        if (searchId)
          list[i].searchId = searchId;
        if (typeof props.state !== 'undefined') list[i].state = props.state;
        if (typeof props.color !== 'undefined') list[i].color = props.color;
      }
    }
  }

  var lastClickedHit;
  var lastClickedTime = 0;

  function pdfPageClick(data) {
    var h = data.hit;
    /* double click doesn't work well so disabling
    if ((Date.now() - lastClickedTime) <= DBL_CLICK_SPEED && lastClickedHit && h && lastClickedHit.searchId === h.searchId && lastClickedHit.index === h.index) {
      var hits = findStoredHits([h]);
      updateHitsState(hits, h.state === STATE_REDACTED ? STATE_SKIP : STATE_REDACTED);
      updatePdfHighlights(); // fixme should be without jump!
    }
    */
    lastClickedTime = Date.now();
    lastClickedHit = findStoredHit(h);
    if (lastClickedHit) {
      $('#selectedHit').html(h.text);
      $('#hitSelectBlock').show();
    }
    else {
      $('#hitSelectBlock').hide();
    }
  }

  function findStoredHits(hits) {
    var res = [];
    for (var i = 0; i < hits.length; i++) {
      var h = findStoredHit(hits[i]);
      if (h)
        res.push(h);
    }
    return res;
  }

  function findStoredHit(h) {
    if (!h)
      return;
    var r = allKeywords[h.searchId];
    if (r) {
      for (var i = 0; i < r.matches.length; i++) {
        var m = r.matches[i];
        if (m.index === h.index)
          return m;
      }
    }
  }

  var selectedTextCounter = 0;
  var selectedTextLocations;
  function onTextSelectionLoaded(data) {
    console.log('*** SELECTION:', data);
    if (data.success) {
      if (data.sections && data.sections[0] && data.locations && data.locations[0]) {
        $('#selectedText').html(data.sections[0]);
        selectedTextLocations = data.locations[0];
        $('#textSelectBlock').show();
      }
    }
  }

  $('#redactSelected').click(function (e) {
    e.preventDefault();
    selectedTextCounter++;
    var matches = [];
    for (var i = 0; i < selectedTextLocations.length; i++) {
      var m = selectedTextLocations[i];
      matches.push(m);
    }
    var fakeResponse = {
      success: true,
      matches: matches,
      navigationStrategy: navigation
    };
    onNewHighlights('__user_selected_' + selectedTextCounter, fakeResponse, STATE_REDACTED);
    $('#selectedText').html('');
    selectedTextLocations = undefined;
    $('#textSelectBlock').hide();
  });

  $('#redactAllHit').click(function (e) {
    e.preventDefault();
    updateHitsState(allKeywords[lastClickedHit.searchId].matches, STATE_REDACTED);
    updatePdfHighlights();
  });

  $('#redactHit').click(function (e) {
    e.preventDefault();
    updateHitsState([lastClickedHit], STATE_REDACTED);
    updatePdfHighlights();
  });

  $('#clearHit').click(function (e) {
    e.preventDefault();
    updateHitsState([lastClickedHit], STATE_SKIP);
    updatePdfHighlights();
  });

});
