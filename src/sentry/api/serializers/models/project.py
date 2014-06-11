from sentry.api.serializers import Serializer, register
from sentry.constants import MEMBER_OWNER
from sentry.models import Project, Team
from sentry.utils.db import attach_foreignkey


@register(Project)
class ProjectSerializer(Serializer):
    def get_attrs(self, item_list, user):
        team_map = dict(
            (t.id, t) for t in Team.objects.get_for_user(user).itervalues()
        )

        result = {}
        for project in item_list:
            try:
                team = team_map[project.team_id]
            except KeyError:
                access_type = None
            else:
                project.team = team
                access_type = team.access_type

            result[project] = {
                'access_type': access_type,
            }

        attach_foreignkey(item_list, Project.team)

        return result

    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'isPublic': obj.public,
            'dateCreated': obj.date_added,
            'permission': {
                'edit': attrs['access_type'] == MEMBER_OWNER or user.is_superuser,
            },
        }
        if obj.team:
            d['permission']['admin'] = obj.team.owner_id == user.id or user.is_superuser
        else:
            d['permission']['admin'] = user.is_superuser
        return d
