// This viewer extension script workarounds copy issue (missing whitespace)
// by utilizing PDF Highlighter server to get text for the selected region.

// IMPORTANT: THIS SCRIPT IS NOW INCLUDED WITH THE PDF VIEWER AND ENABLED BY DEFAULT
// WHEN VIEWER PARAMETER "hlCopy" IS ENABLED. IF YOU NEED TO CUSTOMIZE THIS SCRIPT'S
// BEHAVIOR, SET hlCopy=0 AND LOAD YOUR SCRIPT USING THE "script" CONFIG PARAMETER.

var textSelectionStart, textSelectionEnd;

// A hook receiving selected block start/end
function onTextSelectionChange(start, end) {
  textSelectionStart = start;
  textSelectionEnd = end;
  console.log('Selected text', start, end);
  //copySelectionToClipboard(); // to get text as soon as it's selected
}

// Listener for COPY
document.addEventListener('copy', function(e){
  // e.preventDefault(); // We could disable basic behavior but leave it as a fallback
  console.log('COPY');
  copySelectionToClipboard();
});

function copySelectionToClipboard() {
  if (textSelectionStart && textSelectionEnd) {
    getSelectedTextFromHighlighter(getPdfFileUrl(), textSelectionStart, textSelectionEnd, function (response) {
      console.log('Received response', response);
      if (response.success && response.sections.length > 0) {
        var text = response.sections[0];
        console.warn('Text to copy:', text);
        if (text && text.length > 0)
          copyTextToClipboard(text);
      }
    })
  }
}

function getSelectedTextFromHighlighter(file, start, end, callback) {
  var xhr = new XMLHttpRequest();
  var url = "../extract/area" + // URL to Highlighter's extract service
    '?uri=' + encodeURIComponent(file);
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var json = JSON.parse(xhr.responseText);
      callback(json);
    }
  };
  var data = JSON.stringify({
    sections: [{start: start, end: end}]
  });
  xhr.send(data);
}

function getPdfFileUrl() {
  return getParameterByName('file');
}

// https://stackoverflow.com/questions/901115/how-can-i-get-query-string-values-in-javascript
function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

// Credits to https://stackoverflow.com/questions/400212/how-do-i-copy-to-the-clipboard-in-javascript
function fallbackCopyTextToClipboard(text) {
  var textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    var successful = document.execCommand('copy');
    var msg = successful ? 'successful' : 'unsuccessful';
    console.log('Fallback: Copying text command was ' + msg);
  } catch (err) {
    console.error('Fallback: Oops, unable to copy', err);
  }

  document.body.removeChild(textArea);
}
function copyTextToClipboard(text) {
  if (!navigator.clipboard) {
    fallbackCopyTextToClipboard(text);
    return;
  }
  navigator.clipboard.writeText(text).then(function() {
    console.log('Async: Copying to clipboard was successful!');
  }, function(err) {
    console.error('Async: Could not copy text: ', err);
    fallbackCopyTextToClipboard(text);
  });
}
