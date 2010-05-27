from django.conf import settings
from django.contrib import admin
from django.contrib.admin.util import unquote
from django.contrib.admin.views.main import ChangeList, Paginator
from django.forms.util import flatatt
from django.http import HttpResponse
from django.utils.safestring import mark_safe
from django.utils.encoding import force_unicode
from django import forms

from djangodblog.models import ErrorBatch, Error
from djangodblog.helpers import ImprovedExceptionReporter
from djangodblog.utils import JSONDictFormField

import cgi
import base64
import re
import logging
import sys
try:
    import cPickle as pickle
except ImportError:
    import pickle

logger = logging.getLogger('dblog')

class PreformattedText(forms.Textarea):
    input_type = 'textarea'
    
    def render(self, name, value, attrs=None):
        if value is None: value = ''
        if value != '':
            # Only add the 'value' attribute if a value is non-empty.
            value = force_unicode(value)
        return mark_safe(u'<pre style="clear:left;display:block;padding-top:5px;white-space: pre-wrap;white-space: -moz-pre-wrap;white-space: -pre-wrap;white-space: -o-pre-wrap;word-wrap: break-word;">%s</pre>' % (value,))

class Link(forms.TextInput):
    input_type = 'a'

    def render(self, name, value, attrs=None):
        if value is None: value = ''
        if value != '':
            # Only add the 'value' attribute if a value is non-empty.
            value = force_unicode(value)
        return mark_safe(u'<a href="%s">%s</a>' % (value, cgi.escape(value)))

class ErrorBatchAdminForm(forms.ModelForm):
    traceback = forms.CharField(widget=PreformattedText())
    url = forms.CharField(widget=Link())
    
    class Meta:
        fields = ('url', 'logger', 'server_name', 'class_name', 'level', 'message', 'times_seen', 'first_seen', 'last_seen', 'traceback')
        model = ErrorBatch

class ErrorAdminForm(forms.ModelForm):
    traceback = forms.CharField(widget=PreformattedText())
    url = forms.CharField(widget=Link())
    
    class Meta:
        fields = ('url', 'logger', 'server_name', 'class_name', 'level', 'message', 'datetime', 'traceback')
        model = ErrorBatch

class EfficientPaginator(Paginator):
    def _get_count(self):
        # because who really cares if theres a next page or not in the admin?
        return 10000000000000
    count = property(_get_count)

class EfficientChangeList(ChangeList):
    def get_results(self, request):
        paginator = EfficientPaginator(self.query_set, self.list_per_page)
        # Get the number of objects, with admin filters applied.
        result_count = paginator.count
        
        multi_page = result_count > self.list_per_page

        result_count = ''

        # Get the list of objects to display on this page.
        try:
            result_list = paginator.page(self.page_num+1).object_list
        except InvalidPage:
            result_list = ()

        self.full_result_count = result_count
        self.result_count = result_count
        self.result_list = result_list
        self.can_show_all = False
        self.multi_page = multi_page
        self.paginator = paginator

class EfficientModelAdmin(admin.ModelAdmin):
    def get_changelist(self, request, **kwargs):
        return EfficientChangeList

UNDEFINED = object()

class FakeRequest(object):
    def build_absolute_uri(self): return self.url

class ErrorBatchAdmin(EfficientModelAdmin):
    form            = ErrorBatchAdminForm
    list_display    = ('shortened_url', 'logger', 'server_name', 'times_seen', 'last_seen')
    list_display_links = ('shortened_url',)
    list_filter     = ('status', 'level', 'last_seen')
    ordering        = ('-last_seen',)
    actions         = ('resolve_errorbatch',)
    search_fields   = ('url', 'class_name', 'message', 'traceback', 'server_name')
    readonly_fields = ('logger', 'server_name', 'class_name', 'level', 'message', 'times_seen', 'first_seen', 'last_seen')
    fieldsets       = (
        (None, {
            'fields': ('url', 'logger', 'server_name', 'class_name', 'level', 'message', 'times_seen', 'first_seen', 'last_seen', 'traceback')
        }),
    )
    
    def resolve_errorbatch(self, request, queryset):
        rows_updated = queryset.update(status=1)
        
        if rows_updated == 1:
            message_bit = "1 error summary was"
        else:
            message_bit = "%s error summaries were" % rows_updated
        self.message_user(request, "%s resolved." % message_bit)
        
    resolve_errorbatch.short_description = 'Resolve selected error summaries'

class ErrorAdmin(EfficientModelAdmin):
    form            = ErrorAdminForm
    list_display    = ('shortened_url', 'logger', 'server_name', 'datetime')
    list_display_links = ('shortened_url',)
    list_filter     = ('level', 'datetime')
    ordering        = ('-id',)
    search_fields   = ('url', 'class_name', 'message', 'traceback', 'server_name')
    readonly_fields = ('logger', 'server_name', 'class_name', 'level', 'message', 'datetime')
    fieldsets       = (
        (None, {
            'fields': ('url', 'logger', 'server_name', 'class_name', 'level', 'message', 'datetime', 'traceback')
        }),
    )
    
    _header_re = re.compile(r'(<(?:style|script)[^>]*>.+</(?:style|script)>)', re.I | re.S)
    _body_re = re.compile(r'<body>(.+)<\/body>', re.I | re.S)
    
    def change_view(self, request, object_id, extra_context={}):
        obj = self.get_object(request, unquote(object_id))
        has_traceback = getattr(settings, 'DBLOG_ENHANCED_TRACEBACKS', True) and bool('exc' in obj.data) and 'raw' not in request.GET
        if has_traceback:
            try:
                extra_context.update(self.get_traceback_context(request, obj))
            except Exception:
                exc_info = sys.exc_info()
                logger.exception(exc_info[1])
                has_traceback = False
        extra_context.update({
            'has_traceback': has_traceback,
            'instance': obj,
        })
        return super(ErrorAdmin, self).change_view(request, object_id, extra_context)
        
    def get_traceback_context(self, request, obj):
        """
        Create a technical server error response. The last three arguments are
        the values returned from sys.exc_info() and friends.
        """
        try:
            module, args, frames = pickle.loads(base64.b64decode(obj.data['exc']).decode('zlib'))
        except:
            module, args, frames = pickle.loads(base64.b64decode(obj.data['exc']))
        obj.class_name = str(obj.class_name)
    
        if module == '__builtin__':
            try:
                exc_type = __builtins__[obj.class_name]
            except KeyError:
                exc_type = type(obj.class_name, (Exception,), {})
        else:
            try:
                exc_type = __import__(module + '.' + obj.class_name, {}, {}, obj.class_name)
            except ImportError:
                exc_type = type(obj.class_name, (Exception,), {})
        exc_value = exc_type(obj.message)
        exc_value.args = args
    
        fake_request = FakeRequest()
        fake_request.META = obj.data['META']
        fake_request.GET = obj.data['GET']
        fake_request.POST = obj.data['POST']
        fake_request.FILES = obj.data.get('FILES', {})
        fake_request.COOKIES = obj.data.get('COOKIES', {})
        fake_request.url = obj.url
        fake_request.path_info = '/' + obj.url.split('/', 3)[-1]

        reporter = ImprovedExceptionReporter(fake_request, exc_type, exc_value, frames)
        html = reporter.get_traceback_html()
        
        return {
            'error_body': mark_safe(self._body_re.search(html).group(1)),
            'error_headers': mark_safe(self._header_re.search(html).group(1)),
        }

admin.site.register(ErrorBatch, ErrorBatchAdmin)
admin.site.register(Error, ErrorAdmin)
