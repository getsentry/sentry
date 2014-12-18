from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import OrganizationMemberType, Project, Team


@register(Project)
class ProjectSerializer(Serializer):
    def get_attrs(self, item_list, user):
        organization = item_list[0].team.organization

        team_map = dict(
            (t.id, t) for t in Team.objects.get_for_user(
                organization=organization,
                user=user,
            )
        )

        result = {}
        for project in item_list:
            try:
                team = team_map[project.team_id]
            except KeyError:
                access_type = None
            else:
                access_type = team.access_type

            result[project] = {
                'access_type': access_type,
            }

        return result

    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'isPublic': obj.public,
            'dateCreated': obj.date_added,
            'permission': {
                'owner': attrs['access_type'] <= OrganizationMemberType.OWNER,
                'admin': attrs['access_type'] <= OrganizationMemberType.ADMIN,
            },
        }
        return d
