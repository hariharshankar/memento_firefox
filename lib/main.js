/**

 * This file is part of the extension Memento for Firefox.
 * http://mementoweb.org

 * Copyright 2013,
 * Harihar Shankar, Herbert Van de Sompel, 
 * Martin Klein, Robert Sanderson, Lyudmila Balakireva
 * -- Los Alamos National Laboratory. 

 * Licensed under the BSD open source software license.
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://mementoweb.github.io/SiteStory/license.html

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var data = require("sdk/self").data
var menu = require("./menu")
var ss = require("sdk/simple-storage");


ui = new menu.mementoUI()
ui.init()

// popup
var popup = require("sdk/panel").Panel({
    width: 280,
    height: 390,
    position: {
        right: 0,
        top: 0
    },
    contentURL: data.url("./src/popup.html"),
    contentScriptFile: [
                data.url("./src/lib/jquery-ui/js/jquery-1.9.1.js"),
                data.url("./src/lib/jquery-ui/js/jquery-ui-1.10.3.custom.min.js"),
                data.url("./src/popup.js")
                ]
});

popup.port.on("save", function(datetime) {
    ss.storage.mementoacceptdatetime = datetime
    console.log("dt: " + ss.storage.mementoacceptdatetime)
    popup.hide();
    ui.updateUI(ss.storage.mementoacceptdatetime, false, false, false, true)
});

popup.port.on("cancel", function(datetime) {
    popup.hide();
});


// icon in the nav-bar
var Widget = require("sdk/widget").Widget;
var utils = require("sdk/window/utils");

exports.main = function() {

    var windowUtils = require("window-utils");
    let tbb
    windowUtils = new windowUtils.WindowTracker({
      onTrack: function (window) {
        if ("chrome://browser/content/browser.xul" != window.location) return;
        
        NS_XUL = "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul";
    
        tbb = window.document.createElementNS(NS_XUL, "toolbarbutton");
        tbb.setAttribute("id", "memento-time-travel-navbar-button");
        tbb.setAttribute("type", "button");
        tbb.setAttribute("image", data.url("img/memento-16x16.png"));
        tbb.setAttribute("class", "toolbarbutton-1 chromeclass-toolbar-additional");
        tbb.setAttribute("label", "Memento Time Travel");
        tbb.setAttribute('tooltiptext', "Memento Time Travel");

        tbb.addEventListener("click", function() {
            if (!ss.storage.mementoacceptdatetime) {
                ss.storage.mementoacceptdatetime = false
            }
            popup.port.emit("show", ss.storage.mementoacceptdatetime);
            
            popup.show()
        }, false);
        
        window.document.getElementById('nav-bar').appendChild(tbb);
      },
      
      onUntrack: function(window){         
        if ("chrome://browser/content/browser.xul" != window.location) return;

        window.document.getElementById("nav-bar").removeChild(tbb);
      }
    });
};
