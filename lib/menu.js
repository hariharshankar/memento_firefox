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

// From: http://stackoverflow.com/a/18554215

// initializing firefox libs
var { Cc, Ci, Cu, Cm } = require('chrome');

var { Class } = require('sdk/core/heritage');
var xpcom = require('sdk/platform/xpcom');
var categoryManager = Cc["@mozilla.org/categorymanager;1"]
                      .getService(Ci.nsICategoryManager);

var tabs = require("sdk/tabs");
var tabUtils = require('sdk/tabs/utils');
var windowUtils = require("sdk/window/utils");
var ss = require("sdk/simple-storage");
var unload = require("sdk/system/unload");
var httpEvents = require("sdk/system/events");
var extensionTabs = {}

// initializing memento stuff
var contractId = "@proto-lanl.gov/Memento;1";
var MementoHttpRequest = require("./utils").MementoHttpRequest;
var MementoUtils = require("./utils").MementoUtils;
//exports.handleMenuClick = handleMenuClick
exports.mementoUI = UI

var Thread = {
    get current() {
        delete this.current;
        var obj = "@mozilla.org/thread-manager;1" in Cc 
        ? Cc["@mozilla.org/thread-manager;1"].getService() 
        : Cc["@mozilla.org/thread;1"].createInstance(Ci.nsIThread);
        this.__defineGetter__("current", function() { return obj.currentThread; });
        return this.current; 
    },

    asap: function(callback, self, args) {
        this.current.dispatch({
            run: function() {
                callback.apply(self, args || []);
            }
        }, Ci.nsIEventTarget.DISPATCH_NORMAL);
    }
}

// nsicontentpolicy; doing memento on embedded resources...
var MementoContentPolicy = Class({
    extends:  xpcom.Unknown,
    interfaces: [ 'nsIContentPolicy' ],
    get wrappedJSObject() this,

    shouldLoad: function dt_shouldLoad(contentType, contentLocation, requestOrigin, context, mimeTypeGuess, extra) {
        // Process only embedded resources...
        // contentType == 6 -- top-level-resource
        
        if (contentType == 6 && extensionTabs[0].isMementoActive) {
            memUrl = contentLocation.spec
        }
        if (contentType == 6 || !extensionTabs[0].isMementoActive) {
            return true;
        }

        // omit chrome:// internal urls...
        if (contentLocation.spec.search("chrome://") >= 0) {
            return true;
        }

        var reqUrl = contentLocation.spec
        var whiteList = new MementoUtils().getWhiteList()
        for (var i=0, r; r=whiteList[i]; i++) {
            if (reqUrl.match(r)) {
                return true;
            }
        }

        if (extensionTabs[0].shouldProcessEmbeddedResources) {
            var memUtils = new MementoUtils()
            var urlParts = memUtils.getProtocolAndBaseUrl(reqUrl)
            var baseUrl = reqUrl
            var protocol = ""
            if (urlParts) {
                protocol = urlParts[0]
                baseUrl = urlParts[1]
            }
            if (!extensionTabs[0].mementoBaseUrl
                || baseUrl.search(extensionTabs[0].mementoBaseUrl) >= 0) {

                extensionTabs[0].shouldProcessEmbeddedResources = false
                return
            }
        }

        //console.log("cloc: " + req_url)
        for (var i=0, u; u=extensionTabs[0].visitedMementoLinks[i]; i++) {
            if (u == reqUrl) {
                return true;
            }
        }

        //extensionTabs[0].calendarDatetime = new Date(ss.storage.mementoacceptdatetime)
        extensionTabs[0].getTimeGateUrl(reqUrl, function(retUrl, headers) {

            var tgUrl = extensionTabs[0].processTimeGateUrl(retUrl, headers, false)
            if (!tgUrl) {
                //FIXME: get the original url first? ERROR?
                return true;
            }
            //console.log("tgUrl: " + tgUrl)
            extensionTabs[0].getMementoUrl(tgUrl, function(retTgUrl, headers) {
                var memUrl = extensionTabs[0].processMementoUrl(retTgUrl, headers, false)
                if (!memUrl) {
                    //FIXME: no memento found. ERROR!
                    return
                }

                extensionTabs[0].visitedMementoLinks.push(memUrl)

                //console.log("mem: " + memUrl)
                Thread.asap(function() {context.setAttribute("src", memUrl); });
            })
        })
        //let result = Ci.nsIContentPolicy.ACCEPT;
        return true;
    },
    shouldProcess: function () Ci.nsIContentPolicy.ACCEPT
});

var factory = xpcom.Factory({
    contract: contractId,
    Component: MementoContentPolicy,
    unregister: false // see https://bugzilla.mozilla.org/show_bug.cgi?id=753687
});

// unload 
unload.when(function() {
    function trueUnregister() {
        categoryManager.deleteCategoryEntry("content-policy", contractId, false);
        try {
            xpcom.unregister(factory);
        } catch (ex) {
            Cu.reportError(ex);
        }      
    }
    if ("dispatch" in Cu) {
        Cu.dispatch(trueUnregister, trueUnregister);
    } else {
        Cu.import("resource://gre/modules/Services.jsm");
            Services.tm.mainThread.dispatch(trueUnregister, 0);
    }
});

Cc[contractId].createInstance(Ci.nsIContentPolicy);

categoryManager.deleteCategoryEntry("content-policy", contractId, false);
categoryManager.addCategoryEntry("content-policy", contractId, contractId, false, true);

var topUri = ""
function appendAcceptDatetimeHeader(event) {
    var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
    if (!channel) {
        return
    }
    /*
    if (!channel.referrer) {
        topUri = event.subject.URI.spec
    }
    var win = getDOMWindowFromChannel(channel)
    console.log(win.location.href)
    */
    /*
    if (channel.referrer) {
        if (channel.referrer.spec == topUri) {
            console.log(event.subject.URI.spec)
        }
    }
    */

    /*
    if (!channel.referrer) {
        console.log(event.subject.URI.spec)
        if (extensionTabs[0].calendarDatetime) {
            //console.log("resetting: " + win.location.href + ", " + uri)
            extensionTabs[0].unsetMementoInfo()
            extensionTabs[0].unsetMementoFlags()
            //extensionTabs[0].unsetAcceptDatetime()
            extensionTabs[0].ui.updateUI(
                extensionTabs[0].calendarDatetime,
                extensionTabs[0].mementoDatetime,
                extensionTabs[0].isMementoActive,
                extensionTabs[0].isPsuedoMemento,
                extensionTabs[0].isDatetimeModified
            )
        }
    }
    */

    if (extensionTabs[0].acceptDatetime) {
        channel.setRequestHeader("Accept-Datetime", extensionTabs[0].acceptDatetime.toGMTString(), false);
    }
}

function getDOMWindowFromChannel(ch) {
    var wp;
    try {
        if (ch.loadGroup && ch.loadGroup.groupObserver) {
            wp = ch.loadGroup.groupObserver.
                 QueryInterface(Ci.nsIWebProgress);
        }
    } catch (ex) {}
    try {
        if (!wp) {
            wp = ch.notificationCallbacks.
                 getInterface(Ci.nsIWebProgress);
        }
    }
    catch (ex) {}
    try {
        if (wp) {
            return wp.DOMWindow || null;
        }
    }
    catch (ex) {}
    return null;
}

function getToplevelWindow(win) {
    try {
        return win.QueryInterface(Ci.nsIInterfaceRequestor).
               getInterface(Ci.nsIWebNavigation).
               QueryInterface(Ci.nsIDocShell).
               treeOwner.
               QueryInterface(Ci.nsIInterfaceRequestor).
               getInterface(Ci.nsIXULWindow).
               docShell.
               contentViewer.DOMDocument.defaultView;
    }
    catch (ex) {
        // Likely already a top-level window.
        return win;
    }
}

var memUri = ""
var sem = false

function setMementoDetails(event) {
    var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
    if (!channel) {
        return
    }
    if (!extensionTabs[0].calendarDatetime) {
        return
    }
    var uri = channel.originalURI.spec

    // if a resource has a referrer then it's not a top-level 
    // resource. We set memento info/flags only for top-level
    // resoruce.
    if (channel.referrer) {
        if (extensionTabs[0].acceptDatetime) {
            if (!sem && channel.referrer.spec == memUri) {
                sem = true
            }
            if (sem && channel.referrer.spec != memUri) {
                sem = false
                extensionTabs[0].unsetAcceptDatetime()
                //extensionTabs[0].unsetMementoFlags()
            }
            else {
                return
            }
        }
    }

    respStatus = channel.responseStatus
    if (respStatus >= 300 && respStatus < 400) {
        return
    }

    var win = getDOMWindowFromChannel(channel)
    if (!win) {
        return
    }
    var topUri = win.location.href
    if (!topUri.search("http") == 0) {
        return
    }
    
    //if (extensionTabs[0].isMementoActive) {

    var memDt = false
    try {
        memDt = channel.getResponseHeader("memento-datetime")
    }
    catch (e) {}

    memUri = event.subject.URI.spec

    // the memutils function to get tg, org, etc requires an object.
    var header = {}
    try {
        header['link'] = channel.getResponseHeader("link")
    }
    catch (e) {}
    

    var memUtils = new MementoUtils()
    var orgUrl = memUtils.getRelUriFromHeaders(header, "original")
    var tgUrl = memUtils.getRelUriFromHeaders(header, "timegate")

    //if (extensionTabs[0].isMementoActive) {
        console.log(memUri)
        if (memUri.search(extensionTabs[0].wikipediaMementoBaseRE) >= 0
            && memUri.search(extensionTabs[0].wikipediaOldIdRE) > 0) {
            
            var r = memUri.match(extensionTabs[0].wikipediaTitleRE)
            if (r != null) {
                orgUrl = "http://"
                    + memUri.match(extensionTabs[0].wikipediaLanguageRE)[1]
                    + extensionTabs[0].wikipediaTemplateUrl
                    + r[1]
            }
            extensionTabs[0].isPsuedoMemento = true
            extensionTabs[0].setMementoInfo(orgUrl, tgUrl, memUri, "non-native", false)
        sem = true
        extensionTabs[0].setMementoFlags()
        extensionTabs[0].ui.updateUI(
                extensionTabs[0].calendarDatetime,
                extensionTabs[0].mementoDatetime,
                extensionTabs[0].isMementoActive,
                extensionTabs[0].isPsuedoMemento,
                extensionTabs[0].isDatetimeModified
        )
        }
        else if (!memDt && extensionTabs[0].isMementoActive && extensionTabs[0].isPsuedoMemento) {
            extensionTabs[0].isPsuedoMemento = true
            extensionTabs[0].setMementoInfo(orgUrl, tgUrl, memUri, "non-native", false)
        sem = true
        extensionTabs[0].setMementoFlags()
        extensionTabs[0].ui.updateUI(
                extensionTabs[0].calendarDatetime,
                extensionTabs[0].mementoDatetime,
                extensionTabs[0].isMementoActive,
                extensionTabs[0].isPsuedoMemento,
                extensionTabs[0].isDatetimeModified
        )
        }
        else if (memDt) {
            extensionTabs[0].isPsuedoMemento = false
            var urlParts = memUtils.getProtocolAndBaseUrl(uri)
            var baseUrl = uri
            var protocol = ""
            if (urlParts) {
                protocol = urlParts[0]
                baseUrl = urlParts[1]
            }
            extensionTabs[0].setMementoInfo(orgUrl, tgUrl, topUri, memDt, baseUrl)
        sem = true
        extensionTabs[0].setMementoFlags()
        extensionTabs[0].ui.updateUI(
                extensionTabs[0].calendarDatetime,
                extensionTabs[0].mementoDatetime,
                extensionTabs[0].isMementoActive,
                extensionTabs[0].isPsuedoMemento,
                extensionTabs[0].isDatetimeModified
        )
        }
    //}
    else {
        extensionTabs[0].unsetMementoInfo()
        extensionTabs[0].unsetMementoFlags()
        extensionTabs[0].unsetAcceptDatetime()
        //console.log(extensionTabs[0].mementoDatetime)
        extensionTabs[0].ui.updateUI(
                extensionTabs[0].calendarDatetime,
                extensionTabs[0].mementoDatetime,
                extensionTabs[0].isMementoActive,
                extensionTabs[0].isPsuedoMemento,
                extensionTabs[0].isDatetimeModified
        )
    }
}

httpEvents.on("http-on-modify-request", appendAcceptDatetimeHeader);
httpEvents.on("http-on-examine-response", setMementoDetails);

function updateMementoUI(tab) {}

var pageMod = require("page-mod");
pageMod.PageMod({
    include: "*", // All DOM windows (ie. all pages + all iframes).
    contentScriptWhen: "end", // page starts loading, at this point you have
                                // the head of the document and no more
    contentScript: "", // inject no script, you can even omit this
    onAttach: function onAttach(worker) {
            if (worker.tab.url == worker.url) // test if at top level
                extensionTabs[0].unsetMementoFlags()
            // cleanup the attached worker
            worker.destroy();
        }
    }
);

function handleMenuClick(data, clickedUrl) {
        var currentWindow = windowUtils.getMostRecentBrowserWindow()
        if (clickedUrl == "") {
            return
        }
        else if (clickedUrl.search("chrome://") == 0) {
            return
        }

        var clickedForOriginal = false
        var clickedForMemento = false
        var clickedForLastMemento = false
        var clickedForTimemap = false

        if (data == "getNearDatetime") {
            clickedForMemento = true
        }
        else if (data == "getNearCurrentTime") {
            clickedForLastMemento = true
        }
        else if (data == "getCurrent") {
            clickedForOriginal = true
        }

        extensionTabs[0].calendarDatetime = new Date(ss.storage.mementoacceptdatetime)
    
        if (clickedForOriginal) {
            extensionTabs[0].unsetAcceptDatetime()
            extensionTabs[0].unsetMementoFlags()
            extensionTabs[0].isPsuedoMemento = false
            extensionTabs[0].getOriginalUrl(clickedUrl, function(respUri, headers) {
                var orgUrl = extensionTabs[0].processOriginalUrl(clickedUrl, headers)
                if (orgUrl == clickedUrl && extensionTabs[0].originalUrl != null) {
                    orgUrl = (extensionTabs[0].originalUrl.length > 0)
                    ? extensionTabs[0].originalUrl
                    : orgUrl
                }

                tabs.activeTab.url = orgUrl
                    extensionTabs[0].unsetMementoInfo()
                    extensionTabs[0].unsetMementoFlags()
                    extensionTabs[0].unsetAcceptDatetime()
                    //console.log(extensionTabs[0].mementoDatetime)
                    extensionTabs[0].ui.updateUI(
                            extensionTabs[0].calendarDatetime,
                            extensionTabs[0].mementoDatetime,
                            extensionTabs[0].isMementoActive,
                            extensionTabs[0].isPsuedoMemento,
                            extensionTabs[0].isDatetimeModified
                    )
                return
            })
        }
        else if (clickedForMemento) {
            extensionTabs[0].setAcceptDatetime("calendar")
            clickedUrl = extensionTabs[0].filterSearchResultUrl(clickedUrl)

            extensionTabs[0].getOriginalUrl(clickedUrl, function(respUri, headers) {
                var orgUrl = extensionTabs[0].processOriginalUrl(clickedUrl, headers)
                extensionTabs[0].clickedOriginalUrl = orgUrl

                var tgUrl = extensionTabs[0].getTimeGateUrl(orgUrl, function(respUri, headers) {
                    var tgUrl = ""
                    tgUrl = extensionTabs[0].processTimeGateUrl(orgUrl, headers, true)
                    if (!tgUrl) {
                        // do not negotiate
                        extensionTabs[0].unsetMementoFlags()
                        extensionTabs[0].unsetDatetimeModifiedFlags()
                        tabs.activeTab.url = clickedUrl
                        return
                    }
                    //window.setTimeout(extensionTabs[tab.id].clearCache(), 2000)
                    extensionTabs[0].setMementoFlags()
                    extensionTabs[0].unsetDatetimeModifiedFlags()
                    extensionTabs[0].visitedMementoLinks.push(tgUrl)
                    extensionTabs[0].isMementoActive = true
                    //console.log("tg " + tgUrl)
                    tabs.activeTab.url = tgUrl
                    return
                })
            })
        }
        else if (clickedForLastMemento) {
            extensionTabs[0].setAcceptDatetime("last-memento")
            clickedUrl = extensionTabs[0].filterSearchResultUrl(clickedUrl)
            //console.log("click: " + clickedUrl)

            extensionTabs[0].getOriginalUrl(clickedUrl, function(respUri, headers) {
                var orgUrl = extensionTabs[0].processOriginalUrl(clickedUrl, headers)
                if (!extensionTabs[0].isMementoActive) {
                    extensionTabs[0].clickedOriginalUrl = orgUrl
                }
                extensionTabs[0].getTimeGateUrl(orgUrl, function(respUri, headers) {
                    var lastMemento = ""
                    /*
                    if (typeof(headers) == "string") {
                        lastMemento = headers
                    }
                    else {
                    */
                    lastMemento = extensionTabs[0].processTimeGateUrl(orgUrl, headers, true)
                    //console.log("last: " + lastMemento)
                    //}
                    if (lastMemento.search(extensionTabs[0].userTimeGateUrl) == 0 
                    && extensionTabs[0].lastMementoUrl != null) {

                        lastMemento = (extensionTabs[0].lastMementoUrl.length > 0) 
                                ? extensionTabs[0].lastMementoUrl 
                                : lastMemento
                    }
                    if (!lastMemento) {
                        // do not negotiate
                        extensionTabs[0].unsetMementoFlags()
                        extensionTabs[0].unsetDatetimeModifiedFlags()
                        tabs.activeTab.url = clickedUrl
                        return
                    }
                    //window.setTimeout(extensionTabs[tab.id].clearCache(), 2000)
                    extensionTabs[0].setMementoFlags()
                    extensionTabs[0].unsetDatetimeModifiedFlags()
                    extensionTabs[0].specialDatetime = new Date()
                    tabs.activeTab.url = lastMemento
                    return
                })
            })
        }
    }

function UI() {
}

var contextMenu = require("sdk/context-menu");
UI.prototype = {

    menuId: 0,
    menuItems: [],
    menu: false,
    //contexts: ["page", "link"],
    contexts: [contextMenu.SelectorContext("body, a[href]")],
    //contexts: [contextMenu.SelectorContext("body"), contextMenu.SelectorContext("img"), contextMenu.SelectorContext("a[href]")],
    contextUrlLabel: ["linkUrl", "srcUrl", "frameUrl", "pageUrl"],
    sendMenuClickMessage: "self.on('click', function(node, data) {" +
                    "if (node.href) {" + 
                    "self.postMessage(node.href)" + 
                    "} else {" +
                    "self.postMessage(window.location.href)" + 
                    "}" +
                    "});",

    onMenuClick: function(data, url) {
        handleMenuClick(data, url)    
    },

    /**
     * Creates the context menu on right click. 
     * @param: title: the text to be displayed in the menu.
     * @param: context: the context in which to display the menu
     * @param: enabled: toggle to enable the menu
     * @param: targetUrl: url patterns for this menu to appear.
     * @return: the id of the created menu.
     */

    createContextMenuEntry: function(title, data, context) {
        return contextMenu.Item({
            label: title,
            data: data,
            context: context,
            contentScript: this.sendMenuClickMessage,
            onMessage: function(url) {
                new UI().onMenuClick(this.data, url);
            }
        });
    },

    /**
     * Updates the menu items based on the resource loaded: a memento or an original.
     */
    updateContextMenu: function(calendarDatetime, mementoDatetime, isMementoActive, isPsuedoMemento, isDatetimeModified) {
        var title = "";
        var data = "";

        // cleaning up old menu items
        for (m in this.menuItems) {
            this.menu.removeItem(this.menuItems[m])
        }
        
        title = "Get near " + calendarDatetime
        data = "getNearDatetime"
        var getNearDatetime = this.createContextMenuEntry(title, data, this.contexts)

        title = "Get near current time"
        data = "getNearCurrentTime"
        var getNearCurrentTime = this.createContextMenuEntry(title, data, this.contexts)
        
        this.menu.addItem(getNearDatetime)
        this.menu.addItem(getNearCurrentTime)

        var separator = contextMenu.Separator()

        this.menuItems.push(getNearDatetime, getNearCurrentTime)
        
        if (isMementoActive || isDatetimeModified || mementoDatetime) {
            title = "Get current"
            data = "getCurrent"
            var getCurrent = this.createContextMenuEntry(title, data, this.contexts)
            this.menuItems.push(getCurrent)
            this.menu.addItem(getCurrent)
        }

        this.menuItems.push(separator)
        this.menu.addItem(separator)

        if (isPsuedoMemento || mementoDatetime == "non-native") {
            title = "Got unknown date: Memento-Datetime not provided"
            data = "gotUnkownDate"
            var gotUnkownDatetime = this.createContextMenuEntry(title, data, this.contexts)

            this.menuItems.push(gotUnkownDatetime)
            this.menu.addItem(gotUnkownDatetime)
        }
        else if (mementoDatetime) {
            title = "Got " + mementoDatetime
            data = "gotDatetime"
            var gotDatetime = this.createContextMenuEntry(title, data, this.contexts)

            this.menuItems.push(gotDatetime);
            this.menu.addItem(gotDatetime)
        }
        else {
            title = "Got current"
            data = "gotCurrent"
            var gotCurrent = this.createContextMenuEntry(title, data, this.contexts)

            this.menuItems.push(gotCurrent)
            this.menu.addItem(gotCurrent)
        }
    },

    /**
     * Updates the menus and the icons depending on the loaded resource 
     * type.
     */
    updateUI: function(calendarDatetime, mementoDatetime, isMementoActive, isPsuedoMemento, isDatetimeModified) {
        this.updateContextMenu(calendarDatetime, mementoDatetime, isMementoActive, isPsuedoMemento, isDatetimeModified)
        console.log(mementoDatetime)
        if (mementoDatetime || isMementoActive) {
            this.setMementoIcon()
        }
        else {
            this.setOriginalIcon()
        }
    },

    /**
     * Sets the memento icon. 
     */
    setMementoIcon: function() {
        var windowUtils = require("window-utils");
        var data = require("sdk/self").data
        let tbb
        windowUtils = new windowUtils.WindowTracker({
            onTrack: function (window) {
                if ("chrome://browser/content/browser.xul" != window.location) {
                    return;
                }
                tbb = window.document.getElementById("memento-time-travel-navbar-button")
                tbb.setAttribute("image", data.url("img/memento_on-16x16.png"));
            }
        });
    },

    /** 
     * Sets the original icon.
     */
    setOriginalIcon: function() {
        var windowUtils = require("window-utils");
        var data = require("sdk/self").data
        let tbb
        windowUtils = new windowUtils.WindowTracker({
            onTrack: function (window) {
                if ("chrome://browser/content/browser.xul" != window.location) {
                    return;
                }
                tbb = window.document.getElementById("memento-time-travel-navbar-button")
                tbb.setAttribute("image", data.url("img/memento-16x16.png"));
            }
        });
    },

    /**
     * initialize the UI for first time use. Called when the plugin is run for the first time.
     */
    init: function() {
        
        extensionTabs[0] = new MementoAlgorithm()
        extensionTabs[0].ui = this

        // FIXME
        ss.storage.mementoTimeGateUrl = "http://mementoproxy.lanl.gov/aggr/timegate/"
        //console.log("tg: " + ss.storage.mementoTimeGateUrl)

        extensionTabs[0].userTimeGateUrl = ss.storage.mementoTimeGateUrl
        var initMenu = contextMenu.Item({
            label: "Select a date for time travel..."
        });

        this.menuItems.push(initMenu)
        this.menu = contextMenu.Menu({
            label: "Memento Time Travel",
            items: this.menuItems,
            context: this.contexts
        })
    }
}

/**
 * Memento implements the Memento algorithm.
 * There are kludges here to extend support for archives that do not
 * natively support memento yet. 
 * The memento algorithm can be found at doc/memento_algorithm.txt file.
 */

function MementoAlgorithm() {
}

MementoAlgorithm.prototype = {

    aggregatorUrl: "http://mementoproxy.lanl.gov/aggr/timegate/",
    //wikipediaTimegate: "http://mementoproxy.lanl.gov/wiki/timegate/",
    wikipediaTemplateUrl: ".wikipedia.org/wiki/",
    wikipediaLanguageRE: new RegExp("([a-z]{0,2})\.wikipedia.org/"),
    wikipediaMementoBaseRE: new RegExp("[a-z]{0,2}\.wikipedia.org/w/index.php"),
    wikipediaOldIdRE: new RegExp("[?&]oldid=[0-9]+(&|$)"),
    wikipediaTitleRE: new RegExp('[?|&]title=' + '([^&;]+?)(&|#|;|$)'),
    googleSearchURLRE: new RegExp("(http|https)://www.google(.co)?.[a-z]{2,3}/url"),
    yahooSearchURLRE: new RegExp("search.yahoo.com"),
    shouldProcessEmbeddedResources: false,
    isMementoActive: false,
    mementoDatetime: false,
    acceptDatetime: false,
    calendarDatetime: false,
    timegateUrl: false,
    originalUrl: false,
    mementoUrl: false,
    mementoBaseUrl: false,
    isPsuedoMemento: false,
    clickedOriginalUrl: false,
    lastMementoUrl: false,
    specialDatetime: false,
    isDatetimeModified: false,
    visitedUrls: {},
    visitedMementoLinks: [],



    /**
     * Given any url, this method returns the original url of that resource.
     * A HEAD is performed on the resource and the original rel type url is  
     * returned for memento supported resources.
     * Wikipedia is handled as a special case where the presence of oldid determines 
     * the type of resource. All other non-memento supported resources are assumed to be original.
     * @param: reqUrl: the requested url
     * @param: orgHeadResponse: the response headers from the HEAD on the resource.  
     */
    processOriginalUrl: function (reqUrl, orgHeadResponse) {
        var orgUrl = new MementoUtils().getRelUriFromHeaders(orgHeadResponse, "original")
        if (!orgUrl) {
            for (i in this.visitedUrls) {
                if (i == reqUrl) {
                    orgUrl = this.visitedUrls[i]
                    break
                }
            }
        }
        if (reqUrl.search(this.wikipediaMementoBaseRE) >= 0) {
            if (reqUrl.match(this.wikipediaTitleRE)) {
                var title = reqUrl.match(this.wikipediaTitleRE)[1]
                if (title) {
                    orgUrl = "http://" + reqUrl.match(this.wikipediaLanguageRE)[1] + this.wikipediaTemplateUrl + title
                }
            }
        }
        if (!orgUrl || orgUrl == "" && this.isMementoActive) {
            if (reqUrl.lastIndexOf("http://") > 0) {
                orgUrl = reqUrl.substring(reqUrl.lastIndexOf("http://"))
            }
        }
        if (!orgUrl || orgUrl == "") {
            orgUrl = reqUrl
        }
        //console.log("orgURL: " + orgUrl)
        return orgUrl
    },

    /**
     * The HEAD to determine the original resource is made here.
     * The processing of the resoponse is handled be the processOriginalUrl 
     * method.
     * @param: reqUrl: the request url
     * @param: the callback to execute on response received.
     */
    getOriginalUrl: function(reqUrl, callback) {
        var o = callback
        var Request = MementoHttpRequest.bind(o)
        var r = new Request()
        //console.log("getOrgUrl: " + reqUrl)
        r.doHttp(reqUrl, false, function(uri, orgHeadResponse) {
            callback(uri, orgHeadResponse.headers)
        })
    },

    /** 
     * Determines the timegate url for the given resource. The logic is similar 
     * to processOriginalUrl.
     * @param: orgUrl: the url of the original resource
     * @param: tgHeadResponse: the reponse headers from the HEAD request on the original
     * @param: isTopLevelResource: if this resource is a top level resource. Helps set the 
     * flags for non-native memento handling.
     * @return: timegate url
     */
    processTimeGateUrl: function(orgUrl, tgHeadResponse, isTopLevelResource) {
        var tgUrl
        tgUrl = new MementoUtils().getRelUriFromHeaders(tgHeadResponse, "timegate")
        if (!tgUrl) {
            var doNotNeg = new MementoUtils().getRelUriFromHeaders(tgHeadResponse, "type")
            if (doNotNeg == "http://mementoweb.org/terms/donotnegotiate") {
                tgUrl = false
            }
            else {
                tgUrl = this.userTimeGateUrl + orgUrl
                if (isTopLevelResource) {
                    this.isPsuedoMemento = true
                }
            }
        }
        return tgUrl
    },

    /**
     * The method does the HEAD on the original resource to get the link headers.
     * @param: orgUrl: the original url
     * @param: callback: the callback function to execute.
     */
    getTimeGateUrl: function(orgUrl, callback) {
        var tgUrl = ""
        this.isMementoActive = true

        var Request = MementoHttpRequest.bind(callback)
        var r = new Request()
        //console.log("tg: " + this.acceptDatetime)
        //console.log("ul: " + orgUrl)

        r.doHttp(orgUrl, this.acceptDatetime, function(uri, tgHeadResponse) {
            callback(uri, tgHeadResponse)
        })
    },

    /** 
     * Similar to getTimeGateUrl, but performs synchronous ajax requests. 
     * @param: orgUrl: the original url
     * @param: isTopLevelResource: if this is a top level resource.
     * @return: the timegate url
     */
    getSyncTimeGateUrl: function(orgUrl, isTopLevelResource) {
        
        var tgUrl = ""
        this.isMementoActive = true

        var memUtils = new MementoUtils()
        var tgHeadResponse = memUtils.ajax(orgUrl, "HEAD", this.acceptDatetime)
        if (memUtils.getHeader(tgHeadResponse.getAllResponseHeaders(), "Memento-Datetime")) {
            tgUrl = orgUrl
        }
        else {
            tgUrl = memUtils.getRelUriFromHeaders(tgHeadResponse.getAllResponseHeaders(), "timegate")
        }
        if (!tgUrl) {
            var doNotNeg = memUtils.getRelUriFromHeaders(tgHeadResponse.getAllResponseHeaders(), "type")
            if (doNotNeg == "http://mementoweb.org/terms/donotnegotiate") {
                tgUrl = false
            }
            else {
                tgUrl = this.userTimeGateUrl + orgUrl
                if (isTopLevelResource) {
                    this.isPsuedoMemento = true
                }
            }
        }
        return tgUrl
    },

    /**
     * Given the timegate url, this method returns the memento url of that resource.
     * A HEAD is performed on the timegate and the memento rel type url or the 
     * location url is returned.
     * @param: tgUrl: the timegate url
     * @param: tgHeadResponse: the response headers from the HEAD on the resource.  
     */
    processMementoUrl: function (tgUrl, tgHeadResponse, isTopLevelResource) {
        var memUrl = ""
        var memUtils = new MementoUtils()
        var memDt = memUtils.getHeader(tgHeadResponse, "memento-datetime")
        //console.log(tgHeadResponse)
        //console.log("memdt; " + memDt)

        if (!memDt) {
            memUrl = memUtils.getDatetimeUriFromHeaders(tgHeadResponse, memDt)
        }
        else {
            memUrl = memUtils.getRelUriFromHeaders(tgHeadResponse, "memento")
        }
        //console.log("meme " + memUrl)
        if (!memUrl) {
            memUrl = tgUrl
        }
        return memUrl
    },

    /**
     * The HEAD to determine the memento is made here.
     * The processing of the resoponse is handled by the processMementoUrl 
     * method.
     * @param: reqUrl: the request url
     * @param: the callback to execute on response received.
     */
    getMementoUrl: function(reqUrl, callback) {
        var o = callback
        var Request = MementoHttpRequest.bind(o)
        var r = new Request()
        //console.log("mem: " + this.acceptDatetime)
        //console.log("getOrgUrl: " + reqUrl)
        r.doHttp(reqUrl, this.acceptDatetime, function(uri, tgHeadResponse) {
            callback(uri, tgHeadResponse)
        })
    },

    /**
     * If the request url is a yahoo or google search result, this
     * function finds the original url. 
     * @param: the request url
     * @return: the original url
     */
    filterSearchResultUrl: function(url) {
        if (url.search(this.yahooSearchURLRE) >= 0) {
            url = unescape(url.split("**")[1])
        }
        else if (url.search(this.googleSearchURLRE) >= 0) {
            url = new MementoUtils().getUrlParameter(url, "url")
        }
        return url
    },

    /**
     * reset the flags that determines if a resource is a memento.
     */

    unsetMementoFlags: function() {
        this.isMementoActive = false
        this.specialDatetime = false
        this.shouldProcessEmbeddedResources = false
        this.isPsuedoMemento = false
    },

    /**
     * Reset the flag that was set when the calendar date time was modified.
     */
    unsetDatetimeModifiedFlags: function() {
        this.isDatetimeModified = false
    },

    /**
     * Set the flag to indicate that the calendar datetime has been modified.
     */
    setDatetimeModifiedFlags: function() {
        this.isDatetimeModified = true
    },

    /** 
     * Set the flags that indicate the current resource is a memento.
     */
    setMementoFlags: function() {
        this.isMementoActive = true
        if (this.isPsuedoMemento) {
            this.shouldProcessEmbeddedResources = false
        }
        else {
            this.shouldProcessEmbeddedResources = true
        }
    },

    /** 
     * The accept datetime value is set depending on the requested memento resource. 
     * @param: type: the type of the memento resource to be requested. 
     */ 
    setAcceptDatetime: function(type) {
        if (type == "calendar") {
            this.acceptDatetime = this.calendarDatetime
        }
        else if (type == "last-memento") {
            this.acceptDatetime = new Date()
            this.specialDatetime = true
        }
    },

    /**
     * The accept datetime value is reset. 
     * Happens everytime a new resource is loaded.
     */
    unsetAcceptDatetime: function() {
        this.acceptDatetime = false
        this.specialDatetime = false
    },

    /**
     * Sets the necessary memento information of the loaded resource.
     * @param: orgUrl: the original Url
     * @param: tgUrl: the timegate url
     * @param: memUrl: memento url
     * @param: memDt: memento datetime of the loaded resource.
     * @param: memBaseUrl: the base url of the memento. For non-native memento resources, 
     * this information is used to decide if embedded resources should be processed. 
     */
    setMementoInfo: function(orgUrl, tgUrl, memUrl, memDt, memBaseUrl) {
        this.originalUrl = orgUrl
        this.timegateUrl = tgUrl
        this.mementoUrl = memUrl
        this.mementoBaseUrl = memBaseUrl

        this.mementoDatetime = memDt
        this.visitedUrls[this.mementoUrl] = this.orgUrl
    },

    /**
     * reset all the memento flags. 
     */
    unsetMementoInfo: function() {
        this.originalUrl = false
        this.timegateUrl = false
        this.mementoUrl = false
        this.mementoBaseUrl = false
        this.mementoDatetime = false
    }

}


/**
 * Handler for each tab or window created in chrome. 
 * Acts as an interface between the browser and the memento algorithm.
 */
function MementoTabs(tabId) {
    this.requestIds = []
    this.mem = new Memento()
    this.ui = new UI()
    this.getTimeGateFromStorage()
}

MementoTabs.prototype = {

    /**
     * This clears chrome's in-memory cache. Chrome has a caching mechanism 
     * that does not seem to honor accept-datetime requests. The Memento algorithm
     * cannot be implemented without clearing the cache before making a memento request. 
     */

    clearCache: function() {
    },

    /**
     * Retrieves the calendar date time of the currently active tab. 
     * Each tab's date time is stored in the local browser storage. 
     * If a tab does not have a date time value, the date time value of the previously
     * active tab is automatically assigned. 
     */ 
    getDatetimeFromStorage: function() {
    },

    /** 
     * The user preferred timegate is retrieved from storage.
     */
    getTimeGateFromStorage: function() {
    }
}

