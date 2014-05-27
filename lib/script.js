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


function appendAcceptDatetimeHeader(event) {
    if (!isMementoClicked) {
        return
    }
    var channel = event.subject.QueryInterface(Ci.nsIHttpChannel);
    if (!channel) {
        console.log("Error: no channel");
        return
    }
    channel.setRequestHeader("Accept-Datetime", ss.storage.mementoacceptdatetime.toGMTString(), false);
    var uri = event.subject.URI.spec
    
    for (var i=0, u; u=visitedLinks[i]; i++) {
        if (u == uri) {
            return;
        }
    }
    visitedLinks.push(uri)
    var mem = new MementoAlgorithm()
    mem.calendarDatetime = ss.storage.mementoacceptdatetime
    mem.setAcceptDatetime("calendar")

    var tab = getTabFromChannel(channel)
    if (tab) {
        //console.log("ORG: " + uri)
        //console.log(tab.top.document.location)
    }

    var tgUrl = mem.getSyncTimeGateUrl(uri, false)
    visitedLinks.push(tgUrl)
    channel.redirectTo(ios.newURI(tgUrl, null, null))
    //var tg = Cu.Services.io.newURI(tgUrl, null, null)
    //console.log(tg)
    //channel.redirectTo(tgUrl)
    //var b = getTabFromChannel(channel)
}
/*
function getWindowForRequest(request){
  if (request instanceof Ci.nsIRequest){
    try{
      if (request.notificationCallbacks){
        return request.notificationCallbacks
                      .getInterface(Ci.nsILoadContext)
                      .associatedWindow;
      }
    } catch(e) {}
    try{
      if (request.loadGroup && request.loadGroup.notificationCallbacks){
        return request.loadGroup.notificationCallbacks
                      .getInterface(Ci.nsILoadContext)
                      .associatedWindow;
      }
    } catch(e) {}
  }
  return null;
}
*/

function getTabFromChannel(channel) {
    try {
        var cb = channel.notificationCallbacks ? channel.notificationCallbacks : channel.loadGroup.notificationCallbacks;
        if (!cb) {
            return null;
        }
        var domWindow = cb.getInterface(Ci.nsIDOMWindow);
        return domWindow
        //return domWindow.top;
    }
    catch (e) {
        console.log("ERROR: " + e)
        return null;
    }
}

