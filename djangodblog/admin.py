from django.contrib import admin

from models import ErrorBatch, Error

class ErrorBatchAdmin(admin.ModelAdmin):
    list_display    = ('class_name', 'status', 'message', 'last_seen', 'times_seen', 'url', 'server_name')
    list_filter     = ('class_name', 'server_name', 'status')
    ordering        = ('status', '-last_seen')

class ErrorAdmin(admin.ModelAdmin):
    list_display    = ('class_name', 'message', 'datetime', 'url', 'server_name')
    list_filter     = ('class_name', 'datetime', 'server_name')
    ordering        = ('-datetime',)

admin.site.register(ErrorBatch, ErrorBatchAdmin)
admin.site.register(Error, ErrorAdmin)
