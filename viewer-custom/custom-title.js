
function setViewerTitle(title) {
  document.title = 'Search Results - ' + title;
}
// this script may have been loaded after the title is already set so we invoke it right away with the current title
setViewerTitle(document.title);

