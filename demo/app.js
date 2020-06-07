
angular.module('hl4me', ['ngFileUpload'], function($interpolateProvider, $locationProvider)
// angular.module('hl4me', [], function($interpolateProvider, $locationProvider)
  {
    $interpolateProvider.startSymbol('[[');
    $interpolateProvider.endSymbol(']]');

    // using locationProvider to accept query string parameters,
    // e.g. to init with a custom API URL: http://127.0.0.1:1313/demo/#?HighlighterBase=http:%2F%2Flocalhost:28081
    $locationProvider.html5Mode(false);
  })

    .controller('HighlightFormCtrl', ['$scope', '$log', '$http', '$sce', '$location', 'Upload',
      function ($scope, $log, $http, $sce, $location, $upload) {

      // check custom API URL passed via params
      var hl4meApiHost = window.HighlighterBase || 'https://demoapi.highlight4.me';
      var query = $location.search();
      if (query && query.HighlighterBase) { // an option to set Highlighter URL via parameter (fo development)
        hl4meApiHost = query.HighlighterBase;
      }

      $scope.demoDocsBase = hl4meApiHost + '/examples';

      var selectedFile, selectedXmlFile;
      var files;

      var isMobile = false;
      // mobile detection from: http://stackoverflow.com/questions/3514784/what-is-the-best-way-to-detect-a-mobile-device-in-jquery
      if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) {
        isMobile = true;
      }

      $scope.submitInProgress = false;

      $scope.language = "general";
      $scope.addNavigation = true;
      $scope.neighbourPages = 0;
      $scope.openWithPdfjs = isMobile; // auto-enable for mobiles
      $scope.docInputMethod = 'url';
      $scope.xmlInputMethod = 'url';

      function onHlResults(data) {
        clear();
        $scope.status = 'Received response';

        if (data.documentUrl) {
          //$scope.result = 'Success! Resulting document at ' + data.documentUrl;

          var url = data.documentUrl;
          /* page hash is not added by highlighter so we don't need this
          if(angular.isDefined(data.removedPagesWithoutMatches) && !data.removedPagesWithoutMatches &&
              angular.isDefined(data.pagesWithMatches) && data.pagesWithMatches.length > 0) {
            url += '#page=' + data.pagesWithMatches[0];
          }*/

          if($scope.openWithPdfjs) {
            var urlParts = url.split('#');
            // alert('open in PDF.js');
            //var pdfjsUrl = 'assets/pdfjs/web/viewer.html';
            var pdfjsUrl = 'http://mozilla.github.io/pdf.js/web/viewer.html';
            // var pdfjsUrl = 'http://localhost:28081/pdfjs/web/viewer.html';
            url = pdfjsUrl + '?file=' + encodeURIComponent(urlParts[0]);
            if(urlParts.length > 1)
              url += '#' + urlParts[1];
          }

          // alert(url);
          // window.location = url;
          // if(true) return;

          $scope.hlUrlTrusted = $sce.trustAsResourceUrl(url);

//          $log.info('trusted obj: ' + $scope.hlUrlTrusted);
        }

        if (data.error) {
          //$scope.result = data.errorCode + ': ' + data.error;
          showError(data.error);
        }

        $scope.hlResponse = data;
      }


      $scope.onFileSelect = function ($files) {
        files = $files;
        if ($files.length > 0) {
          selectedFile = $files[0];
        }
        else {
          delete selectedFile;
        }
        $log.info('Selected file: ', selectedFile);
        // $log.info('files len: ' + (files ? files.length : -1));
      };

      $scope.onXmlFileSelect = function ($xmlfiles) {
        xmlfiles = $xmlfiles;
        if ($xmlfiles.length > 0) {
          selectedXmlFile = $xmlfiles[0];
        }
        else {
          delete selectedXmlFile;
        }
        //$log.info('Selected xml file: ' + selectedXmlFile);
        // $log.info('xmlfiles len: ' + (xmlfiles ? xmlfiles.length : -1));
      };

      $scope.highlight = function ($files) {

        if($scope.submitInProgress)
          return;

        clear();
        $scope.hlUrlTrusted = $sce.trustAsResourceUrl('about:blank');

//        $log.info('*** $scope.demoWordnetThesaurus = ' + $scope.demoWordnetThesaurus);
//        $log.info('*** $scope.removePagesWithoutMatches = ' + $scope.removePagesWithoutMatches);

        var hlEndpoint = hl4meApiHost + '/highlight-for-query';

        var q = $scope.query;
        $log.log('Query: ' + q);
        if (!angular.isDefined(q) || q.trim().length == 0) {
          $log.info('No query string');
          showError('No query string specified.');
          return;
        }

        var req = {
          'query': q,
          'language': angular.isDefined($scope.language) ? $scope.language : null,
          'demoWordnetThesaurus': $scope.demoWordnetThesaurus == true
        };
        addHlOptions(req);

        var uploadParts = {};
        if(!$scope.getHlQueryInputs(req, uploadParts, true))
          return;

        sendRequestToHighlighter(hlEndpoint, req, uploadParts);
      };

      /** Highlighte PDF using highlights XML file. */
      $scope.pdfxml = function () {

        if($scope.submitInProgress)
          return;

        clear();
        $scope.hlUrlTrusted = $sce.trustAsResourceUrl('about:blank');

        var hlEndpoint = hl4meApiHost + '/highlight-for-xml';

        var req = {};
        addHlOptions(req);

        var uploadParts = {};
        if(!$scope.getHlXmlInputs(req, uploadParts, true))
          return;

        sendRequestToHighlighter(hlEndpoint, req, uploadParts);
      };

      $scope.thesaurusAvailable = function() {
        return $scope.language == 'en';
      };

      $scope.getHlQueryInputs = function(req, uploadParts, showerr) {
        return addFileOptions(req, uploadParts, 'uri', 'file', $scope.docInputMethod, $scope.url, selectedFile, undefined, showerr);
      };

      $scope.getHlXmlInputs = function(req, uploadParts, showerr) {
        return addFileOptions(req, uploadParts, 'uri', 'file', $scope.docInputMethod, $scope.url, selectedFile, undefined, showerr) &&
            addFileOptions(req, uploadParts, 'xml', 'xmlFile', $scope.xmlInputMethod, $scope.xml, selectedXmlFile, $scope.xmlInline, showerr);
      };

      function sendRequestToHighlighter(hlEndpoint, fields, uploadParts) {
        $scope.submitInProgress = true;

        if ($scope.docInputMethod == 'upload' || $scope.xmlInputMethod == 'upload') {

          var uploadData = {
            url: hlEndpoint,
            fields: fields
          };
          var files = [];
          var fileNames = [];

          for (var key in uploadParts) {
            if (uploadParts.hasOwnProperty(key)) {
              fileNames.push(key);
              files.push(uploadParts[key]);
            }
          }
          uploadData.file = files;
          uploadData.fileFormDataName = fileNames;

          var uploadLimit = ' (This demo accepts file uploads of up to 5MB.)'
          $scope.upload = $upload.upload(uploadData).
              progress(function(evt) {
                var p = parseInt(100.0 * evt.loaded / evt.total);
                $scope.status = 'Uploaded ' + p + '%' + (p == 100? ", waiting for response..." : "");
              }).
              success(function(data, status, headers, config) {
                onHlResults(data);
                $scope.submitInProgress = false;
              }).
              error(function (data, status, headers, config) {
                // called asynchronously if an error occurs
                // or server returns response with an error status.
                if (status === 413)
                  showError('Uploaded file is too large.' + uploadLimit);
                else
                  showError('Error sending request to highlighting API.' + uploadLimit);
                delete $scope.status;
                $scope.submitInProgress = false;
              });
        }
        else {
          $http({method: 'GET', url: hlEndpoint, params: fields, responseType: 'json'}).
              success(function (data, status, headers, config) {
                onHlResults(data);
                $scope.submitInProgress = false;
              }).
              error(function (data, status, headers, config) {
                // called asynchronously if an error occurs
                // or server returns response with an error status.
                showError('Error sending request to highlighting API.');
                $scope.submitInProgress = false;
              });
        }
      }

      function addFileOptions(req, uploadParts, paramName, fileParamName, inputMethod, url, selectedFile, inlineContent, showerr) {
        if (inputMethod == 'upload') {
          if (angular.isDefined(selectedFile)) {
            uploadParts[fileParamName] = selectedFile;
          } else {
            if(showerr)
              showError('Please select file to upload.');
            return false;
          }
        }
        else if (inputMethod == 'url') {
          if (angular.isDefined(url) && url.trim().length > 0) {
            req[paramName] = url;
          } else {
            if(showerr)
              showError('Please specify URL to file.');
            return false;
          }
        }
        else if (inputMethod == 'inline') {
          if (angular.isDefined(inlineContent) && inlineContent.trim().length > 0) {
            req[paramName] = inlineContent;
          } else {
            if(showerr)
              showError('Inline file content not specified.');
            return false;
          }
        }
        return true;
      }

      function addHlOptions (req) {

        req.addNavigation = $scope.addNavigation === true;
        req.removePagesWithoutMatches = $scope.removePagesWithoutMatches === true;

        if ($scope.highlightColor && $scope.highlightColor.length > 0) {
          req['pdf.highlightColor'] = $scope.highlightColor;
        }
        if ($scope.highlightMarkupOpacity && $scope.highlightMarkupOpacity.length > 0) {
          req['pdf.highlightMarkupOpacity'] = $scope.highlightMarkupOpacity;
        }
        if ($scope.highlightGsAlpha && $scope.highlightGsAlpha.length > 0) {
          req['pdf.highlightGsAlpha'] = $scope.highlightGsAlpha;
        }

        if(angular.isDefined($scope.neighbourPages))
          req.neighbourPages = $scope.neighbourPages;
      }

      function clear() {
        delete $scope.hlResponse;
        delete $scope.status;
        delete $scope.errorMessage;
      }

      function showError(msg) {
        $scope.errorMessage = msg;
      }

      function preset(data) {
        if(data.url) {
          $scope.docInputMethod = 'url';
          $scope.url = data.url;

        }
        if(data.xml) {
          $scope.xmlInputMethod = 'url';
          $scope.xml = data.xml;
        }
        if(data.xmlInline) {
          $scope.xmlInputMethod = 'inline';
          $scope.xmlInline = data.xmlInline;
        }
        if(data.query) {
          $scope.query = data.query;
        }
      }

      $scope.presetQueryExample1 = function() {
        preset({
          url: $scope.demoDocsBase + '/alice.pdf',
          query: '"rabbit hole" OR marmalade'
        });
      };
      $scope.presetQueryExample2 = function() {
        preset({
          url: 'https://en.wikipedia.org/wiki/Dinosaur',
          query: 'lizard'
        });
      };
      $scope.presetXmlExample1 = function() {
        preset({
          url: $scope.demoDocsBase + '/test.pdf',
          xml: $scope.demoDocsBase + '/test.xml'
        });
      };
      $scope.presetXmlExample2 = function() {
        preset({
          url: $scope.demoDocsBase + '/test.pdf',
          xmlInline: '<XML>\n<Body units=characters color=#ff00ff mode=active version=2>\n<Highlight>\n<loc pg=0 pos=29 len=4>\n<loc pg=0 pos=40 len=4>\n</Highlight>\n</Body>\n</xml>'
        });
      };
      $scope.presetXmlExample3 = function() {
        preset({
          url: $scope.demoDocsBase + '/alice.pdf',
          xml: $scope.demoDocsBase + '/alice-whiterabbit-verysleepy-dormouse.xml'
        });
      };

    }])

;


$(document).ready(function(){
  // Javascript to enable link to tab
  var url = document.location.toString();
  if (url.match('#')) {
      $('.nav-tabs a[href="#' + url.split('#')[1].substring(1) + '"]').tab('show');
  } 
});
