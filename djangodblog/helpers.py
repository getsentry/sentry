from django.conf import settings
from django.template import (Template, Context, TemplateDoesNotExist,
    TemplateSyntaxError)
from django.utils.encoding import smart_unicode
from django.utils.hashcompat import md5_constructor
from django.views.debug import ExceptionReporter

class ImprovedExceptionReporter(ExceptionReporter):
    def __init__(self, request, exc_type, exc_value, frames):
        ExceptionReporter.__init__(self, request, exc_type, exc_value, None)
        self.frames = frames

    def get_traceback_frames(self):
        return self.frames

    def get_traceback_html(self):
        "Return HTML code for traceback."

        if issubclass(self.exc_type, TemplateDoesNotExist):
            self.template_does_not_exist = True
        if (settings.TEMPLATE_DEBUG and hasattr(self.exc_value, 'source') and
            isinstance(self.exc_value, TemplateSyntaxError)):
            self.get_template_exception_info()

        frames = self.get_traceback_frames()

        unicode_hint = ''
        if issubclass(self.exc_type, UnicodeError):
            start = getattr(self.exc_value, 'start', None)
            end = getattr(self.exc_value, 'end', None)
            if start is not None and end is not None:
                unicode_str = self.exc_value.args[1]
                unicode_hint = smart_unicode(unicode_str[max(start-5, 0):min(end+5, len(unicode_str))], 'ascii', errors='replace')
        t = Template(TECHNICAL_500_TEMPLATE, name='Technical 500 template')
        c = Context({
            'exception_type': self.exc_type.__name__,
            'exception_value': smart_unicode(self.exc_value, errors='replace'),
            'unicode_hint': unicode_hint,
            'frames': frames,
            'lastframe': frames[-1],
            'request': self.request,
            'template_info': self.template_info,
            'template_does_not_exist': self.template_does_not_exist,
        })
        return t.render(c)

def construct_checksum(error):
    checksum = md5_constructor(str(error.level))
    checksum.update(error.class_name or '')
    message = error.traceback or error.message
    if isinstance(message, unicode):
        message = message.encode('utf-8', 'replace')
    checksum.update(message)
    return checksum.hexdigest()

TECHNICAL_500_TEMPLATE = """
<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">
<html lang="en">
<head>
  <meta http-equiv="content-type" content="text/html; charset=utf-8">
  <meta name="robots" content="NONE,NOARCHIVE">
  <title>{{ exception_type }} at {{ request.path_info|escape }}</title>
  <style type="text/css">
    html * { padding:0; margin:0; }
    body * { padding:10px 20px; }
    body * * { padding:0; }
    body { font:small sans-serif; }
    body>div { border-bottom:1px solid #ddd; }
    h1 { font-weight:normal; }
    h2 { margin-bottom:.8em; }
    h2 span { font-size:80%; color:#666; font-weight:normal; }
    h3 { margin:1em 0 .5em 0; }
    h4 { margin:0 0 .5em 0; font-weight: normal; }
    table { border:1px solid #ccc; border-collapse: collapse; width:100%; background:white; }
    tbody td, tbody th { vertical-align:top; padding:2px 3px; }
    thead th { padding:1px 6px 1px 3px; background:#fefefe; text-align:left; font-weight:normal; font-size:11px; border:1px solid #ddd; }
    tbody th { width:12em; text-align:right; color:#666; padding-right:.5em; }
    table.vars { margin:5px 0 2px 40px; }
    table.vars td, table.req td { font-family:monospace; }
    table td.code { width:100%; }
    table td.code div { overflow:hidden; }
    table.source th { color:#666; }
    table.source td { font-family:monospace; white-space:pre; border-bottom:1px solid #eee; }
    ul.traceback { list-style-type:none; }
    ul.traceback li.frame { margin-bottom:1em; }
    div.context { margin: 10px 0; }
    div.context ol { padding-left:30px; margin:0 10px; list-style-position: inside; }
    div.context ol li { font-family:monospace; white-space:pre; color:#666; cursor:pointer; }
    div.context ol.context-line li { color:black; background-color:#ccc; }
    div.context ol.context-line li span { float: right; }
    div.commands { margin-left: 40px; }
    div.commands a { color:black; text-decoration:none; }
    #summary { background: #ffc; }
    #summary h2 { font-weight: normal; color: #666; }
    #explanation { background:#eee; }
    #template, #template-not-exist { background:#f6f6f6; }
    #template-not-exist ul { margin: 0 0 0 20px; }
    #unicode-hint { background:#eee; }
    #traceback { background:#eee; }
    #requestinfo { background:#f6f6f6; padding-left:120px; }
    #summary table { border:none; background:transparent; }
    #requestinfo h2, #requestinfo h3 { position:relative; margin-left:-100px; }
    #requestinfo h3 { margin-bottom:-1em; }
    .error { background: #ffc; }
    .specific { color:#cc3300; font-weight:bold; }
    h2 span.commands { font-size:.7em;}
    span.commands a:link {color:#5E5694;}
    pre.exception_value { font-family: sans-serif; color: #666; font-size: 1.5em; margin: 10px 0 10px 0; }
  </style>
  <script type="text/javascript">
  //<!--
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
    //-->
  </script>
</head>
<body>
<div id="summary">
  <h1>{{ exception_type }} at {{ request.path_info|escape }}</h1>
  <pre class="exception_value">{{ exception_value|escape }}</pre>
  <table class="meta">
    <tr>
      <th>Request Method:</th>
      <td>{{ request.META.REQUEST_METHOD }}</td>
    </tr>
    <tr>
      <th>Request URL:</th>
      <td>{{ request.build_absolute_uri|escape }}</td>
    </tr>
    <tr>
      <th>Exception Type:</th>
      <td>{{ exception_type }}</td>
    </tr>
    <tr>
      <th>Exception Value:</th>
      <td><pre>{{ exception_value|escape }}</pre></td>
    </tr>
    <tr>
      <th>Exception Location:</th>
      <td>{{ lastframe.filename|escape }} in {{ lastframe.function|escape }}, line {{ lastframe.lineno }}</td>
    </tr>
  </table>
</div>
{% if unicode_hint %}
<div id="unicode-hint">
    <h2>Unicode error hint</h2>
    <p>The string that could not be encoded/decoded was: <strong>{{ unicode_hint|escape }}</strong></p>
</div>
{% endif %}
{% if template_info %}
<div id="template">
   <h2>Template error</h2>
   <p>In template <code>{{ template_info.name }}</code>, error at line <strong>{{ template_info.line }}</strong></p>
   <h3>{{ template_info.message }}</h3>
   <table class="source{% if template_info.top %} cut-top{% endif %}{% ifnotequal template_info.bottom template_info.total %} cut-bottom{% endifnotequal %}">
   {% for source_line in template_info.source_lines %}
   {% ifequal source_line.0 template_info.line %}
       <tr class="error"><th>{{ source_line.0 }}</th>
       <td>{{ template_info.before }}<span class="specific">{{ template_info.during }}</span>{{ template_info.after }}</td></tr>
   {% else %}
      <tr><th>{{ source_line.0 }}</th>
      <td>{{ source_line.1 }}</td></tr>
   {% endifequal %}
   {% endfor %}
   </table>
</div>
{% endif %}
<div id="traceback">
  <h2>Traceback <span class="commands"><a href="#" onclick="return switchPastebinFriendly(this);">Switch to copy-and-paste view</a></span></h2>
  {% autoescape off %}
  <div id="browserTraceback">
    <ul class="traceback">
      {% for frame in frames %}
        <li class="frame">
          <code>{{ frame.filename|escape }}</code> in <code>{{ frame.function|escape }}</code>

          {% if frame.context_line %}
            <div class="context" id="c{{ frame.id }}">
              {% if frame.pre_context %}
                <ol start="{{ frame.pre_context_lineno }}" class="pre-context" id="pre{{ frame.id }}">{% for line in frame.pre_context %}<li onclick="toggle('pre{{ frame.id }}', 'post{{ frame.id }}')">{{ line|escape }}</li>{% endfor %}</ol>
              {% endif %}
              <ol start="{{ frame.lineno }}" class="context-line"><li onclick="toggle('pre{{ frame.id }}', 'post{{ frame.id }}')">{{ frame.context_line|escape }} <span>...</span></li></ol>
              {% if frame.post_context %}
                <ol start='{{ frame.lineno|add:"1" }}' class="post-context" id="post{{ frame.id }}">{% for line in frame.post_context %}<li onclick="toggle('pre{{ frame.id }}', 'post{{ frame.id }}')">{{ line|escape }}</li>{% endfor %}</ol>
              {% endif %}
            </div>
          {% endif %}

          {% if frame.vars %}
            <div class="commands">
                <a href="#" onclick="return varToggle(this, '{{ frame.id }}')"><span>&#x25b6;</span> Local vars</a>
            </div>
            <table class="vars" id="v{{ frame.id }}">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {% for var in frame.vars|dictsort:"0" %}
                  <tr>
                    <td>{{ var.0|escape }}</td>
                    <td class="code"><div>{{ var.1|pprint|escape }}</div></td>
                  </tr>
                {% endfor %}
              </tbody>
            </table>
          {% endif %}
        </li>
      {% endfor %}
    </ul>
  </div>
  {% endautoescape %}
  <form action="http://dpaste.com/" name="pasteform" id="pasteform" method="post">
  <div id="pastebinTraceback" class="pastebin">
    <input type="hidden" name="language" value="PythonConsole">
    <input type="hidden" name="title" value="{{ exception_type|escape }} at {{ request.path_info|escape }}">
    <input type="hidden" name="source" value="Django Dpaste Agent">
    <input type="hidden" name="poster" value="Django">
    <textarea name="content" id="traceback_area" cols="140" rows="25">
Environment:

Request Method: {{ request.META.REQUEST_METHOD }}
Request URL: {{ request.build_absolute_uri|escape }}
Python Version: {{ sys_version_info }}

{% if template_does_not_exist %}Template Loader Error: (Unavailable in db-log)
{% endif %}{% if template_info %}
Template error:
In template {{ template_info.name }}, error at line {{ template_info.line }}
   {{ template_info.message }}{% for source_line in template_info.source_lines %}{% ifequal source_line.0 template_info.line %}
   {{ source_line.0 }} : {{ template_info.before }} {{ template_info.during }} {{ template_info.after }}
{% else %}
   {{ source_line.0 }} : {{ source_line.1 }}
{% endifequal %}{% endfor %}{% endif %}
Traceback:
{% for frame in frames %}File "{{ frame.filename|escape }}" in {{ frame.function|escape }}
{% if frame.context_line %}  {{ frame.lineno }}. {{ frame.context_line|escape }}{% endif %}
{% endfor %}
Exception Type: {{ exception_type|escape }} at {{ request.path_info|escape }}
Exception Value: {{ exception_value|escape }}
</textarea>
  <br><br>
  <input type="submit" value="Share this traceback on a public Web site">
  </div>
</form>
</div>

<div id="requestinfo">
  <h2>Request information</h2>

  <h3 id="get-info">GET</h3>
  {% if request.GET %}
    <table class="req">
      <thead>
        <tr>
          <th>Variable</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {% for var in request.GET.items %}
          <tr>
            <td>{{ var.0 }}</td>
            <td class="code"><div>{{ var.1|pprint }}</div></td>
          </tr>
        {% endfor %}
      </tbody>
    </table>
  {% else %}
    <p>No GET data</p>
  {% endif %}

  <h3 id="post-info">POST</h3>
  {% if request.POST %}
    <table class="req">
      <thead>
        <tr>
          <th>Variable</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {% for var in request.POST.items %}
          <tr>
            <td>{{ var.0 }}</td>
            <td class="code"><div>{{ var.1|pprint }}</div></td>
          </tr>
        {% endfor %}
      </tbody>
    </table>
  {% else %}
    <p>No POST data</p>
  {% endif %}

  <h3 id="cookie-info">COOKIES</h3>
  {% if request.COOKIES %}
    <table class="req">
      <thead>
        <tr>
          <th>Variable</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        {% for var in request.COOKIES.items %}
          <tr>
            <td>{{ var.0 }}</td>
            <td class="code"><div>{{ var.1|pprint }}</div></td>
          </tr>
        {% endfor %}
      </tbody>
    </table>
  {% else %}
    <p>No cookie data</p>
  {% endif %}

  <h3 id="meta-info">META</h3>
  <table class="req">
    <thead>
      <tr>
        <th>Variable</th>
        <th>Value</th>
      </tr>
    </thead>
    <tbody>
      {% for var in request.META.items|dictsort:"0" %}
        <tr>
          <td>{{ var.0 }}</td>
          <td class="code"><div>{{ var.1|pprint }}</div></td>
        </tr>
      {% endfor %}
    </tbody>
  </table>

</div>
</body>
</html>
"""