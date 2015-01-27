from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.constants import MEMBER_OWNER
from sentry.models import Project, Team
from sentry.utils.db import attach_foreignkey


@register(Project)
class ProjectSerializer(Serializer):
    def attach_metadata(self, objects, user):
        team_map = dict(
            (t.id, t) for t in Team.objects.get_for_user(user).itervalues()
        )
        for project in objects:
            try:
                team = team_map[project.team_id]
                project.access_type = team.access_type
                project.team = team
            except KeyError:
                project.access_type = None

        attach_foreignkey(objects, Project.team)

    def serialize(self, obj, user):
        d = {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'isPublic': obj.public,
            'dateCreated': obj.date_added,
            'permission': {
                'edit': obj.access_type == MEMBER_OWNER or user.is_superuser,
            },
        }
        if obj.team:
            d['permission']['admin'] = obj.team.owner_id == user.id or user.is_superuser
        else:
            d['permission']['admin'] = user.is_superuser
        return d
