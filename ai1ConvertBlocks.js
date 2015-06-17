/*
 * ai1ConvertBlocks.js: Conversion of XML block representation in AI1 .blk files
 *   to XML block representation of AI2 .bky files. 
 * 
 * Author: Lyn Turbak (fturbak@wellesley.edu)
 *
 * Implementation History: 
 * 
 *  [lyn, 2014 Jul 06-18]: Develop main architecture for converting .blk to .bky XML representations, 
 *     including details for leaf blocks, simple component events, component property setters. 
 * 
 *  [lyn, 2015 Jun 03]: Swap in code architecture from last July.
 * 
 *  [lyn, 2015 Jun 06]: Fix escapeHTML to handle spaces and newlines
 * 
 *  [lyn, 2015 Jun 07]: Implement component property getters 
 * 
 *  [lyn, 2015 Jun 08]: Da beginning of da big push: 
 *    + handle simple binary operator blocks
 *    + special case handling of \n in text block string
 *    + handle empty sockets in operators blocks
 *    + successfully convert A1ConvertTestEquals.zip and AIConvertEmptySockets.zip
 *    + generalize operator conversion to expOp, which handles all expression operators, 
 *        including those with expandable number of args (e.g., make-text). 
 *    + fix bug in domToPrettyText (trimming lines) so that .blk XML displays OK. 
 *    + successfully test conversion of all text operators with empty sockets (AIConvertTextOps.zip)
 *    + checkout AI1 v134a to explore component database. 
 *      - initially think simple_components.js contains database, but this is really from AI2
 *        and is still in repository since I didn't do ant clean! 
 *      - learn on Jun 09 that the *real* database is in components/build/classes/XmlComponentDescription/ya_lang_def.xml
 *    + compare canvas-with-ball programs in AI1 and AI2 in preparation for conversion. 
 * 
 *  [lyn, 2015 Jun 09]: more work on da big push: 
 *    + Although AI1 v134a has a simple_component.json file, it only has component properties, 
 *      and not events or methods. Event/methods are in components/build/classes/XmlComponentDescription/ya_lang_def.xml
 *      - Copy this file to AI1_v134a_ya_lang_def.xml
 *      - it's too painful to read and process XML file in JavaScript, so ...
 *      - create python file XMLLangDefToJsonComponentSpecs.py that processes xml lang def in AI1_v134a_ya_lang_def.xml
 *          to produce json component spec AI1_v134a_component_specs defined in AI1_v134a_component_specs.js.
 *          This json summarizes key aspects of events and methods. 
 *      - Below, the function addComponentEntriesToAI1ConversionMap processes these specs and adds them to AI1ConversionMap
 *    + Handle component event and (nongeneric) methods, which takes a long time because of component spec issues above. 
 *      Also, handling associating AI1 argument declaration names with correct event handler/procedure parameter names
 *      is tricky, and requires sorting blocks by declaraion status. 
 *    + Handle event parameters and local variable declarations ("name" blocks of genus "argument")
 *        and local variable getters ("value" blocks of genus "getter"). One tricky aspect is handling
 *        orphaned getter blocks -- getter where associated where "name" block isn't plugged in or is in different scope.
 *        Handle these by creating getters beginning with name "*orphanedArg".
 * 
 *  [lyn, 2015 Jun 10]: yet more work on da big push: 
 *    + Fix bug in handling of orphaned arguments
 *    + Convert global declarations, global getters, global setters
 *    + Convert all math ops
 *    + Disaster: fast 13" macbook becomes unusable, must move to older, slower 15" macbook.
 *    + Convert ifelse (in straightforward way, maybe can be fancier later)
 *    + Simplify passing of maps between conversion functions by bundling in a single maps variable.
 *    + Convert procedure declarations; much code can be shared betweedn void and fruitful versions.
 * 
 *  [lyn, 2015 Jun 11]: getting closer to the end .. 
 *    + Back to work on fast 13" laptop. Yay!
 *    + Convert procedure callers. Simpler than I thought because AI1 XML has explicit arg names in 
 *      BlockConnectors, so there's no need to get them from procedure declaration. 
 *    + Convert all ops for lists and colors
 *    + Fix handling of expandables in operator conversion
 *    + Clean up conversion code and AI1Conversion map. 
 *    + Convert all logic ops. "and" and "or" are tricky, because their args are expandables
 *      in AI1 but not mutables in AI2. So have to convert list of args to linear tree of
 *      binary operators. 
 * 
 *  [lyn, 2015 Jun 12]: finally wrap up draft implementation and start testing
 *    + Complete conversion of control ops (straightforward): loops, choose, screen ops
 *    + Use try/catch to report errors in convertBlock
 *    + Test screen events, methods and operators with two screens. Everything works fine
 *      except openScreenAnimation and closeScreenAnimation methods, which have been
 *      converted from methods to properties in Form version 11. I don't handle these 
 *      correctly yet. 
 *    + Convert generic objects, methods, property getters/setters
 *    + Handle comments, collapsed blocks, deactivated/disabled blocks. 
 *    + All functionality now converted and tested on simple tests, now begin "real"
 *      tests on significant AI1 programs from my Fall 2011 course. 
 * 
 *  [lyn, 2015 Jun 13]: much more testing
 *    + Test on AI1 projects provided by power users, some of which have thousands
 *      of blocks, some of which have many (e.g. 37) screens
 *    + Investigate and handle color None by converting to (make-color (make-list 255 255 255 0))
 *    + Discover following problems between AI1 v134a and AI2 nb120 (mid Dec. 2013, one of earliest
 *      releases of AI2 (after which AI2 upgrader will handle things): 
 *      - TinyDB.getValue has extra notFound argument in AI2. This is not even expressed in 
 *        component version numbers, but I caught it in power user testing
 *      - Screen.openScreenAnimation and Screen.closeScreenAnimation changed from methods
 *        to properties. I had stumbled on this before. But not handled by upgrader,
 *        so I need to handle it manually
 *      - Player.IsLooping property renamed to Player.Loop. Again, not handled by 
 *        upgrading, so converter needs to handle.
 *      - Twitter.SetStatus method renamed to Twitter.Tweet. Again, not handled by 
 *        upgrading, so converter needs to handle.
 *      The above were found by exhaustive manual git branch comparisons between nb120
 *      and v134a in IntelliJ. 
 * 
 *  [lyn, 2015 Jun 14]: 
 *   + Fix all issues discovered last night
 *   + Old component version numbers are preventing upgrading when loading converted 
 *     projects to AI2. I implement .scm converter that (1) updates component versions
 *     to more recent versions when it's safe to do so and (2) reports an error in 
 *     an orange box when it's not safe. 
 *   + In general, now distinguish between system errors (red) and user/project errors (orange).
 *   + Converter now appears to work on all my test cases and those of powerusers.
 *     Some converter poweruser projects have runtime errors, but it's not clear they're
 *     a result of conversion.
 *   + 2pm: Post converter version v0.1 to internal AI groups. 
 *   + Fix missing next processing in generic method calls highlighted by Taifun's examples. 
 *   + 5pmish: Post converter version v0.2 to internal AI groups. 

 * TODO: 
 *   ==> SOMETHING IN XML TO SAY IT WAS CONVERTED!!!
 *   + Test various procedure error cases
 *   + Problematic blocks:
 *     - distinguishing math and numeric equality
 *   + Other problems
       - why does PaintPoint.zip from 2011 fail, but one reloaded succeeds. 
 *   + param names that change in AI2
 *   + Test version upgrading issues
 *   + Wish list: 
 *     - recording usage stats
 *     - Fancier handling of if
 */ 

goog.require('goog.dom');

// Returns object {xml: ..., numBlocks: ...}
function convert_AI1_XML_to_AI2_XML(filename, AI1_XML) { // Both AI1_XML and AI2_XML are strings
  if (AI1_XML.length == 0) {
    reportUserError("AI1 file " + filename + " is empty!");
    return {xml: goog.dom.createDom('xml'), numBlocks: 0}; 
  }
  try {
    var parseBlocksResult  = parseBlocks(AI1_XML);
    var blocksAndStubs = parseBlocksResult.blocksAndStubs;
    var componentTypeMap = parseBlocksResult.componentTypeMap;
    var AI1_IdMap = makeBlockIdMap(blocksAndStubs); 
  } catch(err) {
    reportSystemError("Caught error in parseBlocks: " + err.message); 
    return {xml: goog.dom.createDom('xml'), numBlocks: 0}; 
  }
    // var keys = [];
    // for (var key in IdMap) {
    //     keys.push(key);
    // }
    // alert(JSON.stringify(keys));
  try {
    var converted = convertBlocks(AI1_IdMap, componentTypeMap); 
    return {xml: domToPrettyText(converted.xml), numBlocks: converted.numBlocks}
  } catch(err) {
    reportSystemError("Caught error in convertBlocks: " + err.message); 
    return {xml: goog.dom.createDom('xml'), numBlocks: 0}; 
  }
}

// Return the blocks & block stubs from the XML for an AI1 file. 
function parseBlocks(text) {
  var oParser = new DOMParser();
  var dom = oParser.parseFromString(text, 'text/xml');
  var yaCodeBlocks = getChildByTagName("YACodeBlocks", dom);

  var pages = getChildByTagName("Pages", yaCodeBlocks); 
  var page = getChildByTagName("Page", pages); 
  var pageBlocks = getChildByTagName("PageBlocks", page); 

  var youngAndroidMaps = getChildByTagName("YoungAndroidMaps", yaCodeBlocks); 
  var youngAndroidUuidMap = getChildByTagName("YoungAndroidUuidMap", youngAndroidMaps); 
  var uuidEntries = youngAndroidUuidMap.getElementsByTagName("YoungAndroidUuidEntry");
  var componentTypeMap = {};
  for (var i = 0, entry; entry = uuidEntries[i]; i++) {
    componentTypeMap[entry.getAttribute("component-id")] = entry.getAttribute("component-genus");
  }
  // var yacodeblocks = getFirstElementChild("yacodeblocks", dom); 
  // var pages = getFirstElementChild("pages", yacodeblocks); 
  // var page = getFirstElementChild("page", pages); 
  // var pageblocks = getFirstElementChild("pageblocks", page); 
  return {"blocksAndStubs": pageBlocks.children, "componentTypeMap": componentTypeMap};
}

var maxIdSoFar = 0; // Keep track of largest Id seen, for generating new ones. 

// Given a list of AI1 blocks and block stubs, return a map of each id to its corresponding block 
function makeBlockIdMap(blocksAndStubs) {
  var IdMap = {};
  for (var i = 0, blockOrStub; blockOrStub = blocksAndStubs[i]; i++) {
    var block = getBlock(blockOrStub); 
    var id = block.attributes.getNamedItem("id").value;
    maxIdSoFar = Math.max(maxIdSoFar, id); 
    IdMap[id] = blockOrStub; // When stub, put stub here!
  }
  return IdMap;
}

/* // No longer seems necessary ...
// Given a blockIdMap, return a map of procedure declaration names to their ids
// This is used by conversion process to ensure that procedure declaration argument names
// are processed before callers of the procedure are processed.
function makeProcNameIdMap(blockIdMap) {
  var ids = Object.keys(blockIdMap); 
  var procNameIdMap = {} 
  for (var i = 0; i < ids.length, i++) {
    var id = id[i]; 
    var block = blockIdMap[id];
    var genus = block.getAttribute("genus-name");
    if (genus == "define" || genus == "define-void") {
      var procName = getLabelText(block);
      procNameIdMap[procName] = id;
    }
  }
  return procNameIdMap;
}
*/

// Return next unused id. We only call this after blockIdMap is created, which simplifies implementation.
function nextId() {
  maxIdSoFar++;
  return maxIdSoFar;
}

// Returns a list of blocks and stubs ordered by the genus of the underlying block. 
// Declaration blocks (event handlers, procedures definitions, global variable declarations)
// come before non-declaration blocks
function sortedBlocks(idMap) {
  var keys = Object.keys(idMap); 
  var blocks = [];
  for (var i = 0; i < keys.length; i++) {
    blocks.push(getBlock(idMap[keys[i]]));
  }
  blocks.sort(blockComparator); 
  return blocks; 
}

// Comparator for ordering block. All declaration blocks (global variables, 
// event handlers, procedures) should come before  non-declaration blocks (everything else). 
// This guarantees that variable declarations will be processed before their uses. 
function blockComparator(blk1, blk2) { // blk1 and blk2 are blocks, not stubs
  var id1 = blk1.getAttribute("id");
  var id2 = blk2.getAttribute("id");
  if (isDeclaration(blk1)) {
    if (isDeclaration(blk2)) {
      return id1 - id2; // arbitrarily sort declarations by id
    } else {
      return -1; // declarations precede non-declarations;
    }
  } else { // blk1 not a declaration
    if (isDeclaration(blk2)) {
      return 1;  // declarations precede non-declarations;
    } else {
      return id1 - id2; // arbitrarily sort non-declarations by id
    }
  }
}

function isDeclaration(block) { // block, not a stub
  var genus = block.getAttribute("genus-name");
  var spec = AI1ConversionMap[genus];
  if (spec) {
    return spec.kind == "declaration"; // i.e., true for component events, procedure declarations, global variable declarations
  } else {
    return false;
  }
}

// inputIdMap associates AI1 block ids with the AI1 block
// outputIdMap associates AI1 block ids with the converted AI2 block
// Returns object {xml: ..., numBlocks: ...}
function convertBlocks(inputIdMap, componentTypeMap) {
  var sorted = sortedBlocks(inputIdMap); 
  var sortedBlockIds = sorted.map(function (block) { return block.getAttribute("id"); });
  // console.log("sortedBlockIds: " + sortedBlockIds);
  var outputIdMap = {}; // Map id of AI1 input block to AI2 output block, effectively memoizing conversion
  var parentMap = {}; // Map id of AI input block to parent id of AI1 input block. Used to determine top level AI input blocks
                      // = top level AI2 output blocks
  var variableMap = {}; // Map variable "name" block (genus "argument") to the event-handler declaration name it should be. 
  /* // No longer seems necessary ...
  var procNameIdMap = makeProcNameIdMap(inputIdMap); // Map procedure names to their ids
  var procNameParamsMap = {}; // Map each procedure names to an array of its parameter names. 
  */ 
  
  // Bundle up all maps into an object to reduce number of arguments passed around in conversion
  var maps = {inputIdMap: inputIdMap, outputIdMap: outputIdMap, componentTypeMap: componentTypeMap, 
	      parentMap: parentMap, variableMap: variableMap, 
              // procNameIdMap: procNameIdMap, procNameParamsMap: procNameParamsMap // // No longer seems necessary ...
             }

  for (var i = 0, id; id = sortedBlockIds[i]; i++) {
      convertBlock(id, maps);
  }
  // Top Level blocks are those without parents. 
  var topLevelBlockIds = sortedBlockIds.filter(function(blockId) {
      return (blockId in outputIdMap) && !(blockId in parentMap);});
  // An orphan block (not to be confused with Orphan Black ;-) ) is a top-level block
  // that's not a declaration. I.e., it's a top-level expression or statement 
  // not connected to anything else.
  var orphanedBlockIds = topLevelBlockIds.filter(function (blockId) {
      return ! isDeclaration(inputIdMap[blockId]); });
  if (orphanedBlockIds.length > 0) {
    reportWarning("The result of conversion has " + orphanedBlockIds.length + " orphaned block assemblies "
                  + "(for input blocks " + blockLabelsAndIdsToString(orphanedBlockIds, inputIdMap) + ")."
                  + " These are top-level expression or statement blocks not connected to any"
                  + " declaration blocks (i.e., event handlers, procedure declarations, global variable declarations)."
                  + " Orphan blocks are not necessarily an error, but you should check them if your AI2"
                  + " program does not behave correctly."
                  );
  }
  var xml = goog.dom.createDom('xml')
  for (var i = 0, topLevelId; topLevelId = topLevelBlockIds[i]; i++) {
    // For testing only, include all converted blocks
    var converted = outputIdMap[topLevelId];
    // Add location information for top-level blocks
    var unconverted = inputIdMap[topLevelId];
    var location = getLocation(unconverted);
    if (location.x && location.y) {
      converted.setAttribute("x", location.x);
      converted.setAttribute("y", location.y);
    }
    if (converted) {
      xml.appendChild(converted); // Careful! Appending an element that is already a child of another element will move it. 
    }
  } 
  // Add the following version information:
  //    <yacodeblocks ya-version="75" language-version="17"></yacodeblocks>
  // 75 summarizes the component versions of AI1, 
  // 17 is the earliest AI2 version; upgrader will upgrade it beyond this. 
  xml.appendChild(createElement("yacodeblocks", {"ya-version": "75", "language-version":"17"}, [])); 
  var numBlocksConverted = Object.keys(outputIdMap).length;
  return {xml: xml, numBlocks: numBlocksConverted}
}

function convertBlock(id, maps) {
  // console.log("convertBlock on id " + id); 
  try {
    var block = getBlock(maps.inputIdMap[id]);
    var genus = block.getAttribute("genus-name");
    if (genus == "argument") {
      // AI1 "argument" blocks, i.e., variable declaration name blocks, do not translate to an AI2 block. 
      // However, for variable translations, need to know the label on this block, so return 
      // the label as a string rather than any result block. We do *not* store Id for these
      // blocks in the outputIdMap. 
      var connectors = block.getElementsByTagName("BlockConnector");
      if (connectors.length == 1 && connectors[0].getAttribute("connector-kind") == "plug") {
        var argName = getLabelText(block); // name on the block 
        if (connectors[0].getAttribute("con-block-id")) {
          return argName; // return label since it will be associated with parent param name
        } else { // It's an orphaned top-level block, and need to associate it with *some* variable name!
          var convertedName = maps.variableMap[argName];
          if (! convertedName) { // No getter for argName has been looked up yet
            maps.variableMap[argName] = nameNotInValues(maps.variableMap);
          } // Otherwise argName has already been converted to orphan arg name by looking up associated getter elsewhere
          return argName; // Still need to return (the value is arbitrary) to avoid other processing.
        }
      } else {
        throw new Error("convertBlock on argument: unexpected connector info");
      }
    }
    var spec = AI1ConversionMap[genus];
    if (! spec) {
      resultBlock = undefined;
      reportSystemError("Don't know how to translate AI1 block genus " + genus);
    } else {
      var resultBlock = goog.dom.createDom('block');
      resultBlock.setAttribute("id", id);
      resultBlock.setAttribute("type", spec.type);

      // Collapsing: In AI1, only top-level blocks can be collapsed. 
      // We don't know yet which blocks are top-level, so we check them all. 
      // - In AI1, collapsing is indicated by the block containing a <Collapsed/> tag.
      // - In AI2, collapsing on any block is indicated with a block attribute collapsed="true"
      if (getChildByTagName("Collapsed", block)) {
        resultBlock.setAttribute("collapsed", true);
      }

      // Deactivating/disabling:
      // - In AI1, any block can be deactivated with a <Deactivated/> tag.
      // - In AI2, any block can be disabled withan attribute disabled="true"
      if (getChildByTagName("Deactivated", block)) {
        resultBlock.setAttribute("disabled", true);
      }

      spec.convert(id, block, spec, resultBlock, maps); // Apply conversion function specific to spec.
      maps.outputIdMap[id] = resultBlock; // Note that if genus == "argument", we return above, 
      // and so also do not include such blocks in the outputIdMap.

      // Commenting
      // - In AI1, any block can have a comment, like this:
      //    <Comment>
      //      <Text>Changed the width of the button to 200.</Text>
      //      <Location><X>0</X><Y>0</Y></Location><BoxSize><Width>200</Width><Height>100</Height></BoxSize>
      //    </Comment>
      //  -In AI2,comments come after fields and before sockets. They look like this.
      //    <comment pinned="false" h="80" w="160">This is a button.</comment>
      var commentChild = getChildByTagName("Comment", block);
      if (commentChild) {
        var text = getElementText(getChildByTagName("Text", commentChild)); 
        var sizeChild = getChildByTagName("BoxSize", commentChild); 
        var widthString = getElementText(getChildByTagName("Width", sizeChild)); 
        var heightString = getElementText(getChildByTagName("Height", sizeChild)); 
        var width = widthString == "" ? 50 : parseInt(widthString);
        var height = heightString == "" ? 50 : parseInt(heightString);
        var commentIsVisible = Boolean(getChildByTagName("Visible", commentChild));
        console.log("Creating text node for comment with text '" + text + "'");
        var ai2CommentElt = createElement("comment", 
                                          {pinned: false, 
                                           // pinned: commentIsVisible
                                           // Ignore commentIsVisible, and always set to false.
                                           // If true, comment bubble will show, but often in 
                                           // unusual position. 
                                           w: width, 
                                           h: height}, 
                                          [createTextNode(repairString(text))]);
        insertComment(resultBlock, ai2CommentElt); 
      }
    }
    return resultBlock; 
  } catch(err) {
    reportSystemError("Caught error in convertBlock of id " + id + ": " + err.message); 
    resultBlock = undefined;
  }
}

function convertVariableGetter(id, block, spec, resultBlock, maps) {
  /* Example:
    A1:
    <BlockStub><StubParentName>y</StubParentName><StubParentGenus>argument</StubParentGenus><Block id="819" genus-name="getter" >
      <Location><X>274</X><Y>1109</Y></Location>
      <Label>y</Label>
      <Plug>
        <BlockConnector connector-kind="plug" connector-type="poly" init-type="poly" label="" position-type="single" con-block-id="811" ></BlockConnector>
      </Plug>
      </Block>
    </BlockStub>
    => AI2:
      <block type="lexical_variable_get" id="37">
        <mutation>
          <eventparam name="y"></eventparam>
        </mutation>
        <field name="VAR">y</field> // In general this name might be different than label getter due to weird 
                                    // way AI1 handles naming via "name" and "value" naming blocks. 
                                    // But converter does the right thing to fill in this field appropriately
      </block> 
  */

  var argName = getLabelText(block);
  var varName = maps.variableMap[argName];
  if (! varName) { // The associated "name" block (genus "argument") is an orphan, or declared in some other scope. 
    var varName = nameNotInValues(maps.variableMap); // create new orphaned argument name ...
    maps.variableMap[argName] = varName; // and remember it
  }
  appendChildren(resultBlock, 
                 [// AI2 loading will add this, so we don't need to add it here. 
                  // createElement("mutation", {}, 
                  //               [createElement("eventparam", {"name": varName}, [])]), 
                  createFieldElement("VAR", varName), 
                  ]);  
}

/*----------------------------------------------------------------------
 Convert leaves of block trees.
 ----------------------------------------------------------------------*/

function convertLeaf(id, block, spec, resultBlock, maps) {
  /* Example 1:
       AI1 <Block id="670" genus-name="number" > ... <Label>17</Label> ...  </Block>
       => AI2:
         <block type="math_number" id="670">
           <field name="NUM">17</field>
             </block>
     Example 2: 
       AI1 <Block id="417" genus-name="color-red" > ... <Label>Red</Label> ... </Block>
       => AI2:
          <block type="color_red" id="417">
            <field name="COLOR">#ff0000</field>
          </block>
  */
  // spec.fieldValue overrides label in the case of colors (want "#ff0000", not "Red")
  //   and boolean literals (want "TRUE", not "true")
  var fieldValue = spec.fieldValue ? spec.fieldValue : getLabelText(block); 
  if (spec.type == "text") {
    // Special case for processing text value string (to handle strings with too many '\\' characters)
    fieldValue = repairString(fieldValue);
  }
  resultBlock.appendChild(createFieldElement(spec.fieldName, fieldValue));
}

/*----------------------------------------------------------------------
 Convert component properties, events, and methods
 ----------------------------------------------------------------------*/


function convertComponentGetter(id, block, spec, resultBlock, maps) {
      /* Example: 

            AI1: 
             <BlockStub><StubParentName>Button1.BackgroundColor</StubParentName><StubParentGenus>read-write-property</StubParentGenus>
               <Block id="552" genus-name="componentGetter" >
                 <Location><X>272</X><Y>97</Y></Location>
                 <Label>Button1.BackgroundColor</Label>
                 <Plug><BlockConnector connector-kind="plug" connector-type="poly" init-type="poly" label="" position-type="single" con-block-id="550" ></BlockConnector></Plug>
               </Block>
             </BlockStub>
          => AI2:
             <block type="component_set_get" id="552" x="272" y="97">
               <mutation component_type="Button" set_or_get="get" property_name="BackgroundColor" is_generic="false" instance_name="Button1"></mutation>
               <field name="COMPONENT_SELECTOR">Button1</field>
               <field name="PROP">BackgroundColor</field>
             </block>
       */
  var label = getLabelText(block);
  var splitList = label.split("."); // E.g. "Button1.Visible" => ["Button1", "Visible"]
  var instanceName = splitList[0];
  var propertyName = splitList[1];
  var componentType = maps.componentTypeMap[instanceName];
  resultBlock.setAttribute("inline", "false");

  // -------------------------------------------------
  // Special case for renaming property from AI1 to AI2
  if (componentType == "Player" && propertyName == "IsLooping") {
    propertyName = "Loop";
  }
  // -------------------------------------------------
      
  appendChildren(resultBlock, 
                 [createElement("mutation", 
                                {component_type: componentType, 
                                 instance_name: instanceName,
                                 property_name: propertyName, 
                                 set_or_get: "get", 
                                 is_generic: "false",
                                 }, 
                                []), 
                 createFieldElement("COMPONENT_SELECTOR", instanceName), 
                 createFieldElement("PROP", propertyName)
                  ]);
}

function convertComponentSetter(id, block, spec, resultBlock, maps) {
      /* Example: 
         AI1: 
           <Block id="549" genus-name="componentSetter" > ... 
             <Label>Button1.Visible</Label> ...
             <AfterBlockId>553</AfterBlockId> ...
             <Sockets num-sockets="1" >
               <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="to" 
                position-type="single" con-block-id="551" >
               </BlockConnector>
              </Sockets>
           </Block>
          => AI2:
           <block type="component_set_get" id="549" inline="false">
           <mutation component_type="Button" set_or_get="set" property_name="Visible" 
            is_generic="false" instance_name="Button1"></mutation>
             <field name="COMPONENT_SELECTOR">Button1</field>
             <field name="PROP">Text</field>
             <value name="VALUE">...code for block 551...</value>
             <next>...code for block 553...</next>
           </block>
       */
  var label = getLabelText(block);
  var splitList = label.split("."); // E.g. "Button1.Visible" => ["Button1", "Visible"]
  var instanceName = splitList[0];
  var propertyName = splitList[1];
  var componentType = maps.componentTypeMap[instanceName];
  resultBlock.setAttribute("inline", "false");

  // -------------------------------------------------
  // Special case for renaming property from AI1 to AI2
  if (componentType == "Player" && propertyName == "IsLooping") {
    propertyName = "Loop";
  }
  // -------------------------------------------------

  appendChildren(resultBlock, 
                 [createElement("mutation", 
                                {component_type: componentType, 
                                 instance_name: instanceName,
                                 property_name: propertyName, 
                                 set_or_get: "set", 
                                 is_generic: "false",
                                 }, 
                                []), 
                  createFieldElement("COMPONENT_SELECTOR", instanceName), 
                  createFieldElement("PROP", propertyName)
                  ]);
  convertChildWithLabel("to", "VALUE", id, block, resultBlock, maps);
  convertNextStatement(id, block, resultBlock, maps);
} 

function convertComponentEvent(id, block, spec, resultBlock, maps) {
      /* AI: <Block id="545" genus-name="Button-Click" > ... <Label>Button1.Click</Label> ... 
               <Sockets num-sockets="1" >
                 <BlockConnector connector-kind="socket" connector-type="cmd" init-type="cmd" label="do" is-indented="yes" 
                  position-type="single" con-block-id="555" ></BlockConnector>
               </Sockets>
              </Block>
          => AI2:
          <block type="component_event">
            <mutation component_type="Button" instance_name="Button1" event_name="Click"></mutation>
            <field name="COMPONENT_SELECTOR">Button1</field>
            <statement name="DO">...block for #555...</statement>
          </block>
      */
  var label = getLabelText(block);
  var splitList = label.split("."); // E.g. "Button1.Click" => ["Button1", "Click"]
  var instanceName = splitList[0];
  var eventName = splitList[1]; // Same as spec["eventName"]
  var componentType = maps.componentTypeMap[instanceName]; // Same as spec["componenType"]
  appendChildren(resultBlock, 
                 [createElement("mutation", 
                                {component_type: componentType, 
                                 instance_name: instanceName,
                                 event_name: eventName, 
                                }, 
                                []), 
                  createFieldElement("COMPONENT_SELECTOR", instanceName), 
                  ]);

  // process argument name declarations of event handler
  var socketLabels = getExpressionSocketLabels(block);
  var socketIds = getExpressionSocketIds(block);
  var paramNames = spec["paramNames"];
  assert(sameNames(socketLabels, paramNames), 
         "socketLabels is " + namesToString(socketLabels) + "but paramNames is " + namesToString(paramNames));
  for (var index = 0; index < paramNames.length; index++) {
    var socketId = socketIds[index];
    if (socketId) {
      var argNameLabel = convertBlock(socketId, maps);
      if (! typeof(argNameLabel) == "string") {
        throw new Error("convertComponentEvent: unexpected argNameLabel " + argNameLabel);
      } else {
        maps.variableMap[argNameLabel] = paramNames[index]; // Remember that arg name should be mapped back to param name
                                                       // *** This assumes param name is the same in AI2, which may not be true ***
      }
    }
  }

  // process body of event handler
  convertChildWithLabel("do", "DO", id, block, resultBlock, maps);
}

function convertComponentMethod(id, block, spec, resultBlock, maps) {
  /* AI: 
   <Block id="855" genus-name="Canvas-DrawCircle" >
     <Location><X>109</X><Y>1427</Y></Location>
     <Label>Canvas1.DrawCircle</Label>
     <BeforeBlockId>851</BeforeBlockId>
     <AfterBlockId>841</AfterBlockId>
     <Sockets num-sockets="3" >
       <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="x" position-type="single" con-block-id="863" ></BlockConnector>
       <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="y" position-type="single" con-block-id="865" ></BlockConnector>
       <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="r" position-type="single" con-block-id="861" ></BlockConnector>
    </Sockets>
  </Block>
  => AI2: 
      <block type="component_method" id="170" inline="false">
        <mutation component_type="Canvas" method_name="DrawCircle" is_generic="false" instance_name="Canvas1"></mutation>
        <field name="COMPONENT_SELECTOR">Canvas1</field>
        <value name="ARG0">...conversion of block 863...</value>
        <value name="ARG1">...conversion of block 865...</value>
        <value name="ARG21">...conversion of block 861...</value>
        <next>...code for block 841...</next>
      </block> */
  var label = getLabelText(block);
  var splitList = label.split("."); // E.g. "Canvas1.DrawCircle" => ["Canvas1", "DrawCircle"]
  var instanceName = splitList[0];
  var methodName = splitList[1]; // Same as spec["methodName"]
  var componentType = maps.componentTypeMap[instanceName]; // Same as spec["componentType"]

  // -------------------------------------------------
  // Special case for renaming method from AI1 to AI2
  if (componentType == "Twitter" && methodName == "SetStatus") {
    methodName = "Tweet";
  }
  // -------------------------------------------------

  appendChildren(resultBlock, 
                 [createElement("mutation", 
                                {component_type: componentType, 
                                 instance_name: instanceName,
                                 method_name: methodName, 
                                 is_generic: false
                                }, 
                                []), 
                  createFieldElement("COMPONENT_SELECTOR", instanceName), 
                  ]);
  var argIds = getExpressionSocketIds(block); // List of ids/nulls for arg blocks
  var numArgs = argIds.length; // Number of arg sockets in input and output block 

  for (var i = 0; i < numArgs; i++) {
    convertChildWithId(argIds[i], "ARG" + i, id, block, resultBlock, maps); 
  }
  if (spec.kind == "statement") {
    convertNextStatement(id, block, resultBlock, maps);
  }
}

/*----------------------------------------------------------------------
 Convert generic objects, property getters/setters, and methods
 ----------------------------------------------------------------------*/

function convertGenericComponent(id, block, spec, resultBlock, maps) {
  /* AI1: 
     <Block id="1077" genus-name="component" >
       <Location><X>319</X><Y>204</Y></Location>
       <Label>Ball1</Label>
       <Plug><BlockConnector connector-kind="plug" connector-type="poly" init-type="poly" label="" position-type="single" con-block-id="1075" ></BlockConnector></Plug>
     </Block>
     => AI2: 
       <block type="component_component_block" id="120">
         <mutation component_type="Ball" instance_name="Ball1"></mutation>
         <field name="COMPONENT_SELECTOR">Ball1</field>
       </block>
  */
  var instanceName = getLabelText(block);
  var componentType = maps.componentTypeMap[instanceName]; 
  appendChildren(resultBlock, 
                 [createElement("mutation", 
                                {component_type: componentType, 
                                 instance_name: instanceName},
                                []), 
                  createFieldElement("COMPONENT_SELECTOR", instanceName), 
                  ]);
}

function convertGenericComponentGetter(id, block, spec, resultBlock, maps) {
  /* AI:
    <BlockStub>
      <StubParentName>Ball.Speed</StubParentName><StubParentGenus>read-write-property</StubParentGenus>
      <Block id="1393" genus-name="componentTypeGetter" >
       <Location><X>492</X><Y>425</Y></Location>
       <Label>Ball.Speed</Label>
       <Plug>
         <BlockConnector connector-kind="plug" connector-type="poly" init-type="poly" label="" position-type="single" con-block-id="1389" ></BlockConnector>
       </Plug>
       <Sockets num-sockets="1" >
         <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="component" position-type="single" con-block-id="1403" ></BlockConnector>
       </Sockets>
     </Block>
   </BlockStub>
   => AI2: 
     <block type="component_set_get" id="1393" inline="false">
       <mutation component_type="Ball" set_or_get="get" property_name="Speed" is_generic="true"></mutation>
       <field name="PROP">Speed</field>
       <value name="COMPONENT">...conversion of block 1403</value>
     </block>
   */
  var label = getLabelText(block);
  var splitList = label.split("."); // E.g. "Ball.Speed" => ["Ball", "Speed"]
  var componentType = splitList[0];
  var propertyName = splitList[1];
  resultBlock.setAttribute("inline", "false");
  appendChildren(resultBlock, 
                 [createElement("mutation", 
                                {component_type: componentType, 
                                 property_name: propertyName, 
                                 set_or_get: "get", 
                                 is_generic: true
                                 }, 
                                []), 
                  createFieldElement("PROP", propertyName)]);
  convertChildWithLabel("component", "COMPONENT", id, block, resultBlock, maps);
}

function convertGenericComponentSetter(id, block, spec, resultBlock, maps) {
  /* AI:
   <BlockStub>
     <StubParentName>Ball.Speed</StubParentName>
     <StubParentGenus>read-write-property</StubParentGenus>
     <Block id="1353" genus-name="componentTypeSetter" >
       <Location><X>612</X><Y>253</Y></Location>
       <Label>Ball.Speed</Label>
       <BeforeBlockId>1097</BeforeBlockId>
       <Sockets num-sockets="2" >
         <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="component" position-type="single" con-block-id="1357" ></BlockConnector>
         <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="to" position-type="single" con-block-id="1359" ></BlockConnector>
       </Sockets>
     </Block>
   </BlockStub>
   => AI2: 
     <block type="component_set_get" id="1353" inline="false">
       <mutation component_type="Ball" set_or_get="set" property_name="Speed" is_generic="true"></mutation>
       <field name="PROP">Speed</field>
       <value name="COMPONENT">...conversion of block 1357</value>
       <value name="VALUE">...conversion of block 1359</value>
     </block>
   */
  var label = getLabelText(block);
  var splitList = label.split("."); // E.g. "Ball.Speed" => ["Ball", "Speed"]
  var componentType = splitList[0];
  var propertyName = splitList[1];
  resultBlock.setAttribute("inline", "false");
  appendChildren(resultBlock, 
                 [createElement("mutation", 
                                {component_type: componentType, 
                                 property_name: propertyName, 
                                 set_or_get: "set", 
                                 is_generic: true
                                 }, 
                                []), 
                  createFieldElement("PROP", propertyName)]);
  convertChildWithLabel("component", "COMPONENT", id, block, resultBlock, maps);
  convertChildWithLabel("to", "VALUE", id, block, resultBlock, maps);
  convertNextStatement(id, block, resultBlock, maps); // *** v0.2 fix to problem noticed by Taifun
}

function convertGenericMethodCall(id, block, spec, resultBlock, maps) {
  /* AI1:
    <Block id="1097" genus-name="Type-Ball-PointInDirection" >
      <Location><X>612</X><Y>159</Y></Location>
      <Label>Ball.PointInDirection</Label>
      <BeforeBlockId>1099</BeforeBlockId>
      <AfterBlockId>1353</AfterBlockId>
      <Sockets num-sockets="3" >
        <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="component" position-type="single" con-block-id="1107" ></BlockConnector>
        <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="x" position-type="single" con-block-id="1109" ></BlockConnector>
        <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="y" position-type="single" con-block-id="1111" ></BlockConnector>
      </Sockets>
    </Block>
    => AI2:
    <block type="component_method" id="1097" inline="false">
      <mutation component_type="Ball" method_name="PointInDirection" is_generic="true"></mutation>
      <value name="COMPONENT">...conversion of block 1107</value>
      <value name="ARG0">...conversion of block 1109</value>
      <value name="ARG1">...conversion of block 1111</value>
    </block>
  */
  var label = getLabelText(block);
  var splitList = label.split("."); // E.g. "Ball.PointInDirection" => ["Ball", "PointInDirection"]
  var componentType = splitList[0]; // Same as spec["componentType"]
  var methodName = splitList[1]; // Same as spec["methodName"]
  resultBlock.appendChild(createElement("mutation", 
                                        {component_type: componentType, 
                                         method_name: methodName, 
                                         is_generic: true
                                        }, 
                                        []));
  convertChildWithLabel("component", "COMPONENT", id, block, resultBlock, maps);
  var argIds = getExpressionSocketIds(block); // List of ids/nulls for arg blocks
  argIds.shift(); // Remove first id, which is for component arg, already converted above. 
  var numArgs = argIds.length; // Number of arg sockets in input and output block 
  for (var i = 0; i < numArgs; i++) {
    convertChildWithId(argIds[i], "ARG" + i, id, block, resultBlock, maps); 
  }
  if (spec.kind == "statement") {
    convertNextStatement(id, block, resultBlock, maps);
  }
}

/*----------------------------------------------------------------------
 Convert global declarations, getters and setters
 ----------------------------------------------------------------------*/

function convertGlobalDeclaration(id, block, spec, resultBlock, maps) {
  // This conversion is special only because of field name NAME. Otherwise it would be an operator. 
  /* AI:
   <Block id="811" genus-name="def" >...     
    <Location><X>292</X><Y>58</Y></Location>
    <Label>clicks</Label>
    <Sockets num-sockets="1" >
      <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="as" position-type="single" con-block-id="823" ></BlockConnector>
    </Sockets>
  </Block>
  => AI2: 
    <block type="global_declaration" id="811" inline="false" x="292" y="58">
      <field name="NAME">clicks</field>
     <value name="VALUE">...conversion of block 823...</value>
   </block> 
  */
  var globalName = getLabelText(block);
  resultBlock.appendChild(createFieldElement("NAME", globalName));
  convertChildWithLabel("as", "VALUE", id, block, resultBlock, maps);
}

function convertGlobalGetter(id, block, spec, resultBlock, maps) {
  /* AI:
     <BlockStub><StubParentName>clicks</StubParentName><StubParentGenus>def</StubParentGenus>
       <Block id="849" genus-name="getterGlobal" >...
         <Label>clicks</Label>
         <Plug>
           <BlockConnector connector-kind="plug" connector-type="poly" init-type="poly" label="" position-type="single" con-block-id="845" ></BlockConne
ctor>
         </Plug>
       </Block>
     </BlockStub>
  => AI2: 
     <block type="lexical_variable_get" id="849">
       <field name="VAR">global clicks</field>
     </block>
  */
  var globalName = "global " + getLabelText(block);
  resultBlock.appendChild(createFieldElement("VAR", globalName));
}

function convertGlobalSetter(id, block, spec, resultBlock, maps) {
  // This conversion is special only because of field name VAR. Otherwise it would be an operator. 
  /* AI:
    <BlockStub><StubParentName>clicks</StubParentName><StubParentGenus>def</StubParentGenus>
      <Block id="829" genus-name="setterGlobal" >...
        <Label>clicks</Label>
        <BeforeBlockId>825</BeforeBlockId>
        <AfterBlockId>786</AfterBlockId>
        <Sockets num-sockets="1" >
          <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="to" position-type="single" con-block-id="833" ></BlockConnector>
        </Sockets>
      </Block>
    </BlockStub>
  => AI2: 
      <block type="lexical_variable_set" id="101" inline="false">
        <field name="VAR">global count</field>
        <value name="VALUE">...conversion of block 833...</value>
        <next>...conversion of block 786...</next>
      <block>
  */
  var globalName = "global " + getLabelText(block);
  resultBlock.appendChild(createFieldElement("VAR", globalName));
  convertChildWithLabel("to", "VALUE", id, block, resultBlock, maps);
  convertNextStatement(id, block, resultBlock, maps);
}

/*----------------------------------------------------------------------
 Convert operator blocks (both expressions and statements
 ----------------------------------------------------------------------*/

// Convert expression or statement blocks that only have expression input sockets (one set of which can be expandable)
function convertOperator(id, block, spec, resultBlock, maps) {
  /* Example:
    AI1:
    <Block id="685" genus-name="string-equal" >
      <Location><X>537</X><Y>1101</Y></Location>
      <Label>text=</Label>
      <Plug>
        <BlockConnector connector-kind="plug" connector-type="poly" init-type="poly" label="" position-type="single" con-block-id="693" ></BlockConnector><
     /Plug>
     <Sockets num-sockets="2" >
      <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="text1" position-type="single" con-block-id="687" ></BlockConnector>
      <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="text2" position-type="single" con-block-id="689" ></BlockConnector>
    </Sockets>
  </Block>
  => AI2: 
          <block id="537" type="text_compare" inline="true">
            <field name="OP">EQUAL</field>
            <value name="TEXT1">...conversion of 687...</value>
            <value name="TEXT2">...conversion of 689...</value>
          </block>
   Note: There are lots of special cases involving things like inlining, AI1 expandable args, etc. 
  */

  if (Object.keys(spec).indexOf("inline") != -1) { /* Respect any inline specification given 
                                                      Can't just use if (spec.inline) because it's 
                                                      ignored if result is false! */
    resultBlock.setAttribute("inline", spec.inline);
  }

  // If there are expandable sockets (e.g., make-list, add-items-to-list, number-max, number-min, string-vappend)
  // need to include a mutation element with number of expandable items at top of output XML. 
  // Also do this in case where spec.mutatorItems is true (string-append conversion needs mutator items, 
  // but does not have expandable items). 
  if ( spec.expandableOutputName || spec.mutatorNumItems ) {
    var expandableIds = getExpandableExpressionSocketIds(block); // List of ids/nulls for expandable connectors
    var lastId = expandableIds.pop(); // Last expandable socket isn't real, so remove it
    assert(lastId == null, // Verify there isn't anything there. 
           "convertOperator: last arg of expandable sockets had non-null id -- " + lastId); 
    // Add mutation with number of items expected by AI2. 
    var numItems = spec.mutatorNumItems ? spec.mutatorNumItems : expandableIds.length;
    resultBlock.appendChild(createElement("mutation", {items: numItems}, []));
  }

  // Handle an operator field (if there is one)
  if (spec.opFieldValue) { // If an operation field is specified, include it as a FIELD element 
                          // E.g., math_compare can be LT, LTE, GT, GTE
    var opFieldName = "OP"; // the default
    if (spec.opFieldName) {// override default
      opFieldName = spec.opFieldName;
    }
    resultBlock.appendChild(createFieldElement(opFieldName, spec.opFieldValue));
  } 

  // Handle regular (nonexpandable) sockets next
  var argIds = getNonexpandableExpressionSocketIds(block); // List of ids/nulls for other arg blocks
  var numArgs = argIds.length; // Number of arg sockets in input and output block 
  var argNames = spec.argNames ? spec.argNames : []; // names of converted operand arguments (empty array if not specified)
  // Expect argument sockets to match up with converted block argument names 
  assert(numArgs == argNames.length, 
         "convertOperator: numArgs (" + numArgs + ") != spec.argNames.length (" + argNames.length + ")");
  // Convert all regular argument blocks in non-empty sockets
  for (var i = 0; i < numArgs; i++) {
    convertChildWithId(argIds[i], argNames[i], id, block, resultBlock, maps);
  }

  // Convert the expandable sockets (if they exist, as in make-list, add-items-to-list, number-max, 
  // number-min, string-vappend)
  if (spec.expandableOutputName) {
    for (var ex = 0; ex < expandableIds.length; ex++) { //epandableIds defined above
      convertChildWithId(expandableIds[ex], spec.expandableOutputName + ex, id, block, resultBlock, maps);
    }
  }
  
  // Finally, if this is statement block with a next block, convert that. 
  if (spec.kind == "statement") {
    convertNextStatement(id, block, resultBlock, maps);
  }
}

// Convert an AI1 expandable operator expression into a sequence of binary operator 
// expression applications (used for converting "and" and "or" ops)
function convertExpandableToBinop(id, block, spec, resultBlock, maps) {
  
  var expandableIds = getExpandableExpressionSocketIds(block); // List of ids/nulls for expandable connectors
  var lastId = expandableIds.pop(); // Last expandable socket isn't real, so remove it
  assert(lastId == null, // Verify there isn't anything there. 
         "convertOperator: last arg of expandable sockets had non-null id -- " + lastId); 
  convertIdsoBinop(expandableIds, id, spec, resultBlock, maps);

  // Finally, if this is statement block with a next block, convert that. 
  if (spec.kind == "statement") {
    convertNextStatement(id, block, resultBlock, maps);
  }
  
}

// Recursive helper function for above
function convertIdsoBinop(ids, parentId, spec, resultBlock, maps) {

  if (Object.keys(spec).indexOf("inline") != -1) { /* Respect any inline specification given 
                                                      Can't just use if (spec.inline) because it's 
                                                      ignored if result is false! */
    resultBlock.setAttribute("inline", spec.inline);
  }

  // Handle an operator field (if there is one)
  if (spec.opFieldValue) { // If an operation field is specified, include it as a FIELD element 
                          // E.g., math_compare can be LT, LTE, GT, GTE
    resultBlock.appendChild(createFieldElement("OP", spec.opFieldValue));
  } 

  if (ids.length == 0) {
    // Do nothing: resultBlock will have two empty sockets;
  } else if (ids.length == 1) {
    // Fill in first arg of binop but not second
    if (ids[0]) {
      maps.parentMap[ids[0]] = parentId; // Remember child/parent relationship
      var firstArgBlock = convertBlock(ids[0], maps);
      resultBlock.appendChild(createElement("value", {name: spec.argNames[0]}, [firstArgBlock]));
    }
  }  else if (ids.length == 2) {
    // Fill in both args of binop
    if (ids[0]) {
      maps.parentMap[ids[0]] = parentId; // Remember child/parent relationship
      var firstArgBlock = convertBlock(ids[0], maps);
      resultBlock.appendChild(createElement("value", {name: spec.argNames[0]}, [firstArgBlock]));
    }
    if (ids[1]) {
      maps.parentMap[ids[1]] = parentId; // Remember child/parent relationship
      var secondArgBlock = convertBlock(ids[1], maps);
      resultBlock.appendChild(createElement("value", {name: spec.argNames[1]}, [secondArgBlock]));
    }
  } else { // length is > 2
    // Fill in first arg of binop with first id ...
    var firstId = ids.shift(); // remove first id from ids, shrinking length by 1
    if (firstId) {
      maps.parentMap[firstId] = parentId; // Remember child/parent relationship for original parent
      var firstArgBlock = convertBlock(firstId, maps);
      resultBlock.appendChild(createElement("value", {name: spec.argNames[0]}, [firstArgBlock]));
    }
    // .. and then create new result block for second arg of binop, to be filled by the rest of ids
    var subBlock = goog.dom.createDom('block');
    // There is no id for a subblocks in this linear block tree,
    // so this is not necessary: subBlock.setAttribute("id", firstId);
    subBlock.setAttribute("type", spec.type);
    // Put subBlock in second arg position of result block
    resultBlock.appendChild(createElement("value", {name: spec.argNames[1]}, [subBlock]));
    // Recursively fill the sockets of subBlock
    convertIdsoBinop(ids, parentId, spec, subBlock, maps); 
      // Because of ids.shift(), ids has one less element than it had for enclosing convertIdsToBinop, 
      // which causes recursion to eventually terminate
  }
}

function convertIf(id, block, spec, resultBlock, maps) {
  /* AI1: 
     <Block id="691" genus-name="if" >
       <Location><X>202</X><Y>876</Y></Location>
       <Label>if</Label>
       <BeforeBlockId>548</BeforeBlockId>
       <AfterBlockId>572</BeforeBlockId>
       <Sockets num-sockets="2" >
         <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="test" position-type="single" con-block-id="693" ><BlockConnector>
         <BlockConnector connector-kind="socket" connector-type="cmd" init-type="cmd" label="then-do" is-indented="yes" position-type="single" con-block-id="699" ></BlockConnector>
       </Sockets>
     </Block>
     => AI2:
       <block type="controls_if" id="19" inline="false" x="123" y="54">
         <mutation elseif="0" else="0"></mutation>
         <value name="IF0">...conversion of block 593</value>
         <statement name="DO0">...conversion of block 699</value>
         <next>...conversion of block 572...</next>
       </block>
  */
  resultBlock.appendChild(createElement("mutation", {"elseif": "0", "else":"0"}, []));
  convertChildWithLabel("test", "IF0", id, block, resultBlock, maps);
  convertChildWithLabel("then-do", "DO0", id, block, resultBlock, maps);
  convertNextStatement(id, block, resultBlock, maps);
}

/*----------------------------------------------------------------------
 Convert special control blocks
 ----------------------------------------------------------------------*/

function convertIfElse(id, block, spec, resultBlock, maps) {
  /* Simple conversion
     AI1: 
     <Block id="691" genus-name="ifelse" >
       <Location><X>202</X><Y>876</Y></Location>
       <Label>ifelse</Label>
       <BeforeBlockId>548</BeforeBlockId>
       <AfterBlockId>572</BeforeBlockId>
       <Sockets num-sockets="3" >
         <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="test" position-type="single" con-block-id="693" ><BlockConnector>
         <BlockConnector connector-kind="socket" connector-type="cmd" init-type="cmd" label="then-do" is-indented="yes" position-type="single" con-block-id="699" ></BlockConnector>
         <BlockConnector connector-kind="socket" connector-type="cmd" init-type="cmd" label="else-do" is-indented="yes" position-type="single" con-block-id="739" ></BlockConnector>
       </Sockets>
     </Block>
     => AI2:
       <block type="controls_if" id="19" inline="false" x="123" y="54">
         <mutation elseif="0" else="1"></mutation>
         <value name="IF0">...conversion of block 593</value>
         <statement name="DO0">...conversion of block 699</value>
         <statement name="ELSE">...conversion of block 7399</value>
         <next>...conversion of block 572...</next>
       </block>
  */
  resultBlock.appendChild(createElement("mutation", {"elseif": "0", "else":"1"}, []));
  convertChildWithLabel("test", "IF0", id, block, resultBlock, maps);
  convertChildWithLabel("then-do", "DO0", id, block, resultBlock, maps);
  convertChildWithLabel("else-do", "ELSE", id, block, resultBlock, maps);
  convertNextStatement(id, block, resultBlock, maps);
}

// Convert a choose block
function convertChoose(id, block, spec, resultBlock, maps) {
  convertChildWithLabel("test", "TEST", id, block, resultBlock, maps);  
  convertStmAndExpChildrenWithLabel("then-do", "then-return", "THENRETURN", id, block, resultBlock, maps);  
  convertStmAndExpChildrenWithLabel("else-do", "else-return", "ELSERETURN", id, block, resultBlock, maps);  
}

// Convert a while block
function convertWhile(id, block, spec, resultBlock, maps) {
  convertChildWithLabel("test", "TEST", id, block, resultBlock, maps);  
  convertChildWithLabel("do", "DO", id, block, resultBlock, maps);  
  convertNextStatement(id, block, resultBlock, maps);
}

// Convert a forEach block
function convertForEach(id, block, spec, resultBlock, maps) {
  var loopVarId = getSocketLabelId("variable", block);
  if (loopVarId) {
    var loopVarName = convertBlock(loopVarId, maps);
    maps.variableMap[loopVarName] = loopVarName; // Remember that arg name should map to itself.  
    resultBlock.appendChild(createFieldElement("VAR", loopVarName));
  }
  convertChildWithLabel("in list", "LIST", id, block, resultBlock, maps);  
  convertChildWithLabel("do", "DO", id, block, resultBlock, maps);  
  convertNextStatement(id, block, resultBlock, maps);
}

// Convert a forRange block
function convertForRange(id, block, spec, resultBlock, maps) {
  var loopVarId = getSocketLabelId("variable", block);
  if (loopVarId)  {
    var loopVarName = convertBlock(loopVarId, maps);
    maps.variableMap[loopVarName] = loopVarName; // Remember that arg name should map to itself.  
    resultBlock.appendChild(createFieldElement("VAR", loopVarName));
  }
  convertChildWithLabel("start", "START", id, block, resultBlock, maps);  
  convertChildWithLabel("end", "END", id, block, resultBlock, maps);  
  convertChildWithLabel("step", "STEP", id, block, resultBlock, maps);  
  convertChildWithLabel("do", "DO", id, block, resultBlock, maps);  
  convertNextStatement(id, block, resultBlock, maps);
}

/*----------------------------------------------------------------------
 Convert procedure declarations and calls
 ----------------------------------------------------------------------*/

function convertVoidProcedureDeclaration(id, block, spec, resultBlock, maps) {
  /* AI1: 
     <Block id="1395" genus-name="define-void" >
       <Location><X>511</X><Y>28</Y></Location>
       <Label>changeOuptutBy</Label>
       <Sockets num-sockets="3" >
         <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="arg" is-expandable="yes" position-type="single" con-block-id="1401" ></BlockConnector>
         <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="arg" is-expandable="yes" position-type="single" ></BlockConnector>
         <BlockConnector connector-kind="socket" connector-type="cmd" init-type="cmd" label="do" is-indented="yes" position-type="single" con-block-id="1459" ></BlockConnector>
       </Sockets>
     </Block>
     => AI2: 
     <block type="procedures_defnoreturn" id="1395" x="40" y="29">
       <mutation>
         <arg name="amount"></arg> // List of args goes here
       </mutation>
       <field name="NAME">changeOutputBy</field>
       <field name="VAR0">amount</field> // List of args also goes here
       <statement name="STACK">...conversion of block 1459</statement>
     </block>
  */
  processProcedureNameAndParams(id, block, spec, resultBlock, maps); 
  convertChildWithLabel("do", "STACK", id, block, resultBlock, maps);  
}

function convertFruitfulProcedureDeclaration(id, block, spec, resultBlock, maps) {
  /* Example1: (no statement before return expression)
     AI1: 
      <Block id="1481" genus-name="define" >
        <Location><X>94</X><Y>553</Y></Location>
        <Label>sumOfSquares</Label>
        <Sockets num-sockets="5" >
          <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="arg" is-expandable="yes" position-type="single" con-block-id="1491" ></BlockConnector>
          <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="arg" is-expandable="yes" position-type="single" con-block-id="1495" ></BlockConnector>
          <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="arg" is-expandable="yes" position-type="single" ></BlockConnector>
          <BlockConnector connector-kind="socket" connector-type="cmd" init-type="cmd" label="do" is-indented="yes" position-type="single" ></BlockConnector>
          <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="return" position-type="single" con-block-id="1499"></BlockConnector>
        </Sockets>
      </Block>
     => AI2: 
       <block type="procedures_defreturn" id="192" inline="false" x="49" y="312">
         <mutation>
           <arg name="x"></arg>
           <arg name="y"></arg>
         </mutation>
         <field name="NAME">sumOfSquares</field>
         <field name="VAR0">x</field>
         <field name="VAR1">y</field>
         <value name="RETURN">...conversion of block 1499</value>
       </block>

   Example2 (has a statement before return expression)
     AI1: 
      <Block id="1481" genus-name="define" >
        <Location><X>94</X><Y>553</Y></Location>
        <Label>sumOfSquares</Label>
        <Sockets num-sockets="5" >
          <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="arg" is-expandable="yes" position-type="single" con-block-id="1491" ></BlockConnector>
          <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="arg" is-expandable="yes" position-type="single" con-block-id="1495" ></BlockConnector>
          <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="arg" is-expandable="yes" position-type="single" con-block-id="1497" ></BlockConnector>
          <BlockConnector connector-kind="socket" connector-type="cmd" init-type="cmd" label="do" is-indented="yes" position-type="single"  ></BlockConnector>
          <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="return" position-type="single" con-block-id="1499"></BlockConnector>
        </Sockets>
      </Block>
     => AI2: 
       <block type="procedures_defreturn" id="192" inline="false" x="49" y="312">
         <mutation>
           <arg name="x"></arg>
           <arg name="y"></arg>
         </mutation>
         <field name="NAME">sumOfSquares</field>
         <field name="VAR0">x</field>
         <field name="VAR1">y</field>
         <value name="RETURN">
           <block type="controls_do_then_return" id="262" inline="false">
             <statement name="STM">...conversion of block 1497</statement>
             <value name="VALUE">...conversion of block 1499</statement>
           </block>
         </value>
       </block>
  */
  processProcedureNameAndParams(id, block, spec, resultBlock, maps); 
  convertStmAndExpChildrenWithLabel("do", "return", "RETURN", id, block, resultBlock, maps);  
}

// Determine procedure name and param names, and add corresponding children to result block.
// Used by both fruitful and void procedures. 
function processProcedureNameAndParams(id, block, spec, resultBlock, maps) {
  var procName = getLabelText(block); 
  var paramDeclIds = getExpressionSocketIds(block); 
  if (spec.type == "procedures_defreturn") {
    // Fruitful procedure declarations have an addition expresion socket for defining the body. Remove this. 
    paramDeclIds.pop(); // Remove last socket = body declaration
  }
  // All procedure declarations have empty expandable socket that must be removed. 
  paramDeclIds.pop(); // Remove last argDecl (the expandable one)
  var paramNames = [] 
  for (var i = 0; i < paramDeclIds.length; i++) {
    var paramDeclId = paramDeclIds[i]; 
    if (paramDeclId) {
      var paramName = convertBlock(paramDeclId, maps);
      if (! typeof(paramDeclName) == "string") {
        throw new Error("convertProcedureDeclaration: unexpected paramDeclName " + paramDeclName);
      } else { 
	paramNames.push(paramName); 
        maps.variableMap[paramName] = paramName; // Remember that arg name should map to itself.  
      }
    } else { // No param declared, must make one up
      paramNames.push("unnamedArg" + i);  
    }
  }
  addArgNamesMutation(resultBlock, procName, paramNames); // also includes name attribute for procName, which isn't required. 
  resultBlock.appendChild(createFieldElement("NAME", procName)); 
  appendChildren(resultBlock, 
		 paramNames.map(function (paramName, index) {
		     createFieldElement("VAR" + index, paramName); }));
}

// This works for both fruitful (return) and void (noreturn) procedure calls, 
// which are only distinguished by type ("procedures_callreturn" vs "procedures_callnoreturn"),
// which has already been set from the spec before this is called. 
function convertProcedureCall(id, block, spec, resultBlock, maps) {
  /* AI1: 
    <BlockStub><StubParentName>sumOfSquares</StubParentName><StubParentGenus>define</StubParentGenus>
      <Block id="1531" genus-name="caller" >
        <Location><X>652</X><Y>556</Y></Location>
        <Label>sumOfSquares</Label>
        <Plug>
          <BlockConnector connector-kind="plug" connector-type="poly" init-type="poly" label="" position-type="single" con-block-id="1529" ></BlockConnector>
        </Plug>
        <Sockets num-sockets="2" >
          <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="x1" position-type="single" con-block-id="1533" ></BlockConnector>
          <BlockConnector connector-kind="socket" connector-type="poly" init-type="poly" label="y1" position-type="single" con-block-id="1535" ></BlockConnector>
        </Sockets>
      </Block>
    </BlockStub>
    => AI2: 
      <block type="procedures_callreturn" id="231" inline="false">
        <mutation name="sumOfSquares">
          <arg name="x1"></arg>
          <arg name="y1"></arg>
        </mutation>
        <field name="PROCNAME">sumOfSquares</field>
        <value name="ARG0">...conversion of block 1533</value>
        <value name="ARG1">...conversion of block 1535</value>
     </block>
  */
  var procName = getLabelText(block);
  var paramNames = getExpressionSocketLabels(block);
  var argIds = getExpressionSocketIds(block);
  addArgNamesMutation(resultBlock, procName, paramNames); 
  resultBlock.appendChild(createFieldElement("PROCNAME", procName));     
  for (var i = 0; i < argIds.length; i++) {
    convertChildWithId(argIds[i], "ARG" + i, id, block, resultBlock, maps);
  }
  // Finally, if this is statement block with a next block, convert that. 
  if (spec.kind == "statement") {
    convertNextStatement(id, block, resultBlock, maps);
  }
}

// Appends to resultBlock a mutation of the following form:
//     <mutation name="sumOfSquares">
//          <arg name="x1"></arg>
//          <arg name="y1"></arg>
//     </mutation>
function addArgNamesMutation(resultBlock, procName, argNames) {
  var argElements = argNames.map(function (argName) {
      return createElement("arg", {name: argName}, []); }); 
  resultBlock.appendChild(createElement("mutation", {name: procName}, argElements)); 
}


/*----------------------------------------------------------------------
 Color NONE is a special case. 
 * AI1 has a Color none, whose hex is #00FFFFFF -- i.e., it has a 0 alpha component, 
   so appears transparent. 
 * For reasons I don't understand, this color is missing from AI2.
   But we can fake it by (make-color (list 255 255 255 0)) (alpha goes at end in list).
 ----------------------------------------------------------------------*/
function convertNoneColor(id, block, spec, resultBlock, maps) {
  // By this point, spec already has determined that result block has type color_make_color.
  // But we need to fill in the rest.
  // What we need is the following:
  /*
          <block type="color_make_color" id="111" inline="false">
            <value name="COLORLIST">
              <block type="lists_create_with" id="112" inline="false">
                <mutation items="4"></mutation>
                <value name="ADD0">
                  <block type="math_number" id="113">
                    <field name="NUM">255</field>
                  </block>
                </value>
                <value name="ADD1">
                  <block type="math_number" id="114">
                    <field name="NUM">255</field>
                  </block>
                </value>
                <value name="ADD2">
                  <block type="math_number" id="115">
                    <field name="NUM">255</field>
                  </block>
                </value>
                <value name="ADD3">
                  <block type="math_number" id="122">
                    <field name="NUM">0</field>
                              </block>
                </value>
              </block>
            </value>
          </block>
   */

  /* First, let's define a helper function that creates this: 
                <value name="ADD0">
                  <block type="math_number" id="113">
                    <field name="NUM">255</field>
                  </block>
  */
  function numberValue(name, num) {
    return createElement("value", {name: name}, 
                         [createElement("block", {type: "math_number"},
                                        [createFieldElement("NUM", num)])]);
  }
 
  // Now we can just create the complicated mess
  resultBlock.setAttribute("inline", false);
  resultBlock.appendChild(createElement("value", {name: "COLORLIST"}, 
                                        [createElement("block", {type: "lists_create_with", inline:"false"},
                                                       [createElement("mutation", {items: 4}, []), 
                                                        numberValue("ADD0", 255),
                                                        numberValue("ADD1", 255),
                                                        numberValue("ADD2", 255),
                                                        numberValue("ADD3", 0)])]));
}

/*----------------------------------------------------------------------
 TinyDB-GetValue is a special case: need to add second notFound arg (ARG1)
 filled with the empty string. 
 ----------------------------------------------------------------------*/
function convertTinyDBGetValue(id, block, spec, resultBlock, maps) { 
 /* Expected output
  <block type="component_method" id="1" inline="false" x="15" y="18">
    <mutation component_type="TinyDB" method_name="GetValue" is_generic="false" instance_name="TinyDB1"></mutation>
    <field name="COMPONENT_SELECTOR">TinyDB1</field>
    <value name="ARG0">
      <block type="text" id="2">
        <field name="TEXT">text</field>
      </block>
    </value>
    <value name="ARG1">
      <block type="text" id="3">
      <field name="TEXT"></field>
      </block>
    </value>
  </block>
*/ 

  // Update spec:
  spec.componentType = "TinyDB";
  spec.methodName = "GetValue";
  // Have convertComponentMethod do most of the work with updated spec.
  // This will create everthing except ARG1 value block
  convertComponentMethod(id, block, spec, resultBlock, maps);
  // Now add ARG1 value block filled with empty string.
  resultBlock.appendChild(createElement("value", {name: "ARG1"}, 
                                        [createElement("block", {type: "text"},
                                                       [createFieldElement("TEXT", "")])]));
}

/*----------------------------------------------------------------------
 Screen.openScreenAnimationa and  Screen.closeScreenAnimation are special cases;
 they have changed from methods in AI1 to properties in AI2. 
 ----------------------------------------------------------------------*/
function convertScreenAnimation(id, block, spec, resultBlock, maps) { 
  // Can almost used the code from convertComponentSetter, *except* that
  // arg labeled "to" in property set is labeled "animType" in 
  // open/closeScreenAnimation method calls. 
  var label = getLabelText(block);
  var splitList = label.split("."); // E.g. "Button1.Visible" => ["Button1", "Visible"]
  var instanceName = splitList[0];
  var propertyName = splitList[1];
  var componentType = maps.componentTypeMap[instanceName];
  resultBlock.setAttribute("inline", "false");
      
  appendChildren(resultBlock, 
                 [createElement("mutation", 
                                {component_type: componentType, 
                                 instance_name: instanceName,
                                 property_name: propertyName, 
                                 set_or_get: "set", 
                                 is_generic: "false",
                                 }, 
                                []), 
                  createFieldElement("COMPONENT_SELECTOR", instanceName), 
                  createFieldElement("PROP", propertyName)
                  ]);
  convertChildWithLabel("animType", "VALUE", id, block, resultBlock, maps); //*** The one line that changes from convertComponentSetter
  convertNextStatement(id, block, resultBlock, maps);
} 

/*----------------------------------------------------------------------
 Unimplemented conversions
 ----------------------------------------------------------------------*/

function convertUnimplemented(id, block, spec, resultBlock, maps) {
  var genus = block.getAttribute("genus-name");
  throw new Error("Conversion not impemented for AI1 block " + id + " of genus " + genus
                  + ": \n" + spec.message);
}

/*----------------------------------------------------------------------
 Conversion helper functions
 ----------------------------------------------------------------------*/

function convertChildWithLabel(childLabel, convertedChildName, parentId, parentBlock, resultBlock, maps) {
  var childId = getSocketLabelId(childLabel, parentBlock); 
  convertChildWithId(childId, convertedChildName, parentId, parentBlock, resultBlock, maps);
}

function convertChildWithId(childId, convertedChildName, parentId, parentBlock, resultBlock, maps) {
    if (childId) {
	var outputTag = getSocketOutputTagForId(childId, parentBlock); // Returns "value" for expressions, "statement" for statements, undefined otherwise
	if (!outputTag) {
	    throw new Error("convertChildWithId: no output tag for childId " + childId); 
	} else {
	    maps.parentMap[childId] = parentId; // Mark that child has id as parent
	    var childBlock = convertBlock(childId, maps);
	    resultBlock.appendChild(createElement(outputTag, {name: convertedChildName}, [childBlock]));
	}
    }
}

// Converts a nexts statement, if there is one; if not (e.g., at last statement or in an expression), does nothing
function convertNextStatement(parentId, parentBlock, resultBlock, maps) {
  var nextId = getNextId(parentBlock); 
  if (nextId) {
    maps.parentMap[nextId] = nextId; // Mark that next has id as parent
    var nextBlock = convertBlock(nextId, maps);
    resultBlock.appendChild(createElement("next", {}, [nextBlock]));
  }
}

// Converts a pair of statement and expression to an expression.
// If statment is nontrivial, creates DO-RETURN block;
// otherwise converts to just the expression
function convertStmAndExpChildrenWithLabel(stmLabel, expLabel, convertedChildName, parentId, parentBlock, resultBlock, maps) {
  var stmId = getSocketLabelId(stmLabel, parentBlock); 
  var expId = getSocketLabelId(expLabel, parentBlock); 
  if (! stmId) {
    convertChildWithId(expId, convertedChildName, parentId, parentBlock, resultBlock, maps);
  } else { // Statement is nontrivial; create DO-RETURN block
    // Consider stm and exp to be children of parent, even though they're really children of DO-RETURN.
    // This is OK because parent map is just used to determine top-level blocks. 
    maps.parentMap[stmId] = parentId; 
    var stmBlock = convertBlock(stmId, maps);
    var expBlock = null; 
    if (expId) {
      maps.parentMap[expId] = parentId; 
      var expBlock = convertBlock(expId, maps);
    }
    var doReturnBlock = makeDoReturnBlock(stmBlock, expBlock); 
    resultBlock.appendChild(createElement("value", {name: convertedChildName}, [doReturnBlock]));    
  }
}

// Note: stmBlock is non-falsey but expBlock may be falsey
function makeDoReturnBlock(stmBlock, expBlock) {
  if (expBlock) {
    return createElement("block", {type: "controls_do_then_return", inline: "false", id: nextId()}, 
                         [createElement("statement", {name: "STM"}, [stmBlock]), 
                          createElement("value", {name: "VALUE"}, [expBlock])]);
  } else {
    return createElement("block", {type: "controls_do_then_return", inline: "false", id: nextId()}, 
                         [createElement("statement", {name: "STM"}, [stmBlock])]); 
  }
}					      

/*----------------------------------------------------------------------
 Table for table-driven conversion 
 ----------------------------------------------------------------------*/

// Table that guides the conversion of AI1 to AI2 blocks. 
// This table is automatically extended by information in AI1_simple_components, 
// as defined in the file AI1_v134a_simple_components.js
var AI1ConversionMap = 
{
  // Nonglobal Variables
  "argument": {kind: "bogus"},  //  "argument" is a special case because not converted. 
                                // But still need to know if it's a declaraion or not. 
  
  "getter": {convert: convertVariableGetter, type: "lexical_variable_get", kind: "expression"}, 

  // Global Variables
  "def": {convert: convertGlobalDeclaration, type: "global_declaration", kind: "declaration"}, 
  "getterGlobal": {convert: convertGlobalGetter, type: "lexical_variable_get", kind: "expression"}, 
  "setterGlobal": {convert: convertGlobalSetter, type: "lexical_variable_set", kind: "statement"}, 

  // Components
  "componentGetter": {convert: convertComponentGetter, type:"component_set_get", kind: "expression"},  
  "componentSetter": {convert: convertComponentSetter, type:"component_set_get", kind: "statement"},  
  // Note: component events and methods are added by addComponentEntriesToAI1ConversionMap() below
  // , e.g., "Canvas-TouchDown" and "Canvas-DrawCircle"

  // Generic components, methods, and property getter/setters:
  "component": {convert: convertGenericComponent, type:"component_component_block", kind: "expression"}, 
  "componentTypeGetter": {convert: convertGenericComponentGetter, type:"component_set_get", kind: "expression"}, 
  "componentTypeSetter": {convert: convertGenericComponentSetter, type:"component_set_get", kind: "statement"}, 
  // generic methods are added by addComponentEntriesToAI1ConversionMap(), e.g., "Type-Ball-PointInDirection"

  // Procedure declarations and calls
  "define-void": {convert: convertVoidProcedureDeclaration, type:"procedures_defnoreturn", kind: "declaration"},  
  "define": {convert: convertFruitfulProcedureDeclaration, type:"procedures_defreturn", kind: "declaration"},  
  "caller": {convert: convertProcedureCall, type:"procedures_callreturn", kind: "expression"},  
  "caller-command": {convert: convertProcedureCall, type:"procedures_callnoreturn", kind: "statement"},  

  // Control blocks
  "choose": {convert: convertChoose, type:"controls_choose", kind: "statement"},  
  "if": {convert: convertIf, type:"controls_if", kind: "statement"},  
  "ifelse": {convert: convertIfElse, type:"controls_if", kind: "statement"},  
  "glue": {convert: convertOperator, type:"controls_eval_but_ignore", argNames:["VALUE"], kind: "statement"}, // In My definitions drawer, but really control block
  "foreach": {convert: convertForEach, type:"controls_forEach", kind: "statement"},  
  "forrange": {convert: convertForRange, type:"controls_forRange", kind: "statement"},  
  "while": {convert: convertWhile, type:"controls_while", kind: "statement"},  


  // Control ops on screens:
  "close-application": {convert: convertOperator, type: "controls_closeApplication", argNames:[], kind: "statement"},
  "close-screen": {convert: convertOperator, type: "controls_closeScreen", argNames:[], kind: "statement"},
  "close-screen-with-plain-text":  {convert: convertOperator, type: "controls_closeScreenWithPlainText", argNames:["TEXT"], kind: "statement"},
  "close-screen-with-value": {convert: convertOperator, type: "controls_closeScreenWithValue", argNames:["SCREEN"], kind: "statement"},
  "get-plain-start-text":  {convert: convertOperator, type: "controls_getPlainStartText", argNames:[], kind: "expression"},
  "get-start-value": {convert: convertOperator, type: "controls_getStartValue", argNames:[], kind: "expression"},
  "open-another-screen": {convert: convertOperator, type: "controls_openAnotherScreen", argNames:["SCREEN"], kind: "statement"},
  "open-another-screen-with-start-value": {convert: convertOperator, type: "controls_openAnotherScreenWithStartValue", argNames:["SCREENNAME", "STARTVALUE"], kind: "statement"},

  // Colors
  "color-black": {convert: convertLeaf, type: "color_black", fieldName: "COLOR", fieldValue: "#000000", kind: "expression"},  
  "color-blue": {convert: convertLeaf, type: "color_blue", fieldName: "COLOR", fieldValue: "#0000ff", kind: "expression"},  
  "color-cyan": {convert: convertLeaf, type: "color_cyan", fieldName: "COLOR", fieldValue: "#00ffff", kind: "expression"},  
  "color-dark-gray": {convert: convertLeaf, type: "color_dark_gray", fieldName: "COLOR", fieldValue: "#444444", kind: "expression"},  
  "color-light-gray": {convert: convertLeaf, type: "color_light_gray", fieldName: "COLOR", fieldValue: "#cccccc", kind: "expression"},  
  "color-gray": {convert: convertLeaf, type: "color_gray", fieldName: "COLOR", fieldValue: "#888888", kind: "expression"},  
  "color-green": {convert: convertLeaf, type: "color_green", fieldName: "COLOR", fieldValue: "#00ff00", kind: "expression"},  
  "color-magenta": {convert: convertLeaf, type: "color_magenta", fieldName: "COLOR", fieldValue: "#ff00ff", kind: "expression"}, 
  // Tried to fake a color that has 0 alpha component, but does not work. 
  // "color-none": {convert: convertLeaf, type: "color_white", fieldName: "COLOR", fieldValue: "#00ffffff", kind: "expression"},  
  /* Unimplemented version of none
  "color-none": {convert: convertUnimplemented, 
                 type: "unimplemented_color_none",
                 message: "Conversion of the color None has not been implemented yet.",
                 kind: "expression"},
  */
  "color-none": {convert: convertNoneColor, type: "color_make_color", kind: "expression"}, 
  "color-orange": {convert: convertLeaf, type: "color_orange", fieldName: "COLOR", fieldValue: "#ffc800", kind: "expression"},  
  "color-pink": {convert: convertLeaf, type: "color_pink", fieldName: "COLOR", fieldValue: "#ffafaf", kind: "expression"},  
  "color-red": {convert: convertLeaf, type: "color_red", fieldName: "COLOR", fieldValue: "#ff0000", kind: "expression"},  
  "color-white": {convert: convertLeaf, type: "color_white", fieldName: "COLOR", fieldValue: "#ffffff", kind: "expression"},  
  "color-yellow": {convert: convertLeaf, type: "color_yellow", fieldName: "COLOR", fieldValue: "#ffff00", kind: "expression"},  
  // Color ops: 
  "make-color": {convert: convertOperator, type: "color_make_color", argNames:["COLORLIST"], kind: "expression"},
  "split-color": {convert: convertOperator, type: "color_split_color", argNames:["COLOR"], kind: "expression"},    

  // Logic
  "true": {convert: convertLeaf, type: "logic_boolean", fieldName: "BOOL", fieldValue: "TRUE", kind: "expression"},  
  "false": {convert: convertLeaf, type: "logic_boolean", fieldName: "BOOL", fieldValue: "FALSE", kind: "expression"},  
  "yail-equal": {convert: convertOperator, type:"logic_compare", opFieldValue: "EQ", 
                 inline: true, argNames: ["A", "B"], kind: "expression"}, 
  "yail-not-equal": {convert: convertOperator, type:"logic_compare", opFieldValue: "NEQ", 
                 inline: true,argNames: ["A", "B"], kind: "expression"}, 
  "logical-not": {convert: convertOperator, type:"logic_negate", argNames: ["BOOL"], kind: "expression"}, 
  "and": {convert: convertExpandableToBinop, type: "logic_operation", inline: false, 
          opFieldValue: "AND", argNames: ["A", "B"], kind: "expression"},  
  "or": {convert: convertExpandableToBinop, type: "logic_operation", inline: false, 
         opFieldValue: "OR", argNames:["A", "B"], kind: "expression"},  

  // Lists
  "make-list": {convert: convertOperator, type:"lists_create_with", expandableOutputName: "ADD", kind: "expression"},
   // add item to list, "list" "item" (expandable) 
  "add-items-to-list": {convert: convertOperator, type:"lists_add_items", argNames: ["LIST"], expandableOutputName:"ITEM", kind: "statement"},
   // append to list, "list1" "list2" 
   "append-list": {convert: convertOperator, type:"lists_append_list", argNames: ["LIST0", "LIST1"], kind: "statement"},  
   // copy list, "list"
   "list-copy": {convert: convertOperator, type:"lists_copy", argNames: ["LIST"], kind: "expression"},  
   // insert list item, "list" "index" "item"
  "insert-list-item": {convert: convertOperator, type:"lists_insert_item", argNames: ["LIST", "INDEX", "ITEM"], kind: "statement"}, 
   // is a list?, "thing" 
   "is-list?": {convert: convertOperator, type:"lists_is_list", argNames: ["ITEM"], kind: "expression"},  
   // is in list?, "thing" "list"  
  "list-member": {convert: convertOperator, type:"lists_is_in", argNames:["ITEM", "LIST"], kind: "expression"},
   // is list empty?, "list"
   "list-empty?": {convert: convertOperator, type:"lists_is_empty", argNames: ["LIST"], kind: "expression"},  
   // length of list, "list"
   "list-length": {convert: convertOperator, type:"lists_length", argNames:["LIST"], kind: "expression"},
    // list from csv row, "text"
   "list-from-csv-row": {convert: convertOperator, type:"lists_from_csv_row", argNames: ["TEXT"], kind: "expression"},  
   // list to csv row, "list"
   "list-to-csv-row": {convert: convertOperator, type:"lists_to_csv_row", argNames: ["LIST"], kind: "expression"},  
   // "list from cvs table. "list" (why "list"?)
   "list-from-csv-table": {convert: convertOperator, type:"lists_from_csv_table", argNames: ["TEXT"], kind: "expression"},  
   // list to csv table, "list"
   "list-to-csv-table": {convert: convertOperator, type:"lists_to_csv_table", argNames: ["LIST"], kind: "expression"},   
    // lookup in pairs, "key" "pairs" "notFound"
   "list-lookup-in-pairs": {convert: convertOperator, type:"lists_lookup_in_pairs", argNames: ["KEY", "LIST", "NOTFOUND"], kind: "expression"},  
   // pick random item, "list"
  "list-pick-random": {convert: convertOperator, type:"lists_pick_random_item", argNames:["LIST"], kind: "expression"},
   // position in list, "thing" "list" 
   "list-index": {convert: convertOperator, type:"lists_position_in", argNames:["ITEM", "LIST"], kind: "expression"},
   // select list item, "list" "index" 
  "get-list-item": {convert: convertOperator, type:"lists_select_item", argNames: ["LIST", "NUM"], kind: "expression"},
   // remove list item, "list" "index" 
   "remove-list-item": {convert: convertOperator, type:"lists_remove_item", argNames: ["LIST", "INDEX"], kind: "statement"},  
   // replace list item, "list" "index" "replacement"
   "replace-list-item": {convert: convertOperator, type:"lists_replace_item", argNames: ["LIST", "NUM", "ITEM"], kind: "statement"},  


  // Math
  "number": {convert: convertLeaf, type: "math_number", fieldName: "NUM", kind: "expression"}, 
  "lessthan": {convert: convertOperator, type:"math_compare", opFieldValue: "LT", 
                 inline: true,argNames: ["A", "B"], kind: "expression"}, 
  "greaterthan": {convert: convertOperator, type:"math_compare", opFieldValue: "GT", 
                 inline: true,argNames: ["A", "B"], kind: "expression"}, 
  "lessthanorequal": {convert: convertOperator, type:"math_compare", opFieldValue: "LTE", 
                 inline: true,argNames: ["A", "B"], kind: "expression"}, 
  "greaterthanorequal": {convert: convertOperator, type:"math_compare", opFieldValue: "GTE", 
                 inline: true,argNames: ["A", "B"], kind: "expression"}, 
  "number-plus": {convert: convertOperator, type:"math_add", 
                  numItemsName:"items", argNames:["NUM0", "NUM1"], kind: "expression"},
  "number-minus": {convert: convertOperator, type:"math_subtract", argNames:["A", "B"], kind: "expression"},
  "number-times": {convert: convertOperator, type:"math_multiply", 
		   numItemsName:"items", argNames:["NUM0", "NUM1"], kind: "expression"},
  "number-divide": {convert: convertOperator, type:"math_division", argNames:["A", "B"], kind: "expression"},
  "number-expt": {convert: convertOperator, type:"math_power", argNames:["A", "B"], kind: "expression"},
  "number-random-integer": {convert: convertOperator, type:"math_random_int", argNames:["FROM", "TO"], kind: "expression"},
  "number-random-fraction": {convert: convertOperator, type:"math_random_float", argNames:[], kind: "expression"},
  "number-random-set-seed": {convert: convertOperator, type:"math_random_set_seed", argNames:["NUM"], kind: "expression"},
  "number-sqrt": {convert: convertOperator, type:"math_single", 
                  opFieldValue: "ROOT", argNames:["NUM"], kind: "expression"},
  "number-abs": {convert: convertOperator, type:"math_single", 
                 opFieldValue: "ABS", argNames:["NUM"], kind: "expression"},
  "number-negate": {convert: convertOperator, type:"math_single", 
                    opFieldValue: "NEG", argNames:["NUM"], kind: "expression"},
  "number-log": {convert: convertOperator, type:"math_single", 
                 opFieldValue: "LN", argNames:["NUM"], kind: "expression"},
  "number-exp": {convert: convertOperator, type:"math_single", 
                 opFieldValue: "EXP", argNames:["NUM"], kind: "expression"},
  "number-round": {convert: convertOperator, type:"math_single", 
                   opFieldValue: "ROUND", argNames:["NUM"], kind: "expression"},
  "number-ceiling": {convert: convertOperator, type:"math_single", 
                     opFieldValue: "CEILING", argNames:["NUM"], kind: "expression"},
  "number-floor": {convert: convertOperator, type:"math_single", 
                   opFieldValue: "FLOOR", argNames:["NUM"], kind: "expression"},
  "number-modulo": {convert: convertOperator, type:"math_divide", inline: false, 
                    opFieldValue: "MODULO", argNames:["DIVIDEND", "DIVISOR"], kind: "expression"},
  "number-quotient": {convert: convertOperator, type:"math_divide", inline: false, 
                      opFieldValue: "QUOTIENT", argNames:["DIVIDEND","DIVISOR"], kind: "expression"},
  "number-remainder": {convert: convertOperator, type:"math_divide", inline: false, 
                       opFieldValue: "REMAINDER", argNames:["DIVIDEND", "DIVISOR"], kind: "expression"},
  "number-max": {convert: convertOperator, type:"math_on_list", opFieldValue: "MAX", expandableOutputName: "NUM", kind: "expression"},
  "number-min": {convert: convertOperator, type:"math_on_list", opFieldValue: "MIN", expandableOutputName: "NUM", kind: "expression"},
  "number-sin": {convert: convertOperator, type:"math_trig", opFieldValue: "SIN", argNames:["NUM"], kind: "expression"},
  "number-cos": {convert: convertOperator, type:"math_trig", opFieldValue: "COS", argNames:["NUM"], kind: "expression"},
  "number-tan": {convert: convertOperator, type:"math_trig", opFieldValue: "TAN", argNames:["NUM"], kind: "expression"},
  "number-asin": {convert: convertOperator, type:"math_trig", opFieldValue: "ASIN", argNames:["NUM"], kind: "expression"},
  "number-acos": {convert: convertOperator, type:"math_trig", opFieldValue: "ACOS", argNames:["NUM"], kind: "expression"},
  "number-atan": {convert: convertOperator, type:"math_trig", opFieldValue: "ATAN", argNames:["NUM"], kind: "expression"},
  "number-atan2": {convert: convertOperator, type:"math_trig", argNames:["Y", "X"], kind: "expression"},
  "number-degrees-to-radians": {convert: convertOperator, type:"math_convert_angles", 
                                opFieldValue: "DEGREES_TO_RADIANS", argNames:["NUM"], kind: "expression"},
  "number-radians-to-degrees": {convert: convertOperator, type:"math_convert_angles", 
                                opFieldValue: "RADIANS_TO_DEGREES", argNames:["NUM"], kind: "expression"},
  "format-as-decimal": {convert: convertOperator, type:"math_format_as_decimal", 
			argNames:["NUM", "PLACES"], kind: "expression"},
  "number-is-number?": {convert: convertOperator, type:"math_is_a_number", argNames:["NUM"], kind: "expression"},

  // Strings/text 
  "text": {convert: convertLeaf, type: "text", fieldName: "TEXT", kind: "expression"},  
  "string-append": {convert: convertOperator, type:"text_join", mutatorNumItems: 2, inline: true, argNames:["ADD0", "ADD1"], kind: "expression"},
  "string-vappend": {convert: convertOperator, type:"text_join", expandableOutputName: "ADD", kind: "expression"},
  "string-contains": {convert: convertOperator, type:"text_contains", argNames: ["TEXT", "PIECE"], kind: "expression"}, 
  "string-downcase": {convert: convertOperator, type:"text_changeCase", 
                      opFieldValue: "DOWNCASE", argNames: ["TEXT"], kind: "expression"},
  "string-upcase": {convert: convertOperator, type:"text_changeCase", 
                    opFieldValue: "UPCASE", argNames: ["TEXT"], kind: "expression"},
  "string-empty?": {convert: convertOperator, type:"text_isEmpty", argNames: ["VALUE"], kind: "expression"},
  "string-equal": {convert: convertOperator, type:"text_compare", 
                   opFieldValue: "EQUAL", inline: true, argNames: ["TEXT1", "TEXT2"], kind: "expression"},
  "string-greater-than": {convert: convertOperator, type:"text_compare", opFieldValue: "GT", 
                          inline: true, argNames: ["TEXT1", "TEXT2"], kind: "expression"},
  "string-less-than": {convert: convertOperator, type:"text_compare", 
                       opFieldValue: "LT", inline: true, argNames: ["TEXT1", "TEXT2"], kind: "expression"}, 
  "string-length": {convert: convertOperator, type:"text_length", argNames: ["VALUE"], kind: "expression"}, 
  "string-replace-all": {convert: convertOperator, type:"text_replace_all", argNames: ["TEXT", "SEGMENT", "REPLACEMENT"], kind: "expression"}, 

  "string-starts-at": {convert: convertOperator, type:"text_starts_at", argNames: ["TEXT", "PIECE"], kind: "expression"}, 
  "string-split": {convert: convertOperator, type:"text_split", argNames: ["TEXT", "AT"], 
                   opFieldValue: "SPLIT", kind: "expression"}, 
  "string-split-at-first": {convert: convertOperator, type:"text_split", argNames: ["TEXT", "AT"], 
                            opFieldValue: "SPLITATFIRST", kind: "expression"}, 
  "string-split-at-any": {convert: convertOperator, type:"text_split", argNames: ["TEXT", "AT"], 
                          opFieldValue: "SPLITATANY", kind: "expression"}, 
  "string-split-at-first-of-any": {convert: convertOperator, type:"text_split", argNames: ["TEXT", "AT"], 
                                   opFieldValue: "SPLITATFIRSTOFANY", kind: "expression"}, 
  "string-split-at-spaces": {convert: convertOperator, type:"text_split_at_spaces", argNames: ["TEXT"], kind: "expression"}, 
  // text segment: 
  "string-subtext": {convert: convertOperator, type:"text_segment", argNames: ["TEXT", "START", "LENGTH"], kind: "expression"}, 
  "string-trim": {convert: convertOperator, type:"text_trim", argNames: ["TEXT"], kind: "expression"}, 

};

// Add entries to AI1ConversionMap from AI1_v134a_component_specs,
// as defined in the file AI1_v134a_component_specs.js
function addComponentEntriesToAI1ConversionMap() {
  var eventAndMethodNames = Object.keys(AI1_v134a_component_specs);
  for (var i = 0; i < eventAndMethodNames.length; i++) {  
    var name = eventAndMethodNames[i]; // E.g. "Button-Click", "Canvas-Dragged"
    var componentSpec = AI1_v134a_component_specs[name];
    var splitList = name.split("-"); // E.g. "Button-Click" => ["Button", "Click"]
    var componentType = splitList[0];
    var eventOrMethodName = splitList[1];
    var type = componentSpec['type'];
    if (type == 'component_event') {
      componentSpec["convert"] = convertComponentEvent;
      componentSpec["componentType"] = componentType;
      componentSpec["eventName"] = eventOrMethodName;
      componentSpec["kind"] = "declaration"
    } else if (type == 'component_method') {
      // Regular method calls
      componentSpec["convert"] = convertComponentMethod;
      componentSpec["componentType"] = componentType;
      componentSpec["methodName"] = eventOrMethodName;
      // Already has kind in the method spec, so no need to set here. 

      // Generic method calls
      genericMethodName = "Type-" + name; // E.g. "Type-Ball-PointInDirection"
      genericMethodSpec = {convert: convertGenericMethodCall, 
                           type: "component_method", 
                           componentType: componentType,
                           methodName: eventOrMethodName,
                           kind: componentSpec.kind}
      // Include generic method spec in table
      AI1ConversionMap[genericMethodName] = genericMethodSpec;      
    } else {
      throw new Error("addComponentEntriesToAI1ConversionMap encountered spec not for method or event");
    } 
    // Include event or method method spec in table
    AI1ConversionMap[name] = componentSpec;
  }
  // Special cases that override default cases from table
  AI1ConversionMap["TinyDB-GetValue"] 
    = {convert: convertTinyDBGetValue, 
       type: "component_method",
       kind: "expression"};
  AI1ConversionMap["Type-TinyDB-GetValue"] // There's only one TinyDB object, so I doubt if anyone
                                           // used this generic method. I'm not gonna waste time implementing it. 
    = {convert: convertUnimplemented, 
       message: "Conversion of the generic form of TinyDB.GetValue has not been implemented.",
       kind: "expression"};
  AI1ConversionMap["Screen-OpenScreenAnimation"] 
    = {convert: convertScreenAnimation, 
       type: "component_set_get",
       kind: "statement"};
  AI1ConversionMap["Screen-CloseScreenAnimation"]
    = {convert: convertScreenAnimation, 
       type: "component_set_get",
       kind: "statement"};
  /* // Code written when I though specs would have format of simple_components.json
  for (var i = 0, componentSpec; componentSpec = AI1_simple_components[i]; i++) {
    var componentName = componentSpec.name;

    // Add component events to table
    var events = componentSpec.events;
    for (var j = 0, event; event = events[j]; j++) {
      var eventName = event.name; 
      var hypenatedEventName = componentName + "-" + eventName; E.g., "Button-Click"
      var paramNames = event.params.map(function (paramSpec) { return paramSpec.name; }); 
      AI1ConversionMap[hypenatedEventName] = {kind: "componentEvent", type:"component_event", "paramNames":paramNames};
      // E.g.: "Button-Click": {kind: "componentEvent", type:"component_event", "paramNames":[]}, 
    }

    // Add component methods to table
    var events = componentSpec.methods;
    for (var k = 0, method; method = methods[k]; k++) {
      var methodName = method.name; 
      var hypenatedEventName = componentName + "-" + methodName; // E.g., "Ball-Bounce"
      var paramNames = method.params.map(function (paramSpec) { return paramSpec.name; }); 
      var isExpression = Boolean(method.returnType);
      AI1ConversionMap[hypenatedEventName] = {kind: "componentMethodCall", type:"component_method", 
                                              "paramNames":paramNames, "isExpression": isExpression};
      // E.g.: "Clock-AddDays": {kind: "componentMethodCall", type:"component_method", "paramNames":["instant", "days"], "isExpression":true}
      //       "Canvase-DrawCircle": {kind: "componentMethodCall", type:"component_method", 
      //                              "paramNames":["centerX", "centerY", "radius"], "isExpression":false}
    }
  }
  */
}

// Actually add the component entries. Right now!
addComponentEntriesToAI1ConversionMap(); 

var defaultConversionSpec = {kind: "unknown"};

/*----------------------------------------------------------------------
 General helper functions
 ----------------------------------------------------------------------*/

// Abstraction for creating DOM element using JavaScript dictionaries = objects for attributes
// and lists for children.
function createElement (tag, attributeDict, children) {
  var elt = goog.dom.createDom(tag);
  for (var attributeName in attributeDict) {
    elt.setAttribute(attributeName, attributeDict[attributeName]);
  }
  appendChildren(elt, children);
  return elt;
}

function appendChildren(block, children) {
  for (var i = 0, child; child = children[i]; i++) {
    block.appendChild(child); 
  }
}

function createFieldElement (name, text) {
  var field = goog.dom.createDom('field');
  field.setAttribute("name", name);
  field.appendChild(createTextNode(text));
  return field;
}

function createTextNode(string) {
  return goog.dom.createTextNode(string); 
}

function repairString (brokenString) {
  // For reasons I don't understand, the text we get from XML is bad in two ways:
  // (1) turns the two character '\n' into the three characters '\\n' 
  // (2) turns the one character '/' into two characters '\/'
  // (3) turns the one character '"' into two characters '\"'
  // We can fix these as follows: 
  // console.log("Broken string is: '" + brokenString + "'");
  // fixedString = brokenString.replace(/\\\\n/g, '\\n'); // (1) replace three characters '\\n' by two characters '\n';
  // fixedString = text.replace(/\\\//g, '/');   // (2) convert '\/' to '/':
  // fixedString = text.replace(/\\"/g, '"');   // (3) convert '\"/' to '"':
  /* Can accomplish the above three steps as one regex: */
  fixedString = brokenString.replace(/\\(\\n|\"|\/)/g, '$1');   // convert all above three. 
  // console.log("Fixed string is: '" + fixedString + "'");
  return fixedString;
}

// Return the Id of block connected via socket with given label. 
// Returns undefined if this socket is empty or there is no such socket. 
/*
function getSocketLabelId (label, block) {
  var connectors = block.getElementsByTagName("BlockConnector"); 
  for (var i = 0, connector; connector = connectors[i]; i++) {
    if (connector.getAttribute("label") == label) {
      var conId = connector.getAttribute("con-block-id");
      return conId; // may be undefined? 
    }
  }
  throw "getSocketLabelId: no socket with label " + label; 
}
*/

// Return the Id of block connected via socket with given label. 
// Returns null if this socket is empty or there is no such socket. 
function getSocketLabelId (label, block) {
  var connectors = getSocketBlockConnectors(block);
  for (var i = 0, connector; connector = connectors[i]; i++) {
    if (connector.getAttribute("label") == label) {
      var conId = connector.getAttribute("con-block-id");
      return conId; // will be null if no con-block-id attribute
    }
  }
  throw new Error("getSocketLabelId: no socket with label " + label); 
}

// Return an array of the Ids of all expression socket block connectors. 
// Uses null in place of an Id for an empty socket
function getExpressionSocketIds (block) {
  var connectors = getExpressionSocketBlockConnectors(block);
  return connectors.map(function (connector) { return connector.getAttribute("con-block-id"); });
  // When getSocketBlockConnectors(block) returned an HTMLCollection rather than array, this was necessary
  /*
  ids = []; 
  for (var i = 0, connector; connector = connectors[i]; i++) {
    ids.push(connector.getAttribute("con-block-id"));
  }  
  return ids; 
  */
}

// Return an array of the Ids of all expression socket block connectors that are expandable. 
// Uses null in place of an Id for an empty socket
function getExpandableExpressionSocketIds (block) {
  var connectors = getExpressionSocketBlockConnectors(block);
  var expandables = connectors.filter(function (connector) { return connector.getAttribute("is-expandable") == "yes"; });
  return expandables.map(function (expandable) { return expandable.getAttribute("con-block-id"); });
}

// Return an array of the Ids of all expression socket block connectors that are not expandable. 
// Uses null in place of an Id for an empty socket
function getNonexpandableExpressionSocketIds (block) {
  var connectors = getExpressionSocketBlockConnectors(block);
  var nonexpandables = connectors.filter(function (connector) { return connector.getAttribute("is-expandable") != "yes"; });
  return nonexpandables.map(function (nonexpandable) { return nonexpandable.getAttribute("con-block-id"); });
}

// Returns "value" for expressions, "statement" for statements, undefined otherwise
function getSocketOutputTagForId(childId, parentBlock) {
  var connectors = getSocketBlockConnectors(parentBlock);
  for (var i = 0, connector; connector = connectors[i]; i++) {
    if (connector.getAttribute("con-block-id") == childId) {
	connectorType = connector.getAttribute("connector-type");
      if (connectorType == "poly") { // it's an expression
	return "value";
      } else if (connectorType == "cmd") { // it's a statement
	return "statement";
      } else {
	throw new Error("getSocketOutputTagForId: unrecognized connectorType " + connectorType); 
      }
    }
  }
  return undefined; // Didn't find id
}

// Return an array of the labels of all expression socket block connectors. 
function getExpressionSocketLabels (block) {
  var connectors = getExpressionSocketBlockConnectors(block);
  return connectors.map(function (connector) { return connector.getAttribute("label"); });
}

function getExpressionSocketBlockConnectors (block) {
  var connectors = getSocketBlockConnectors(block); 
  return connectors.filter(function (connector) { return connector.getAttribute("connector-type") == "poly"; }); 
}

function getStatementSocketBlockConnectors (block) {
  var connectors = getSocketBlockConnectors(block); 
  return connectors.filter(function (connector) { return connector.getAttribute("connector-type") == "cmd"; }); 
}

// Returns a array (not an HTMLCollection) of all socket BlockConnectors,
// both for expression sockets (connector-type="poly") and statement-sockets
// (connector-type="cmd"). 
function getSocketBlockConnectors (block) {
  var socketLists = block.getElementsByTagName("Sockets");
  if (socketLists.length == 0) {
    return [];
  } else if (socketLists.length == 1) { // This is the expected case
    var socketsElt = socketLists[0];
    var declaredNumSockets = parseInt(socketsElt.getAttribute("num-sockets"));
    var connectors = socketsElt.getElementsByTagName("BlockConnector"); 
    if (connectors.length != declaredNumSockets) {
      throw new Error("getSocketBlockConnectors: declared number of sockets " + declaredNumSockets 
                      + " does not match actual number of sockets " + connectors.length);
    } else {
      // Convert from an HTMLCollection to an array, since other ops
      // need to use this result as an array (e.g., to map or filter it). 
      var result = []; 
      for (var i = 0; i < connectors.length; i++) {
        result.push(connectors[i]);
      }
      return result;
    }
  } else {
    throw new Error("getSocketBlockConnectors: more than one element tagged Sockets: " + sockets.length);
  }
}

function getNextId (block) {
  var nextElt = getChildByTagName("AfterBlockId", block);
  if (nextElt) {
    var textNode = nextElt.firstChild;
    if (textNode.nodeName == "#text") {
      return textNode.nodeValue;
    } else {
      throw new Error("getNextId did not have text child");
    }
  } else {
    return undefined; // default if no next element. 
  }
}

function getChildByTagName (tag, block) {
  // console.log("getChildByTagName: tag is " + tag + " and block is:");
  // console.log(block);
  var elts = block.getElementsByTagName(tag); // Only works in AI1 because blocks aren't nested!
                                              // Otherwise, could get descendents further down tree from child
                                              // That match tag. 
  if (elts.length == 0) {
    return undefined; 
  } else { // return the first
    return elts[0];
  }
}

function getLocation (block) {
  var result = {"x": undefined, "y": undefined}; 
  var locationElt = getChildByTagName("Location", block);
  if (location) {
    result.x = getElementText(getChildByTagName("X", locationElt));
    result.y = getElementText(getChildByTagName("Y", locationElt));
  }
  return result;
}

function getLabelText (block) {
  var result = getElementText(getChildByTagName("Label", block));
  // console.log(block);
  // console.log("getLabelText of above block returns '" + result + "'");
  return result
}

function getElementText (elt) {
  if (elt) { 
    var textNode = elt.firstChild;
    if (! textNode) {
      return ""; // Needed to handle empty Text blocks in AI1
    } else if (textNode.nodeName == "#text") {
      return textNode.nodeValue;      
    } else {
      throw new Error("getElementText did not have text child");
    }
  } else {
    return ""; // If no element, still return empty string 
  }
}

// Return the block from a block or block stub
function getBlock(blockOrStub) {
  // console.log("getBlock");
  // console.log(blockOrStub);
  var tag = blockOrStub.tagName;
  if (tag == "Block") {
    return blockOrStub;
  } else if (tag == "BlockStub") {
    return blockStubBlock(blockOrStub);
  } else {
    throw new Error("getBlock encountered element with unexpected tag " + tag); 
  }
}

function blockStubBlock(stub) {
  var children = stub.children;
  for (var i = 0, child; child = children[i]; i++) {
    if (child.tagName == "Block") {
      return child;
    }
  }
  throw new Error("blocksStubBlock did not find child with tag Block");
}

function getFirstElementChild(tag, dom) {
  if (dom && dom.firstElementChild && dom.firstElementChild.nodeName) {
    var lowerName = dom.firstElementChild.nodeName.toLowerCase(); 
    var lowerTag = tag.toLowerCase(); 
    if (lowerName == lowerTag) {
      return dom.firstElementChild;
    } else {
      throw new Error('getFirstAndOnlyChild looking for tag ' + lowerTag + ' but found tag ' + lowerName);
    }
  } else {
    throw new Error('getFirstAndOnlyChild: something wrong with dom.');
  }
}

var preCommentTags = ["mutation", "field"];

// Handle the ickiness of inserting a comment element in a block;
// I must go after any mutation and field elements. 
function insertComment (blockElt, commentElt) {
  // First, find the insertion point, which is the index after
  // all children with tags MUTATION and FIELD. 
  var children = goog.dom.getChildren(blockElt);
  var numChildren = children.length;
  if (numChildren == 0) {
    blockElt.appendChild(commentElt); // Add as first child
  }
  var insertionIndex = 0; 
  while (insertionIndex < numChildren && preCommentTags.indexOf(children[insertionIndex].tagName.toLowerCase()) >= 0) {
    insertionIndex++;
  }
  if (insertionIndex > numChildren) {
    blockElt.appendChild(commentElt); // Put at end
  } else {
    blockElt.insertBefore(commentElt, children[insertionIndex]);
  }
}

function getBlockKind(block) {
  var genus = block.getAttribute("genus-name");
  var kind = AI1ConversionMap[genus].kind;
  return kind;
}

// Adapted from http://forums.asp.net/t/1151879.aspx?HttpUtility+HtmlEncode+in+javaScript+
function escapeHTML (str) {
  // var div = document.createElement('div');
  // var text = document.createTextNode(str);
  var div = goog.dom.createDom('div');
  var text = createTextNode(str);
  div.appendChild(text);
  withTagsEscaped = div.innerHTML;
  withNewlinesEscaped = withTagsEscaped.replace(/\n\s*\n/g, '<br>').replace(/\n/g, '<br>')
  withSpacesEscaped = withNewlinesEscaped.replace(/ /g, '&nbsp;');
  return withSpacesEscaped;
}

// From Blockly core xml.js
/**
 * Converts a DOM structure into properly indented text.
 * @param {!Element} dom A tree of XML elements.
 * @return {string} Text representation.
 */
function domToPrettyText (dom) {
  // This function is not guaranteed to be correct for all XML.
  // But it handles the XML that Blockly generates.
  var blob = domToText(dom);
  // Place every open and close tag on its own line.
  var lines = blob.split('<');
  // Indent every line.
  var indent = '';
  for (var x = 1; x < lines.length; x++) {
    var line = lines[x]; 
    // var line = lines[x].trim(); // *** Lyn sez: need to trim here, else terminal newline screws up check for '/>' 
                                // and adds extra blank line between lines
    // [lyn, 2015/06/12] Above trimming is too agressive, and removes trailing newlines from text fields!
    // Instead, just remove last character if it's a newline
    if (line[line.length - 1] == '\n') {
      line = line.slice(0, line.length - 1); // up to, but not including, last character.
    }
    if (line[0] == '/') {
      indent = indent.substring(2);
    }
    lines[x] = indent + '<' + line;
    if (line[0] != '/' && line.slice(-2) != '/>') { // *** Lyn note: no change in indentation for line ending in '/>'
      indent += '  ';
    }
  }
  // Pull simple tags back together.
  // E.g. <foo></foo>
  var text = lines.join('\n');
  text = text.replace(/(<(\w+)\b[^>]*>[^\n]*)\n *<\/\2>/g, '$1</$2>');
  // Trim leading blank line.
  return text.replace(/^\n/, '');
};

/**
 * Converts a DOM structure into plain text.
 * Currently the text format is fairly ugly: all one line with no whitespace.
 * @param {!Element} dom A tree of XML elements.
 * @return {string} Text representation.
 */
function domToText (dom) {
  var oSerializer = new XMLSerializer();
  return oSerializer.serializeToString(dom);
};

/*
// Replace this by reportError from ai1ConvertZip.js
function appdendError (msg) {
  document.getElementById('errors').innerHTML = 
    document.getElementById('errors').innerHTML + "<br>" + msg;
}
*/

function clearErrors () {
  document.getElementById('errors').innerHTML = "";
}

function prettifyXMLText (xmlText) {
  var oParser = new DOMParser();
  var dom = oParser.parseFromString(xmlText, 'text/xml');
  var pretty = domToPrettyText(dom);
  return pretty;
}

function makeDict(alternatingKeyValueList) {
  var dict = {};
  for (var i = 0; i < alternatingKeyValueList.length; i+=2) {
    var key = alternatingKeyValueList[i];
    var value = alternatingKeyValueList[i+1];
    dict[key] = value;
  }
  return dict;
}

// As in Python, return list of numbers from lo (inclusive) to hi (exclusive)
function range(lo, hi) {
  var nums = [];
  for (var n = lo; n < hi; n++) {
    nums.push(n);
  }
  return nums; 
}

function sameNames(names1, names2) {
  if (names1.length != names2.length) {
    return false;
  } else {
    for (var i = 0; i < names1.length; i++) {
      if (names1[i] != names2[i]) {
        return false;
      }
    }
  }
  return true; 
}

// return string representation of array of strings
function namesToString(names) {
  return "[" + names.join(",") + "]";
}

// return a "fresh" name that does not appear as a value in the varmap
var orphanedArgName = "*orphanedArg";

function nameNotInValues(varMap) {
  var orphanedValues = objectValues(varMap).filter(function (name) { return beginsWith(name, orphanedArgName); });
  var i = 1; 
  var nextName = orphanedArgName; // Initial name has no number
  while (orphanedValues.indexOf(nextName) != -1) {
    i++;
    nextName = orphanedArgName + i;  // Subsequent names have numbers
  }
  return nextName; // First name that's not in list. 
}

function objectValues(obj) {
  var keys = Object.keys(obj);
  return keys.map(function (key) { return obj[key]; }); 
}

function beginsWith(string, prefix) {
  if (prefix.length > string.length) { 
    return false; 
  } else {
    return string.slice(0, prefix.length) == prefix;
  }
}

function blockLabelsAndIdsToString(ids, inputIdMap) {
  strings = ids.map(function (id) {
      var block = inputIdMap[id];
      var blockLabel = "UnknownBlock"; // default
      if (block) {
        blockLabel = getLabelText(block);
      } 
      return blockLabel + " (id=" + id + ")";
    });
  return strings.join(", "); 
}

// From http://stackoverflow.com/questions/15313418/javascript-assert
function assert(condition, message) {
  if (!condition) {
    message = message || "Assertion failed";
    if (typeof Error !== "undefined") {
      throw new Error(message);
    }
    throw message; // Fallback
  }
}


