/*
 * ai1ConvertComponents.js: Conversion of JSON component representation in AI1 .scm files
 *   to JSON component representation of AI2 .scm files. The representations are 
 *   exactly the same except for version numbers.
 * 
 * Author: Lyn Turbak (fturbak@wellesley.edu)
 *
 * History: 
 & 
 *  [lyn, 2015 Jun 14]: Created to handle issues in converting files with 
 *    Player and Twitter components. Without changing version numbers, 
 *    the former results were unloadable in AI2 due to error in upgrading
 *    versions in the Blockly.Versioning upgrader. 
 *
 */

function convert_AI1_SCM_to_AI2_SCM(AI1Filename, AI1FileContents) {
  var inputLines = AI1FileContents.split('\n');
  var outputLines = inputLines.map(function (line) { return convertLine(line); });
  return outputLines.join('\n');
}

function convertLine(line) {
  if (line[0] == '{') { // Beginning of JSON
    var componentsSpec = JSON.parse(line); 
    updateComponentsSpec(componentsSpec); // change the spec appropriately by side effect
    var outputLine = JSON.stringify(componentsSpec);
    // Used this to verify the result is really still one line:
    // console.log("Number of lines in output of JSON.stringify: " + (outputLine.split('\n').length));
    return outputLine;
  } else {
    return line; // return other lines unchanged. 
  }
}


// Update version numbers in componentsSpec by side effect
function updateComponentsSpec(componentsSpec) {
  var screenComponent = componentsSpec.Properties;
  updateComponent(screenComponent); // will recursively update all contained components
}

// Update version numbers in componentsSpec by side effect
function updateComponent(componentSpec) {
  var componentType = componentSpec["$Type"];
  var projectVersion = parseInt(componentSpec["$Version"]);
  var updateSpec = componentVersionUpdateMap[componentType];
  if (updateSpec) { // Components without an update spec need not be processed; 
                    // they just keep current version number and AI2 Form upgrader will
                    // upgrade them if necessary. 
    var minUpdatableVersion = parseInt(updateSpec.minUpdatableVersion);
    var updatedVersion = parseInt(updateSpec.updatedVersion); 
    if (projectVersion >= minUpdatableVersion) {
      if (projectVersion < updatedVersion) { // Only need update if strictly less than updated version.
        componentSpec["$Version"] = updatedVersion.toString(); // Keep as string for consistency
        log("Upated version of component type " + componentType + " from " 
            + projectVersion + " to " + updatedVersion);
      }
    } else {
      reportUserError("Version of component type " + componentType + " in this project (version "
                  + projectVersion + ") is too old to be converted, and the resulting .aia "
                  + "file will not load in AI2. You must upgrade the version of this component " 
                  + "by reloading your project into the AI1 development environment before "
                  + "saving it as a new .zip file.")
    }
  }
  var subcomponents = componentSpec["$Components"];
  if (subcomponents) {
    for (var c = 0; c < subcomponents.length; c++) {
      updateComponent(subcomponents[c]);
    }
  }
}

var componentVersionUpdateMap 
  = {
  // ActivityStarter.ActivityError was removed in version 3. Converter can't handle that.
  "ActivityStarter": {minUpdatableVersion: 3, updatedVersion: 4}, 

  // New parameters added to Flung event in version 5. Converter can't handle that.
  "Ball": {minUpdatableVersion: 5, updatedVersion: 5}, 

  // BluetoothClient.BluetoothError removed in version 3. Converter can't handle that.
  "BluetoothClient": {minUpdatableVersion: 5, updatedVersion: 5} ,

  // BluetoothServer.BluetoothError removed in version 3. Converter can't handle that.
  "BluetoothServer": {minUpdatableVersion: 3, updatedVersion: 5}, 

  // Alignment property renamed to TextAlignment in version 2. 
  // Converter *could* do this rename, but currently doesn't. 
  "Button": {minUpdatableVersion: 2, updatedVersion: 6}, 

  // New parameters added to Flung event in version 7. Converter can't handle that.
  // Current AI2 version is 10, but need AI2 upgrader to upgrade 7 to 10. 
  "Canvas": {minUpdatableVersion: 7, updatedVersion: 7}, 

  // Alignment property renamed to TextAlignment in version 2. 
  // Converter *could* do this rename, but currently doesn't. 
  "ContactPicker": {minUpdatableVersion: 2, updatedVersion: 5}, 

  // Alignment property renamed to TextAlignment in version 2. 
  // Converter *could* do this rename, but currently doesn't. 
  "EmailPicker": {minUpdatableVersion: 2, updatedVersion: 3}, 

  // Alignment property renamed to TextAlignment in version 2. 
  // Converter *could* do this rename, but currently doesn't. 
  "ImagePicker": {minUpdatableVersion: 2, updatedVersion: 5}, 

  // New parameters added to Flung event in version 6. Converter can't handle that.
  "ImageSprite": {minUpdatableVersion: 6, updatedVersion: 6}, 

  // Alignment property renamed to TextAlignment in version 2. 
  // Converter *could* do this rename, but currently doesn't. 
  "Label": {minUpdatableVersion: 2, updatedVersion: 3}, 

  // Alignment property renamed to TextAlignment in version 2. 
  // Converter *could* do this rename, but currently doesn't. 
  "ListPicker": {minUpdatableVersion: 2, updatedVersion: 9}, 

  // ShowChooseDialog and ShowTextDialog got extra param in version 2.
  // Converter *could* handle this, but currently doesn't.
  "Notifier": {minUpdatableVersion: 2, updatedVersion: 4}, 

  // Yaw property renamed to Azimuth in version 2. 
  // Converter *could* handle this, but currently doesn't.
  "OrientationSensor": {minUpdatableVersion: 2, updatedVersion: 2}, 

  // Alignment property renamed to TextAlignment in version 2. 
  // Converter *could* do this rename, but currently doesn't. 
  "PasswordTextBox": {minUpdatableVersion: 2, updatedVersion: 3},  

  // Alignment property renamed to TextAlignment in version 2. 
  // Converter *could* do this rename, but currently doesn't. 
  "PhoneNumberPicker": {minUpdatableVersion: 2, updatedVersion: 4},  

  // Player.PlayerError removed in version 3. Converter can't handle that.
  // Player.IsLooping property renamed to Player.Loop in version 5. Converter *does* handle this.
  "Player": {minUpdatableVersion: 3, updatedVersion: 6},

  // Screen.openScreenAnimation and Screen.closeScreenAnimation 
  // changed from method to property in version 11. 
  // Converter *does* handle this. 
  "Form": {minUpdatableVersion: 1, updatedVersion: 14},

  // Sound.SoundError removed in version 3. Converter can't handle that.
  "Sound": {minUpdatableVersion: 3, updatedVersion: 3},  

  // Alignment property renamed to TextAlignment in version 3. 
  // Converter *could* do this rename, but currently doesn't. 
  "TextBox": {minUpdatableVersion: 3, updatedVersion: 5},  

  // Alignment property renamed to TextAlignment in version 3. 
  // Converter *could* do this rename, but currently doesn't. 
  "Texting": {minUpdatableVersion: 3, updatedVersion: 3},  

  // TinyWebDB.showAlert removed in version 2. Converter can't handle that.
  "TinyWebDB": {minUpdatableVersion: 2, updatedVersion: 2}, 

  // In version 2, IsLoggedIn method changed to isAuthorized. Converter can't handle that.
  // In version 3, SetStatus method renamed to Tweet. Converter *does* handle that. 
  "Twitter": {minUpdatableVersion: 2, updatedVersion: 4}, 

  // VideoPlayer.VideoPlayerError removed in version 3. Converter can't handle that.
  "VideoPlayer": {minUpdatableVersion: 3, updatedVersion: 5}, 
  
  // BuildPostData method renamed to BuildRequestData in version 3. 
  // Converter *could* do this rename, but currently doesn't. 
  "Web": {minUpdatableVersion: 3, updatedVersion: 4}

}






