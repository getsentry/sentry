from django.contrib import admin
from sentry.models import Project


class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'public', 'date_added', 'status')
    list_filter = ('public', 'status')

admin.site.register(Project, ProjectAdmin)
