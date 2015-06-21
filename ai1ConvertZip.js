/*
 * Ai1convertzip.js: Top-level conversion of AI1 .zip files to AI2 .aia files. 
 * 
 * Author: Lyn Turbak (fturbak@wellesley.edu)
 * 
 * History: 
 *
 *   [lyn, 2015 May 25-26]: Create top-level conversion of .zip to .aia files
 *     by adapting code from gildas-lormeau-zip.js-4c93974/WebContent/demos/{demo1,demo2}.js
 *     Does not work until I single-thread the conversion process on the component files. 
 *     Demonstrate it works on conversion that simply uppercases files. 
 * 
 *   [lyn, 2015 Jun 06]: 
 *   + Can now convert single screen ButtonSetColor.zip to ButtonSetColor.aia.
 *     But doesn't load in AI2 because of missing .properties file.
 *     Change top-level conversion to copy .properties files and asset files (unchanged for now) 
 *     Then .aia loads in AI2! 
 * 
 *   [lyn, 2015 Jun 08]: 
 *   + Change log and error divs to have items with distinct css borders & colors 
 *     (in new file ai1Convert.css).
 *
 *   [lyn, 2015 Jun 12-14]: 
 *   + Extensive changes to user interface, including: 
 *     - add instructions, troubleshooting, etc. 
 *     - make above showable/hidable with button
 *     - add feedback on number of screens and blocks converted
 *     - distinguish conversion system errors (red) from user project errors (orange).
 *
 *   [lyn, 2015 Jun 17]: 
 *   + Better handling of input .zip. 
 *     - sort files with .blk/.scm files first, .blk before .scm files, and Screen1 files first.
 *     - Complain about .zip files that are not AI1 projects, and produce no.zip file.
 *   + Do not produce an .aia file when one of the components is too old.
 *   + Give simple progress feedback in green area with Choose File button (number of files converted so far).
 *   + Provide a cancel button to cancel conversion.
 *   + Add the  "this project has been converted by the AI1 to AI2 converter" information to the .aia file.
 *     - Plan was to put in .blk file. Did not work.
 *     - Instead put it into text block of _DO_NOT_DELETE_ConvertedFromAI1 Screen
 * 
 *   [lyn, 2015 Jun 21]: Version 1.1 of converter, which fixes atan2 and random set seed. 
 */ 

goog.require('goog.dom');

// v0.1 released to internal AI groups 2015 Jun 14 2pm
// var A1_to_AI12_Converter_Version_Number = 0.1; 

// v0.2 released to internal AI groups 2015 Jun 14 5pm
// Fixes missing next conversion in generic method calls, highlighed by Taifun's examples. 
var A1_to_AI12_Converter_Version_Number = 0.2; 

// v0.3 released to internal AI groups 2015 Jun 14 9pm
// Changed unbound reportProjectError to reportProjectError in ai1ConvertComponents.js
var A1_to_AI12_Converter_Version_Number = 0.3; 

// v0.4 used by lyn only 
// var A1_to_AI12_Converter_Version_Number = 0.4; 

// v1.0 released to world on 2015 Jun 18 
var A1_to_AI12_Converter_Version_Number = 1.0; 

// v1.1 created on 2015 Jun 21; fixes atan2 and random set seed. 
var A1_to_AI12_Converter_Version_Number = 1.1; 

function setVersionNumber(num) {
  document.querySelector("#versionNumber").innerHTML = num;
}

setVersionNumber(A1_to_AI12_Converter_Version_Number);

zip.useWebWorkers = false; // We'll load inflate.js and deflate.js directly. 

// var requestFS = this.webkitRequestFileSystem || this.mozRequestFileSystem || this.requestFileSystem;
// var URL = obj.webkitURL || obj.mozURL || obj.URL;
var zipURL = this.URL || this.webkitURL || this.mozURL;


function onerror(message) {
  reportSystemError(message);
}

function onprogress(current, total) {
  // Do nothing for progress
  // log("\n<br>Progress for " + filename + ": current= " + current + "; total=" + total + "\n<br>");
}
 
// function createTempFile(callback) {
//   var tmpFilename = "tmp.dat";
//   requestFS(TEMPORARY, 4 * 1024 * 1024 * 1024, function(filesystem) {
//     function create() {
//       filesystem.root.getFile(tmpFilename, {create : true}, function(zipFile) {
//           callback(zipFile);
//         });
//     }
      
//     filesystem.root.getFile(tmpFilename, null, function(entry) {
//         entry.remove(create, create);
//       }, 
//       create);
//     });
// }

function getZippedEntries(file, onend) {
  zip.createReader(new zip.BlobReader(file), function(zipReader) {
      zipReader.getEntries(onend);
    }, onerror);
}

var fileInput = document.getElementById("file-input");
var errorDiv = document.getElementById("errors");
var logDiv = document.getElementById("log");
var logItemsDiv = document.getElementById("logItems");
var conversionFeedbackInitialDiv = document.getElementById("conversionFeedbackInitial");
var conversionFeedbackProgressDiv = document.getElementById("conversionFeedbackProgress");
var conversionFeedbackFinalDiv = document.getElementById("conversionFeedbackFinal");
var unzipProgress = document.createElement("progress");
var creationMethodInput = document.getElementById("creation-method-input");
var downloadButton = document.getElementById("download-button");

// downloadButton.addEventListener("click", function(event) {
// 	var target = event.target, entry;
// 	if (!downloadButton.download) {
// 	  if (typeof navigator.msSaveBlob == "function") {
//             console.log("Taking navigator.msSaveBlob branch"); // *** Lyn
// 	    model.getBlob(function(blob) {
// 		navigator.msSaveBlob(blob, filenameInput.value);
// 	      });
// 	  } else {
//             console.log("Taking getBlobURL branch"); // *** Lyn
// 		var clickEvent;
// 		clickEvent = document.createEvent("MouseEvent");
// 		clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
//                 // Set below
// 		// downloadButton.href = globalBlobURL; // *** Lyn
// 		// downloadButton.download = globalBlobFilename // *** Lyn filenameInput.value;
// 		downloadButton.dispatchEvent(clickEvent);
// 		// creationMethodInput.disabled = false;
// 		// fileList.innerHTML = "";
// 	    event.preventDefault();
// 	    return false;
// 	  }
// 	}
//       }, false);

// From http://forums.asp.net/t/1151879.aspx?HttpUtility+HtmlEncode+in+javaScript+                        
// function escapeHTML (str) {
//  var div = document.createElement('div');
//  var text = document.createTextNode(str);
//  div.appendChild(text);
//  return div.innerHTML;
//}

// Adapted from http://stackoverflow.com/questions/280634/endswith-in-javascript
function endsWith(string, suffix) {
  // Do lowercases to be safe
  var lowerString = string.toLowerCase();
  var lowerSuffix = suffix.toLowerCase();
  return lowerString.indexOf(lowerSuffix, lowerString.length - lowerSuffix.length) !== -1;
}

// Returns the name of file before extension
function baseFilename(filename) {
  return filename.substring(0, filename.lastIndexOf("."))
}

// Returns the name of path before filename (including terminating slash)
function basePathname(filename) {
  return filename.substring(0, filename.lastIndexOf("/")+1)
}

// Returns the name of the file without any path or extension
function coreFilename(filename) {
  var base = baseFilename(filename);
  var splitBase = base.split('/');
  return splitBase[splitBase.length-1];
}

// Returns the name of the file without any path or extension
function screenName(filename) {
  return coreFilename(filename);
}


// Given a list of entries, filter those ending in .blk and .scm, 
// and ensure every .blk file has an associated .scm file and vice versa.
// (Or should we assume that if a .scm does not have a block file, it's empty?)
// Add to these all other files (.properties, and assets) except .yail files
// Returns all the names 
function checkAI1SourceFiles (entries) {
  var filtered = entries.filter(function (entry, index, arr) { 
      // return endsWith(entry.filename, ".blk") || endsWith(entry.filename, ".scm")
      return ! endsWith(entry.filename, ".yail") 
  });
  var basenames = {}; // Dictionary for mapping base filename for .scm and .blk files to all extensions
  filtered.forEach(function(entry) {
      var filename = entry.filename;
      var base = baseFilename(filename);
      if (endsWith(entry.filename, ".blk") || endsWith(entry.filename, ".scm")) {
        var fileList = basenames[base]
          if (fileList) {
            fileList.push(filename);
          } else {
            basenames[base] = [filename]; // associate base with singleton of name
          }
      }
    });
  // Verify each base name has both a .scm and .blk
  for (var base in basenames) {
    var fileList = basenames[base];  
    if (fileList.length == 1) {
      reportProjectError("Unpaired source file " + fileList[0]);
    }
  };
  totalScreens = Object.keys(basenames).length;
  // sort the filtered screens so that (1) .scm and .blk files come first, 
  // (2) .blk files come before .scm files
  // (3) Screen1 files come first
  filtered.sort(entryComparator);
  // console.log(filtered.map(function (entry) { return entry.filename; } ));
  if (filtered.length < 2 || 
      !(endsWith(filtered[0].filename, "Screen1.blk")) ||
      !(endsWith(filtered[1].filename, "Screen1.scm"))) {
    reportProjectErrorAndTerminateConversion(AI1SourceFilename 
                                             + " is not an AI1 project file; it does not have a Screen1."
                                             + " No .aia file was generated.");
  }
  // Squirrel away base path name
  projectBasePathName = basePathname(filtered[0].filename);
  return filtered; // They are filtered and sorted at this point.
}

function entryComparator(entry1, entry2) {
  return filenameComparator(entry1.filename, entry2.filename);
}

var testFilenames = ["Screen3.blk", "Screen2.properties", "cat.png", "Screen1.scm", "Hello.scm", "Hello.blk", 
                     "Goodbye.blk", "Screen3.scm", "Foo.blk", "dog.png", "Screen3.properties", 
                     "purr.wav", "Screen2.scm", "Goodbye.scm", "Screen2.blk", "Screen1.blk", "Foo.scm"];

function testSort () {
  testFilenames.sort(filenameComparator);
  return testFilenames;
}

function filenameComparator(fn1, fn2) {
  result = 0;
  if (endsWith(fn1, "Screen1.blk")) {
    result = -1;
  } else if (endsWith(fn2, "Screen1.blk")) {
    result = 1;
  } else if (endsWith(fn1, "Screen1.scm")) {
    result = -1;
  } else if (endsWith(fn2, "Screen1.scm")) {
    result = 1;
  } else if (endsWith(fn1, ".blk") || endsWith(fn1, ".scm")) {
    if (endsWith(fn2, ".blk") || endsWith(fn2, ".scm")) {
      if (screenName(fn1) < screenName(fn2)) {
        result = -1;
      } else if (screenName(fn1) == screenName(fn2)) {
        if (fn1 < fn2) {
          result = -1;
        } else if (fn1 == fn2) {
          result = 0;
        } else {
          result = 1;
        }
      } else {
        result = 1;
      }
    } else {
      result = -1;
    }
  } else if (endsWith(fn1, ".properties")) {
    if (endsWith(fn2, ".blk") || endsWith(fn2, ".scm")) {
      result = 1;
    } else if (endsWith(fn2, ".properties")) {
      if (fn1 < fn2) {
        result = -1;
      } else if (fn1 == fn2) {
        result = 0;
      } else {
        result = 1;
      }
    } else {
      result = -1;
    }
  } else if (endsWith(fn2, ".blk") || endsWith(fn2, ".scm") || endsWith(fn2, ".properties")) {
    result = 1; 
  } else {
    if (fn1 < fn2) {
      result = -1;
    } else if (fn1 == fn2) {
      result = 0;
    } else {
      result = 1;
    }
  }
  console.log("filename comparator: " + fn1 + ", " + fn2 + " => " + result);
  return result;
}

function AI1ConversionInfoFileName(extension) {
  return projectBasePathName + "_DO_NOT_DELETE_ConvertedFromAI1" + extension;
}

function AI1ConversionInfoScmFileContents() {
  return ("#|\n" 
          + "$JSON\n"
          + '{"YaVersion":"75","Source":"Form","Properties":{"$Name":"Screen1","$Type":"Form","$Version":"14","Uuid":"0","Title":"Screen1","$Components":[]}}\n'
          + "|#");
}

function AI1ConversionInfoBkyFileContents() {
  return ('<xml xmlns="http://www.w3.org/1999/xhtml">\n'
    + '  <block id="811" type="text">\n'
    + '    <field name="TEXT">Converted by AI1 to AI2 converter version ' + A1_to_AI12_Converter_Version_Number + '</field>\n'
    + '  </block>\n'
    + '  <yacodeblocks ya-version="75" language-version="17"></yacodeblocks>\n'
          + '</xml>');
}

function reportSystemError(msg) {
  var errorItem = goog.dom.createDom('div');
  errorItem.setAttribute("class", "system_error_item");
  errorDiv.appendChild(errorItem);
  if (currentScreenName && currentFileName) {
    errorItem.appendChild(goog.dom.createTextNode("System error from screen " + currentScreenName
                                                  + " in file " + currentFileName + ": " + msg));
  } else {
    errorItem.appendChild(goog.dom.createTextNode("System error: " + msg));
  }
}

function reportSystemErrorAndTerminateConversion(msg) {
  reportSystemError(msg); 
  feedbackFinal(" No .aia file was generated.");
  resetButtons();
  throw new AI1ConversionEndError("Ending conversion after system error message: " + msg); 
}

function reportProjectError(msg) {
  var errorItem = goog.dom.createDom('div');
  errorItem.setAttribute("class", "user_error_item");
  errorDiv.appendChild(errorItem);
  if (currentScreenName && currentFileName) {
    errorItem.appendChild(goog.dom.createTextNode("Project error from screen " + currentScreenName
                                                  + " in file " + currentFileName + ": " + msg));
  } else {
    errorItem.appendChild(goog.dom.createTextNode("Project error: " + msg));
  }
}

function reportProjectErrorAndTerminateConversion(msg) {
  reportProjectError(msg); 
  feedbackFinal(" No .aia file was generated.");
  resetButtons();
  throw new AI1ConversionEndError("Ending conversion after project error message: " + msg); 
}

function reportWarning(msg) {
  var warningItem = goog.dom.createDom('div');
  warningItem.setAttribute("class", "warning_item");
  errorDiv.appendChild(warningItem);
  if (currentScreenName && currentFileName) {
    warningItem.appendChild(goog.dom.createTextNode("Warning from screen " + currentScreenName 
                                                    + " in file " + currentFileName + ": " + msg));
  } else {
    errorItem.appendChild(goog.dom.createTextNode("Warning: " + msg));
  }
}

function log(msg) {
  addLogItem("log_item", msg);
}

function logInput(msg) {
  addLogItem("log_item_input", msg);
}

function logOutput(msg) {
  addLogItem("log_item_output", msg);
}

function addLogItem(cssClass, msg) {
  var logItem = goog.dom.createDom('div');
  logItem.setAttribute("class", cssClass);
  logItemsDiv.appendChild(logItem);
  // logItem.appendChild(goog.dom.createTextNode(msg));
  logItem.innerHTML = msg;
}

function feedbackInitial(msg) {
  conversionFeedbackInitialDiv.innerHTML = msg
}

function feedbackProgress(msg) {
  conversionFeedbackProgressDiv.innerHTML = msg
}

function feedbackFinal(msg) {
  conversionFeedbackFinalDiv.innerHTML = msg
}

function resetPage() {
  logItemsDiv.innerHTML = '';
  errorDiv.innerHTML = '';
  conversionFeedbackInitialDiv.innerHTML = '';
  conversionFeedbackProgressDiv.innerHTML = '';
  conversionFeedbackFinalDiv.innerHTML = '';
  hideCancelButton();
}

function resetButtons() {
  fileInput.disabled = false; // Re-enable button to convert another source file. 
  fileInput.value = null; // Resset to null so can re-select same file again.
  hideCancelButton();
}

/*
function processScmFileContents(scmText) {
  // return scmText.toUpperCase();
  return scmText; // Identity function (for now)
}

function processBlkFileContents(blkText) {
  // return blkText.toUpperCase();
  return convert_A11_XML_to_AI2_XML(blkText)
}
*/

// Return .scm/.bky filename corresponding to .scm/.blk file
function convertAI1ToAI2Filename(AI1Filename) {
  if (endsWith(AI1Filename, ".scm") || endsWith(AI1Filename, ".properties")) {
    return AI1Filename;
  } else if (endsWith(AI1Filename, ".blk")) {
    return baseFilename(AI1Filename) + ".bky";
  } else {
    reportSystemError("convertAI1ToAI2Filename expected .scm or .blk file but got " + AI1Filename);
  }
}

// Return .aia filename corresponding to .zip filename
function convertAI1ToAI2SourceFilename(AI1Filename) {
  if (endsWith(AI1Filename, ".zip")) {
    return baseFilename(AI1Filename) + ".aia"; 
  } else {
    reportProjectError("convertAI1ToAI2SourceFilename expected .zip file but got " + AI1Filename);
  }
}

var currentBlocksConverted = 0;
var totalBlocksConverted = 0;
var screensConverted = 0;
var totalScreens = 0; // Number of screens that need to be converted.
var screenComponentFeatures = {};
var projectBasePathName = ''

// Convert the contents (i.e., a string) of an AI file. 
// Just a stub for now. 
function convertAI1ToAI2FileContents(AI1Filename, AI1FileContents) {
  // return AI1FileContents.toUpperCase();
  // return AI1FileContents;
  if (endsWith(AI1Filename, ".blk")) {
    converted = convert_AI1_XML_to_AI2_XML(AI1Filename, AI1FileContents);
    currentBlocksConverted = converted.numBlocks;
    totalBlocksConverted += converted.numBlocks;
    screenComponentFeatures[currentScreenName] = converted.componentFeaturesMap; // Keep track of which component events, methods, and properties 
                                                                                 // were used in .blk file to inform upgrading of .scm file
    return converted.xml;
  } else if (endsWith(AI1Filename, ".scm")) {
    return convert_AI1_SCM_to_AI2_SCM(AI1Filename, AI1FileContents);
  } else {
    return AI1FileContents; // .properties file
  }
}

// Magic for downloading .aia file. Dynamically create link and simulate click on it. 
// Adapted from gildas-lormeau-zip.js-4c93974/WebContent/demos/demo1.js
function downloadAI2SourceFile(AI2Filename, AI2ZippedSourceBlobURL) {
  var link = document.createElement('a');
  link.href = AI2ZippedSourceBlobURL; 
  link.download = AI2Filename;
  var clickEvent = document.createEvent("MouseEvent");
  if (conversionInProgress) {
    clickEvent.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    link.dispatchEvent(clickEvent);
  }
}

// Globalize these vars to refer to them from other functions
var AI1SourceFilename; 
var AI2SourceFilename;
var currentFileName; 
var currentScreenName;
var convertedAtLeastOneScreenFile; 

// Processes an AI1 source file (.zip) by unzipping it, converting all its .scm and .blk files
// to corresponding AI2 files, copyings assets and properties (but not .yail files),
// and zipping the results into an .aia file. 
// TODO:
// (1) Error handling when have error in one file along the way. 
// (2) Handle multiple .zip files
// (3) Handle a .zip file of .zip files
function processAI1SourceFile () {
  fileInput.disabled = true; // disable file input button

  // reset global counters
  currentBlocksConverted = 0;
  totalBlocksConverted = 0;
  screensConverted = 0;
  totalScreens = 0;  
  convertedScreens = {};
  screenComponentFeatures = {};
  projectBasePathName = ''; 

  var AI1SourceFile = fileInput.files[0];
  getZippedEntries(AI1SourceFile, function(entries) {
      resetPage(); // clear log and error messages
      AI1SourceFilename = AI1SourceFile.name;
      if (!endsWith(AI1SourceFilename, ".zip")) {
          reportProjectError("AI1 project source file names end in .zip . " 
                      + AI1SourceFileName + " is not an AI1 project source file");
          return;
      }
      AI2SourceFilename = convertAI1ToAI2SourceFilename(AI1SourceFilename);
      var AI1SourceEntries = checkAI1SourceFiles(entries); 
      var numberOfFilesToConvert = AI1SourceEntries.length;
      feedbackInitial(AI1SourceFilename + " is being converted to " + AI2SourceFilename + " ... "); 
      showCancelButton(); // also sets conversionInProgress to true
      log("Converting " + AI1SourceFilename + " to " + AI2SourceFilename 
          + ".<br>" + AI1SourceEntries.length + " files to convert:<br>" 
          + AI1SourceEntries.map(function(entry) { return entry.filename; }).join("<br>") + "<br>");
      var numberOfFilesConvertedSoFar = 0; 
      if (numberOfFilesToConvert == 0) {
        reportProjectError(zipFileName + " does not appear to be an App Inventor Classic source file. It does not have any .scm or .blk files.");
        return; 
      }
      zip.createWriter(new zip.BlobWriter("application/zip"), function(AI2Writer) { // Creates zip writer for AI2 source files (.aia)

          // Process entries one by one, converting each and adding to zip file in single-threaded fashion.
          // A previous version that used AI1SourceEntries.forEach(function did *not* work, because
          // did not single-thread the adding of converted files to zip file. 
          function processNextEntry() {
            if (! conversionInProgress) {
              return;
            }
            if (numberOfFilesConvertedSoFar == numberOfFilesToConvert) { // All files converted

              // Add special file that indicates this is the result of conversion
              AI2Writer.add(AI1ConversionInfoFileName(".scm"), new zip.TextReader(AI1ConversionInfoScmFileContents()), function () {
                  AI2Writer.add(AI1ConversionInfoFileName(".bky"), new zip.TextReader(AI1ConversionInfoBkyFileContents()), function () {
                      AI2Writer.close(function(AI2ZippedSourceBlob) {
                          // downloadButton.href = zipURL.createObjectURL(AI2ZippedSourceBlob) // *** Lyn filenameInput.value;
                          // downloadButton.download = convertAI1ToAI2SourceFilename(AI1SourceFilename); // *** Lyn
                          downloadAI2SourceFile(AI2SourceFilename, 
                                                zipURL.createObjectURL(AI2ZippedSourceBlob));
                          feedbackFinal("done!<br>"
                                        + "Converted " + numberOfFilesConvertedSoFar + " out of " + numberOfFilesToConvert + " files; "
                                        + screensConverted + " out of " + totalScreens + " screens; "
                                        + totalBlocksConverted + " blocks.<br>"
                                        + " The file " + AI2SourceFilename + " has been downloaded.");
                          resetButtons();
                        }); // end AI2Writer.close
                    });
                });
            } else { // numberOfFilesConvertedSoFar < numberOfFilesToConvert
              entry = AI1SourceEntries[numberOfFilesConvertedSoFar];
              var AI1Filename = entry.filename;
              currentFileName = AI1Filename;
              if // (endsWith(entry.filename, ".blk") || endsWith(entry.filename, ".scm") || endsWith(entry.filename, ".properties")) {
                (endsWith(entry.filename, ".blk") || endsWith(entry.filename, ".scm")) {
                currentScreenName = coreFilename(AI1Filename);
                entry.getData(new zip.TextWriter(), function(AI1FileContents) { // AI1FileContents is just a string
                    logInput("Contents  of input file " + AI1Filename + ":<br>" + prettifyContents(AI1Filename, AI1FileContents));
                    var AI2Filename = convertAI1ToAI2Filename(AI1Filename);
                    var AI2FileContents = convertAI1ToAI2FileContents(AI1Filename, AI1FileContents);
                    AI2Writer.add(AI2Filename, new zip.TextReader(AI2FileContents), function () {
                        // AI2Writer.add(AI1Filename, new zip.TextReader("foo" + AI1Filename + "bar"), function () {
                        numberOfFilesConvertedSoFar++; 
                        // Remember which files of a screen have been converted.
                        var screenName = coreFilename(AI1Filename);
                        var converted = convertedScreens[screenName];
                        if (converted) {
                          converted.push(AI1Filename);
                        } else {
                          converted = [AI1Filename];
                          convertedScreens[screenName] = converted;
                        }
                        if (converted.length == 2) {
                          screensConverted++; 
                        }
                        if (endsWith(entry.filename, ".blk")) {
                          logOutput("Contents of converted file " + AI2Filename + "(" + currentBlocksConverted + "blocks):<br>" 
                                    + prettifyContents(AI2Filename, AI2FileContents));
                        } else {
                          logOutput("Contents of converted file " + AI2Filename + ":<br>" 
                                    + prettifyContents(AI2Filename, AI2FileContents));
                        }
                        log("Converted so far: " + numberOfFilesConvertedSoFar + " out of " + numberOfFilesToConvert + " files; "
                            + screensConverted + " out of " + totalScreens + " screens; "
                            + totalBlocksConverted + " blocks.");
                        feedbackProgress("converted " + numberOfFilesConvertedSoFar + " out of " + numberOfFilesToConvert + " files ... ");
                        processNextEntry(); // Process next entry in list of entries
                      }); // end AI2Writer.add 
                  }, onprogress); // end entry.getData for .blk/.scm/.properties
              } else { // copy an asset as is without modification
                entry.getData(new zip.BlobWriter(), function(blob) { 
                    AI2Writer.add(AI1Filename, new zip.BlobReader(blob), function () {
                        numberOfFilesConvertedSoFar++; 
                        log("Converted filename is " + AI1Filename + "<br>Converted file is exactly the same as the input file.<br>"
                            + "Converted so far: " + numberOfFilesConvertedSoFar + " out of " + numberOfFilesToConvert + " files; "
                            + screensConverted + " out out " + totalScreens + " screens; "
                            + totalBlocksConverted + " blocks.");
                        feedbackProgress("converted " + numberOfFilesConvertedSoFar + " out of " + numberOfFilesToConvert + " files ... ");
                        processNextEntry(); // Process next entry in list of entries
                      }); // end AI2Writer.add 
                  }, onprogress); // end entry.getData for blobs (assets)
              } // end inner if/else
            } // end outer if/else
          } // end processNextEntry()

          // Start entry processing by processing first entry in list of entries
          feedbackProgress("converted 0 out of " + numberOfFilesToConvert + " files ... ");
          processNextEntry();

        }, onerror); // end zip.createWriter
    }); // end getZippedEntries
} // end processAI1Files

/* 
// This wrapping doesn't work because of callbacks! 
function wrappedProcessAI1SourceFile() {
  try {
    processAI1SourceFile();
  } catch (exception) {
    message = exception.message;
    alert(message);
  } finally {
    fileInput.disabled = false; // Re-enable button to convert another source file. 
    fileInput.value = null; // Resset to null so can re-select same file again.
 }
}
*/

/* 
  } catch (exception) {
    message = exception.message; 
    if (exception instanceof AI1ConversionSystemError) {
      reportSystemError(exception.message);
    } else if (exception instanceof AI1ConversionProjectError) {
      reportProjectError(exception.message);
    } 
    feedback("*** No .aia file generated because of error(s) ***");
  } finally 
*/

function prettifyContents(filename, contents) {
  if (endsWith(filename, '.blk') || endsWith(filename, '.bky')) {
    return escapeHTML(prettifyXMLText(contents))
  } else {
    return contents
  }
}


fileInput.addEventListener('change', processAI1SourceFile, false);

function AI1ConversionSystemError(message) {
  this.name = "AI1ConversionSystemError";
  this.message = (message || "");
}

AI1ConversionSystemError.prototype = new Error();
AI1ConversionSystemError.prototype.constructor = AI1ConversionSystemError;

function AI1ConversionProjectError(message) {
  this.name = "AI1ConversionProjectError";
  this.message = (message || "");
}

AI1ConversionProjectError.prototype = new Error();
AI1ConversionProjectError.prototype.constructor = AI1ConversionProjectError;

function AI1ConversionEndError(message) {
  this.name = "AI1ConversionEndError";
  this.message = (message || "");
}

AI1ConversionEndError.prototype = new Error();
AI1ConversionEndError.prototype.constructor = AI1ConversionEndError;

// Cancel button is special; controls whether conversion is in progress
var cancelButton = document.getElementById("cancelButton");
var conversionInProgress = false;

function showCancelButton() {
  // cancelButton.style.display = "inline";
  cancelButton.disabled = false;
  conversionInProgress = true;
}

function hideCancelButton() {
  // cancelButton.style.display = "none";
  cancelButton.disabled = true;
}

function cancelConversion () {
  feedbackFinal(" Conversion canceled. No .aia file was generated.");
  conversionInProgress = false;
  resetButtons(); // Will hide cancelButton
}

cancelButton.addEventListener('click', cancelConversion); 


// Make the button with id buttonId a show/hide button for the div with id divId. 
// "Show " + buttonText appears on the button when the div is hidden; 
// "Hide "+ buttonText appears on the button when the div is shown;
// showDivInitially is a boolean that controls whether div is shown initially.
function makeButtonShowHide (buttonId, divId, buttonText, showDivInitially) {
  var buttonElt = document.getElementById(buttonId);
  var divElt = document.getElementById(divId);
  var showText = "Show " + buttonText;
  var hideText = "Hide " + buttonText;
  function show() {
    buttonElt.innerHTML = hideText; 
    divElt.style.display = "block";
  }
  function hide() {
    buttonElt.innerHTML = showText; 
    divElt.style.display = "none";
  }
  if (showDivInitially) {
    show();
  } else {
    hide();
  }
  buttonElt.onclick = function () {
    if (buttonElt.innerHTML == showText) {
      show();
    } else {
      hide();
    }
  }
}

hideCancelButton();
makeButtonShowHide("instructionsButton", "instructions", "Instructions", false);
makeButtonShowHide("troubleshootingButton", "troubleshooting", "Troubleshooting Hints", false);
makeButtonShowHide("issuesButton", "issues", "Known Issues with this Version of the Converter", false);
makeButtonShowHide("versionsButton", "versions", "Version Notes", false);
//makeButtonShowHide("logButton", "log", "Conversion Log", true);
makeButtonShowHide("logButton", "log", "Conversion Log", false);

