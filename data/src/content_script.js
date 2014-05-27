$( function() {
    var mementoTimeTravelTimeMapDiv = document.createElement("div")
    mementoTimeTravelTimeMapDiv.id = 'mementoTimeTravelTimeMapDialog'

    var req_url = document.location.href

    var mementoTimeTravelTimeMapIframe = document.createElement('iframe');
    mementoTimeTravelTimeMapIframe.id = "mementoTimeTravelTimeMapiframe"
    mementoTimeTravelTimeMapIframe.src = ""
    mementoTimeTravelTimeMapIframe.style.cssText = "width: 99%; height: 99%;";

    mementoTimeTravelTimeMapDiv.appendChild(mementoTimeTravelTimeMapIframe)

    document.body.appendChild(mementoTimeTravelTimeMapDiv)

    $("#mementoTimeTravelTimeMapDialog").dialog({
        title: "Version Overview",
        show: {
            effect: "blind",
            duration: 500
        },
        hide: {
            effect: "blind",
            duration: 500
        },
        width: document.width * 0.6,
        height: $(window).height() - 30,
        modal: true,
        autoOpen: false,
        close: function(event, ui) {
            $("#mementoTimeTravelTimeMapDialog").remove()
        },
        focus: function(event, ui) {
            $("#mementoTimeTravelTimeMapiframe").attr("src", chrome.extension.getURL("timemap.html?org_url="+escape(req_url)));
        },

    })

    $("#mementoTimeTravelTimeMapDialog").dialog("open")
    $(".ui-dialog").css("z-index", "20000000000");
    $(".ui-widget-overlay").css("opacity", "0.7");

})
