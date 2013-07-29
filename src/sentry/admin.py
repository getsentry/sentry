from django.contrib import admin
from django.utils.safestring import mark_safe
from django.utils.html import escape
from sentry.models import Project, Team


class ProjectAdmin(admin.ModelAdmin):
    list_display = ('full_slug', 'owner', 'platform', 'date_added')
    list_filter = ('status', 'platform', 'public')
    search_fields = ('name', 'owner__username', 'owner__email', 'team__slug',
                     'team__name', 'slug')
    raw_id_fields = ('owner', 'team')

    def full_slug(self, instance):
        if not instance.team:
            slug = instance.slug
        else:
            slug = '%s/%s' % (instance.team.slug, instance.slug)
        return mark_safe('%s<br><small>%s</small>' % (
            escape(slug), escape(instance.name)))

admin.site.register(Project, ProjectAdmin)


class TeamAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'slug')
    search_fields = ('name', 'owner__username', 'owner__email', 'slug')
    raw_id_fields = ('owner',)

admin.site.register(Team, TeamAdmin)
