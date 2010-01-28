from django.contrib import admin

from models import ErrorBatch, Error

class ErrorBatchAdmin(admin.ModelAdmin):
    list_display    = ('server_name', 'logger', 'class_name', 'status', 'message', 'last_seen', 'times_seen', 'url')
    list_display_links = ('message',)
    list_filter     = ('logger', 'class_name', 'server_name', 'status')
    ordering        = ['-last_seen']
    actions         = ['resolve_errorbatch']

    def resolve_errorbatch(self, request, queryset):
        rows_updated = queryset.update(status=1)
        
        if rows_updated == 1:
            message_bit = "1 error batch was"
        else:
            message_bit = "%s error batches were" % rows_updated
        self.message_user(request, "%s resolved." % message_bit)
        
    resolve_errorbatch.short_description = 'Resolve selected error batches'

class ErrorAdmin(admin.ModelAdmin):
    list_display    = ('logger', 'class_name', 'message', 'datetime', 'url', 'server_name')
    list_filter     = ('logger', 'class_name', 'datetime', 'server_name')
    ordering        = ('-datetime',)

admin.site.register(ErrorBatch, ErrorBatchAdmin)
admin.site.register(Error, ErrorAdmin)
