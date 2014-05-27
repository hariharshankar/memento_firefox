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

/** 
 * MementoUtils implements aynchronous ajax requests.
 * Uses jQuery ajax functions.
 */

exports.MementoHttpRequest = MementoHttpRequest
exports.MementoUtils = MementoUtils

function MementoHttpRequest() {}

var Request = require("sdk/request").Request;
const { XMLHttpRequest } = require("sdk/net/xhr");

MementoHttpRequest.prototype = {

    /**
     * This function wraps the jQuery ajax method. The Accept-Datetime header
     * can be optionally set.
     * @param: uri: the uri to request
     * @param: calendarDatetime: the accept-datetime to set.
     * @param: callback: the callback function to execute on response received. 
     */

    
    doHttp: function(uri, calendarDatetime, callback, method, waitLonger) {
        var hdrs = {}
        if (!method || method == "") {
            method = "HEAD"
        }

        var xhr = new XMLHttpRequest();
        xhr.open(method, uri)
        if (calendarDatetime) {
            xhr.setRequestHeader("Accept-Datetime", calendarDatetime.toGMTString())
            //console.log(typeof(calendarDatetime))
            //console.log("hdt: " + calendarDatetime.toGMTString())
        }
        //console.log("url: " + uri)

        xhr.onreadystatechange = function onreadystatechange() {
            if (xhr.readyState === 4) {
                //console.log("dohttp: " + uri)
                //console.log("dohttp: " + xhr.getAllResponseHeaders())
                callback(uri, xhr.getAllResponseHeaders()); 
            }
        };
        xhr.send(null)
    }
}

function MementoUtils() {}

MementoUtils.prototype = {

    getProtocolAndBaseUrl: function(url) {
            var protocol = ""
            if (url.slice(0,7) == "http://") {
                protocol = "http://"
            }
            else if (details.url.slice(0,8) == "https://") {
                protocol = "https://"
            }
            if (protocol == "") {
                return false
            }
            var baseUrl = url.replace(protocol, "")
            baseUrl = baseUrl.split("/")[0] 

            return [protocol, baseUrl]
    },


    /**
     * A function to get the parameter value from a url.
     * @param: url: the url with parameters.
     * @param: name: the key/name of the parameter.
     * @return: the value for the key/name.
     */
    getUrlParameter: function(url, name) {
        return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(url)||[,""])[1].replace(/\+/g, '%20'))||null;
    },


    /**
     * Parses link headers and returns an object. The link header is 
     * processed character by character.
     * @param: link: the link header as a string. 
     * @return: object: links[uri][rel] = relValue 
     */

    parseLinkHeader : function(link) {
        var state = 'start';
        var data = link.split('');
        var uri = '';
        var pt = '';
        var pv = '';
        var d = '';

        var links = {};
        while (data.length) {
            if (state == 'start') {
                d = data.shift();
                while (d.match(/\s/)) d = data.shift();
                if (d != "<") break;
                state = "uri";
            } else if (state == "uri") {
                uri = '';
                d = data.shift();
                while (d != ">") {
                    uri += d;
                    d = data.shift();
                }

                // Check for broken header with a > in the URL
                uritmp = '>';
                d = data.shift();
                while (d.match(/\s/)) {
                    uritmp += d;
                    d = data.shift();
                }
                // Now d is the first non space character, and should be either , or ;
                if (d == ',' || d ==';'){
                    // We're okay
                    if (!links[uri]) {
                        links[uri] = {};
                    }
                    state = "paramstart";
                } else{
                	// stay in state uri, and continue to append
                    uritmp+=d;
                    uri += uritmp;
                }
                
            } else if (state == 'paramstart') {
                while (d.match(/\s/) != null) d = data.shift();
                if (d == ";") state = 'linkparam';
                else if (d == ',') state = 'start';
                else break
            } else if (state == 'linkparam') {
                d = data.shift();
                while (d.match(/\s/) != null) d = data.shift();
                pt = '';
                while (data.length && d != ' ' && d != '=') {
                    pt += d;
                    d = data.shift();
                }
                while (d.match(/\s/) != null) d = data.shift();
                if (d != "=") break
                state='linkvalue';
                if (links[uri][pt] == undefined) {
                    links[uri][pt] = new Array();
                }
            } else if (state == 'linkvalue') {
                d = data.shift();
                while (d.match(/\s/) != null) d = data.shift();
                pv = '';
                if (d == '"') {
                    pd = d;
                    d = data.shift();
                    while (d != undefined && d != '"' && pd != '\\') {
                        pv += d;
                        pd = d;
                        d = data.shift();
                    }
                } else {
                    while (d != undefined && d != " " && d != ',' && d != ';') {
                        pv += d;
                        d = data.shift();
                    }
                    if (data.length) data.unshift(d);
                }
                state = 'paramstart';
                if(data != undefined){
                    d = data.shift();
                }
                if (pt == 'rel') links[uri][pt] = links[uri][pt].concat(pv.split(' '));
                else links[uri][pt].push(pv);
            }
        }
        return links;
    },

    /**
     * Returns the uri for the rel type requested.
     * @param: lhash: the object returned from parseLinkHeader method.
     * @param: rel: the rel type requested.
     * @return: the matched uri or null on no match.
     */

    getUriForRel : function(lhash, relValue) {
        return this.getUriFromLinkHeader(lhash, "rel", relValue)
    },
    
    getUriForDatetime : function(lhash, relValue) {
        return this.getUriFromLinkHeader(lhash, "datetime", relValue)
    },
    
    getUriFromLinkHeader: function(lhash, relKey, relValue) {
    	for (var uri in lhash) {
        	params = lhash[uri];
            vals = lhash[uri][relKey];
            if (vals != undefined) {
                for (var v=0, val; val= vals[v]; v++) {
                    if (val == relValue) {
                        return uri;
                    }
                }
            }
        }
        return null;
    },

    /**
     * Given a header name, this method returns the http header value.
     * The headers can be either an object of key value pairs,
     * or a string.
     * @param: headers: the http headers
     * @param: headerName: the requested header name
     * @return: the value of the header or false if none found.
     */

    getHeader: function(headers, headerName) {
        if (typeof(headers) == "object") {
            for (var h in headers) {
                if (h.toLowerCase() == headerName.toLowerCase()) {
                    return headers[h]
                }
            }
        }
        else if (typeof(headers) == "string"){
            var headerLines = headers.split("\n")
            for (var i=0,header; header=headerLines[i]; i++) {
                var linkParts = header.split(':')
                if (linkParts[0].trim().toLowerCase() == headerName.toLowerCase()) {
                    return linkParts.slice(1, linkParts.length).join(":")
                }
            }
        }
        return false
    },

    /**
     * A wrapper function that gets the link headers, parses it, 
     * and returns the uri for the rel type asked. 
     * @param: headers: the http response headers.
     * @param: the rel type to look for in the link header. 
     * @return: the url for the rel type.
     */

    getRelUriFromHeaders: function(headers, rel) {
        var linkHeader = this.getHeader(headers, "link")
        var relUrl = false
        if (linkHeader != "") {
            var links = this.parseLinkHeader(linkHeader.trim())
            relUrl = this.getUriForRel(links, rel)
        }
        return relUrl
    },

    getDatetimeUriFromHeaders: function(headers, dt) {
        var linkHeader = this.getHeader(headers, "link")
        var relUrl = false
        if (linkHeader != "") {
            var links = this.parseLinkHeader(linkHeader.trim())
            relUrl = this.getUriForDatetime(links, dt)
        }
        return relUrl
    },

    /** 
     * This is for synchrous ajax requests. Used only when processing mementos for
     * embedded resources. 
     * TODO: re-write the handlers to process async requests and remove this function.
     * @param: uri: the request url
     * @param: method: the request http method
     * @param: setAcceptDatetime: the optional accept-datetime to set
     * @return: jqXHR: the jquery ajax object.
     */

    ajax: function(uri, method, acceptDatetime) {
        var hdrs = {}
        if (!method || method == "") {
            method = "HEAD"
        }

        var xhr = new XMLHttpRequest();
        xhr.open(method, uri, false)
        if (acceptDatetime) {
            xhr.setRequestHeader("Accept-Datetime", acceptDatetime.toGMTString())
        }
        xhr.send(null)
        if (xhr.status == 200) {
            console.log(uri, acceptDatetime)
            return xhr
        }
    },

    /**
     * A function to append accept-datetime header to request headers. 
     * @param: headers: the original request headers
     * @param: datetime: the accept-datetime value to append
     */
    appendAcceptDatetimeHeader: function(headers, datetime) {
        for (var i=0, h; h=headers[i]; i++) {
            if (h['name'].toLowerCase() == "accept-datetime") {
                h.pop()
                break;
            }
        }
        headers.push({"name": "Accept-Datetime", "value": datetime}) 
        return headers
    },

    /**
     * A list of uris or uri regex patters to not do memento on. 
     * @return: an array of uris and patterns. 
     */
    getWhiteList: function() {
        var uriWhitelist = [];
        uriWhitelist.push(new RegExp('google-analytics\\.com')); // everywhere, just ignore

        return uriWhitelist;
    }
}

