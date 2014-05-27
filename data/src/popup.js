/**

 * This file is part of the extension Memento for Chrome.
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

function pad(n) {
    return n < 10 ? '0'+n : n
}


var dateBox = document.getElementById("dateBox")
var timeBox = document.getElementById("timeBox")

var setDatetime = document.getElementById("setDatetime")

setDatetime.addEventListener("click", function(event) {
    var dt = dateBox.value + "T" + timeBox.value + "+00:00";
    self.port.emit("save", new Date(dt).toGMTString())
}, false);


self.port.on("show", function(mementoAcceptDatetime) {
    var d = new Date()
    d.setDate(d.getDate() - 1)

    if (mementoAcceptDatetime) {
        d = new Date(mementoAcceptDatetime)
    }

    var selectedDate = d.getUTCFullYear() + "-" + pad(d.getUTCMonth()+1) + "-" + pad(d.getUTCDate())
    var selectedTime = pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + ":" + pad(d.getUTCSeconds())

    dateBox.value = selectedDate
    timeBox.value = selectedTime
    $( "#datepicker" ).datepicker({
        changeMonth: true,
        changeYear: true,
        dateFormat: "yy-mm-dd",
        maxDate: "-1d",
        altField: "#dateBox",
        onChangeMonthYear: function(year, month, inst) {
            var prevDate = $("#dateBox").val()
            var prevDay = prevDate.split("-")[2]
            var currDate = year + "-" + month + "-" + prevDay
            $("#dateBox").val(currDate)
            $( "#datepicker" ).datepicker("setDate", currDate)
        }
    });
    if (!$( "#dateText" ).text())
        $( "#dateText" ).append("Date: ")

    $( "#dateBox" ).change( function() {
            $( "#datepicker" ).datepicker("setDate", $(this).val())
        })
    if (!$( "#timeText" ).text())
        $( "#timeText" ).append("Time: ")

    if (!$( "#descriptionText" ).text())
        $( "#descriptionText" ).append("Select a date for time travel (in GMT). Right click on the page or on links to travel through time.")
    
    if (!$("#setDatetime").text()) {
        $( "#setDatetime" )
        .append("Set")
        .button()

        $( "#cancelDatetime" )
        .append("Cancel")
        .button()
    }
    $( "#datepicker" ).datepicker("setDate", selectedDate)
});

