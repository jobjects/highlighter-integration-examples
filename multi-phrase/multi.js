$(function () {

  var hlServer = window.HighlighterBase || '';

  var $report = $('#report');

  var inProgress = false;

  $('#goButton').click(function () {
    $report.html('');
    window.open('about:blank', 'pdf');
    process();
  });

  function process() {
    if (inProgress) {
      console.log("the previous action is still in progress");
      return;
    }
    inProgress = true;

    $('#goButton').attr('disabled', true);

    var input = $('#keywords').val();
    var lines = input.match(/[^\r\n]+/g);
    var currentColor;

    if ($('#file').get(0).files.length === 0) {
      reportError("No files selected.");
      return;
    }

    reportError('Working on it...');

    var hlReq = {
      query: [],
      addNavigation: $('#addNavigation').is(":checked"),
      language: 'generic',
      // includeHits: true,
      skipCache: false
    };
    for (var i = 0; i < lines.length; i++) {
      var value = lines[i].trim();
      if (value.length === 0)
        continue;
      if (value.indexOf('#') === 0) {
        var colorCode = value.substring(1);
        if (colorCode.length === 6 && !isNaN(parseInt(colorCode, 16)))
          currentColor = colorCode;
        continue;
      }

      var q = {};
      if (currentColor) {
        q.color = currentColor;
      }
      q.query = value;
      q.type = 'phrase';
      hlReq.query.push(q);
    }

    if ($('#burnPdf').is(":checked"))
      hlReq.documentDelivery = 'serveBurnedPdf';
    else
      hlReq.documentDelivery = 'serveViewerHighlightedPdf';

    console.log('Highlighting request JSON:', hlReq);

    $('#highlightingRequestJson').val(JSON.stringify(hlReq));

    submitToHighlighter();
  }

  function reportError(error) {
    $report.html('<strong style="color: red;">' + error + '</strong>');
  }

  function submitToHighlighter() {

    // https://stackoverflow.com/questions/166221/how-can-i-upload-files-asynchronously
    $.ajax({
      // Your server script to process the upload
      url: hlServer + '/highlight-for-query',
      type: 'POST',

      // Form data
      data: new FormData($('form#hlForm')[0]),

      // Tell jQuery not to process data or worry about content-type
      // You *must* include these options!
      cache: false,
      contentType: false,
      processData: false,

      dataType: 'json',

      success: function (response) {
        console.log('response', response);

        inProgress = false;
        $('#goButton').attr('disabled', false);

        reportError('');

        if (response.error) {
          reportError(response.error);
        }

        if (response.documentUrl) {
          window.open(response.documentUrl, 'pdf');
        }
      }
    });
  }

});