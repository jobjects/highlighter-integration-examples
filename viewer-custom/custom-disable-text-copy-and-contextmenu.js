
function getPreferencesValue(name) {
  if (name === 'textLayerMode') {
    return 0; // this will disable text layer so there will be no text to select
  }
  else if (name === 'disableTextLayer') { // DEPRECATED. Set textLayerMode to 0 to disable the text selection layer by default.
    return true; // this will disable text layer so there will be no text to select
  }
}

// prevent context menu
document.addEventListener("contextmenu", function(e){
  e.preventDefault();
}, false);
