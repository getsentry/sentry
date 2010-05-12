from django.contrib import admin
from django.http import HttpResponse
from django.contrib.admin.util import unquote

from djangodblog.models import ErrorBatch, Error
from djangodblog.helpers import ImprovedExceptionReporter

import base64
try:
    import cPickle as pickle
except ImportError:
    import pickle


class ErrorBatchAdmin(admin.ModelAdmin):
    list_display    = ('shortened_url', 'logger', 'server_name', 'times_seen', 'last_seen')
    list_display_links = ('shortened_url',)
    list_filter     = ('logger', 'server_name', 'status', 'last_seen', 'class_name')
    ordering        = ('-last_seen',)
    actions         = ('resolve_errorbatch',)
    search_fields   = ('url', 'class_name', 'message', 'traceback', 'server_name')
    readonly_fields = ('url', 'logger', 'server_name', 'class_name', 'level', 'message', 'traceback', 'times_seen', 'first_seen', 'last_seen')
    
    def resolve_errorbatch(self, request, queryset):
        rows_updated = queryset.update(status=1)
        
        if rows_updated == 1:
            message_bit = "1 error summary was"
        else:
            message_bit = "%s error summaries were" % rows_updated
        self.message_user(request, "%s resolved." % message_bit)
        
    resolve_errorbatch.short_description = 'Resolve selected error summaries'

class ErrorAdmin(admin.ModelAdmin):
    list_display    = ('shortened_url', 'logger', 'server_name', 'datetime')
    list_display_links = ('shortened_url',)
    list_filter     = ('logger', 'class_name', 'datetime', 'server_name')
    ordering        = ('-datetime',)
    search_fields   = ('url', 'class_name', 'message', 'traceback', 'server_name')
    readonly_fields = ('url', 'logger', 'server_name', 'class_name', 'level', 'message', 'traceback', 'datetime', 'data')

    def change_view(self, request, object_id, extra_context={}):
        obj = self.get_object(request, unquote(object_id))
        
        if 'exc' in obj.data:
            """
            Create a technical server error response. The last three arguments are
            the values returned from sys.exc_info() and friends.
            """
            module, args, frames = pickle.loads(base64.b64decode(obj.data['exc']))
            
            obj.class_name = str(obj.class_name)
            
            if module == '__builtin__':
                exc_type = __builtins__[obj.class_name]
            else:
                exc_type = __import__(module + '.' + obj.class_name, {}, {}, obj.class_name)
            exc_value = exc_type(obj.message)
            exc_value.args = args
            
            reporter = ImprovedExceptionReporter(request, exc_type, exc_value, frames)
            html = reporter.get_traceback_html()
            return HttpResponse(html, mimetype='text/html')
        return super(ErrorAdmin, self).change_view(request, object_id, extra_context)

admin.site.register(ErrorBatch, ErrorBatchAdmin)
admin.site.register(Error, ErrorAdmin)
