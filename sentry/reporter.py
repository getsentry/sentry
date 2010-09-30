from pprint import pformat

from django.template import Template, Context, TemplateDoesNotExist
from django.utils.encoding import smart_unicode
from django.utils.html import escape
from django.views.debug import ExceptionReporter, linebreak_iter

class ImprovedExceptionReporter(ExceptionReporter):
    def __init__(self, request, exc_type, exc_value, frames, template_info=None):
        ExceptionReporter.__init__(self, request, exc_type, exc_value, None)
        self.frames = frames
        self._template = template_info

    def get_traceback_frames(self):
        return self.frames

    def get_template_exception_info(self):
        template_source, start, end, name = self._template
        context_lines = 10
        line = 0
        upto = 0
        source_lines = []
        before = during = after = ""
        for num, next in enumerate(linebreak_iter(template_source)):
            if start >= upto and end <= next:
                line = num
                before = escape(template_source[upto:start])
                during = escape(template_source[start:end])
                after = escape(template_source[end:next])
            source_lines.append( (num, escape(template_source[upto:next])) )
            upto = next
        total = len(source_lines)

        top = max(1, line - context_lines)
        bottom = min(total, line + 1 + context_lines)

        self.template_info = {
            'message': self.exc_value.args[0],
            'source_lines': source_lines[top:bottom],
            'before': before,
            'during': during,
            'after': after,
            'top': top,
            'bottom': bottom,
            'total': total,
            'line': line,
            'name': name,
        }

    def get_traceback_html(self):
        "Return HTML code for traceback."

        if issubclass(self.exc_type, TemplateDoesNotExist):
            self.template_does_not_exist = True
        if self._template:
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

class FakeRequest(object):
    GET = {}
    POST = {}
    META = {}
    COOKIES = {}
    FILES = {}
    
    def __repr__(self):
        # Since this is called as part of error handling, we need to be very
        # robust against potentially malformed input.
        try:
            get = pformat(self.GET)
        except:
            get = '<could not parse>'
        try:
            post = pformat(self.POST)
        except:
            post = '<could not parse>'
        try:
            cookies = pformat(self.COOKIES)
        except:
            cookies = '<could not parse>'
        try:
            meta = pformat(self.META)
        except:
            meta = '<could not parse>'
        return '<Request\nGET:%s,\nPOST:%s,\nCOOKIES:%s,\nMETA:%s>' % \
            (get, post, cookies, meta)

    def build_absolute_uri(self): return self.url

TECHNICAL_500_TEMPLATE = """
<div id="summary">
  <h1>{{ exception_type }}</h1>
  <pre class="exception_value">{{ exception_value|escape }}</pre>
  <table class="meta">
    <tr>
      <th>Request Method:</th>
      <td>{{ request.META.REQUEST_METHOD }}</td>
    </tr>
    {% if request.path_info %}
    <tr>
      <th>Request URL:</th>
      <td><a href="{{ request.build_absolute_uri|escape }}">{{ request.build_absolute_uri|escape }}</a></td>
    </tr>
    {% endif %}
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
                  <td class="code"><pre>{{ var.1|pprint|escape }}</pre></td>
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
  <div id="pastebinTraceback" class="pastebin">
    <textarea id="traceback_area" cols="140" rows="25">
Environment:

{% if request.META %}Request Method: {{ request.META.REQUEST_METHOD }}{% endif %}
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
  </div>
</div>
"""