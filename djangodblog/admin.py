from django.contrib import admin

from djangodblog.models import ErrorBatch, Error

class ErrorBatchAdmin(admin.ModelAdmin):
    list_display    = ('shortened_url', 'logger', 'server_name', 'times_seen', 'last_seen')
    list_display_links = ('shortened_url',)
    list_filter     = ('logger', 'server_name', 'status', 'last_seen', 'class_name')
    ordering        = ('-last_seen',)
    actions         = ('resolve_errorbatch',)

    def resolve_errorbatch(self, request, queryset):
        rows_updated = queryset.update(status=1)
        
        if rows_updated == 1:
            message_bit = "1 error summary was"
        else:
            message_bit = "%s error summaries were" % rows_updated
        self.message_user(request, "%s resolved." % message_bit)
        
    resolve_errorbatch.short_description = 'Resolve selected error summaries'

class ErrorAdmin(admin.ModelAdmin):
    list_display    = ('logger', 'class_name', 'message', 'datetime', 'url', 'server_name')
    list_filter     = ('logger', 'class_name', 'datetime', 'server_name')
    ordering        = ('-datetime',)

admin.site.register(ErrorBatch, ErrorBatchAdmin)
admin.site.register(Error, ErrorAdmin)
