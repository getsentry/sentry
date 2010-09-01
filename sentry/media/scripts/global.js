function getElementsByClassName(oElm, strTagName, strClassName){
	// Written by Jonathan Snook, http://www.snook.ca/jon; Add-ons by Robert Nyman, http://www.robertnyman.com
	var arrElements = (strTagName == "*" && document.all)? document.all :
	oElm.getElementsByTagName(strTagName);
	var arrReturnElements = new Array();
	strClassName = strClassName.replace(/\-/g, "\\-");
	var oRegExp = new RegExp("(^|\\s)" + strClassName + "(\\s|$)");
	var oElement;
	for(var i=0; i<arrElements.length; i++){
		oElement = arrElements[i];
		if(oRegExp.test(oElement.className)){
			arrReturnElements.push(oElement);
		}
	}
	return (arrReturnElements)
}
function hideAll(elems) {
  for (var e = 0; e < elems.length; e++) {
	elems[e].style.display = 'none';
  }
}
window.onload = function() {
  hideAll(getElementsByClassName(document, 'table', 'vars'));
  hideAll(getElementsByClassName(document, 'ol', 'pre-context'));
  hideAll(getElementsByClassName(document, 'ol', 'post-context'));
  hideAll(getElementsByClassName(document, 'div', 'pastebin'));
}
function toggle() {
  for (var i = 0; i < arguments.length; i++) {
	var e = document.getElementById(arguments[i]);
	if (e) {
	  e.style.display = e.style.display == 'none' ? 'block' : 'none';
	}
  }
  return false;
}
function varToggle(link, id) {
  toggle('v' + id);
  var s = link.getElementsByTagName('span')[0];
  var uarr = String.fromCharCode(0x25b6);
  var darr = String.fromCharCode(0x25bc);
  s.innerHTML = s.innerHTML == uarr ? darr : uarr;
  return false;
}
function switchPastebinFriendly(link) {
  s1 = "Switch to copy-and-paste view";
  s2 = "Switch back to interactive view";
  link.innerHTML = link.innerHTML == s1 ? s2 : s1;
  toggle('browserTraceback', 'pastebinTraceback');
  return false;
}

$.fn.setAllToMaxHeight = function(){
	return this.height( Math.max.apply(this, $.map( this , function(e){ return $(e).height() }) ) );
}

$(document).ready(function(){
	//$("div.column").setAllToMaxHeight();
	setTimeout('sentryRefresh()', 3000);
});

function sentryRefresh(){
    $.ajax({
      url: './',
      dataType: 'json',
      data: {
          logger: '{{ logger }}',
          server_name: '{{ server_name }}',
          level: '{{ level }}'
      },
      success: function(groups){
          // $('#message_list').each(function(){
          //               $(this).removeClass('fresh');
          //           })
          for (var i=groups.length-1, el, row; (el=groups[i]); i--) {
              var id = el[0];
              var data = el[1];
              if (row = $('#group_' + id)) {
                  row.remove();
                  $('#message_list').prepend(data.html);
                  if (row.attr('data-sentry-count') != data.count) {
                      $('#group_' + el[0]).addClass('fresh');
                  }
              } else {
                  $('#message_list').prepend(data.html);
                  $('#group_' + el[0]).addClass('fresh')
              }
          }
          $('#message_list .fresh').css('background-color', '#ccc').animate({backgroundColor: '#fff'}, 1200, function() { 
                $(this).removeClass('fresh');
          });
          // make sure we limit the number shown
          var count = 0;
          $('#message_list').each(function(){
              count++;
              if (count > 50) {
                  $(this).remove();
              }
          })
      }
    });
    setTimeout('sentryRefresh()', 3000);
}