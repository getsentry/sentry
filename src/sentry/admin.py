from django.contrib import admin
from sentry.models import Project, Team


class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'slug', 'public', 'date_added', 'status')
    list_filter = ('public', 'status')
    search_fields = ('name', 'owner__username', 'owner__email', 'slug')
    raw_id_fields = ('owner',)

admin.site.register(Project, ProjectAdmin)


class TeamAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'slug')
    search_fields = ('name', 'owner__username', 'owner__email', 'slug')
    raw_id_fields = ('owner',)

admin.site.register(Team, TeamAdmin)
