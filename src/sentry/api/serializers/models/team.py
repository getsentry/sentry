from __future__ import absolute_import

from sentry.api.serializers import Serializer, register
from sentry.models import OrganizationMemberType, Team


@register(Team)
class TeamSerializer(Serializer):
    def get_attrs(self, item_list, user):
        organization = item_list[0].organization
        team_map = dict(
            (t.id, t) for t in Team.objects.get_for_user(
                organization=organization,
                user=user,
            )
        )

        result = {}
        for team in item_list:
            try:
                access_type = team_map[team.id].access_type
            except KeyError:
                access_type = None

            result[team] = {
                'access_type': access_type,
            }
        return result

    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'slug': obj.slug,
            'name': obj.name,
            'dateCreated': obj.date_added,
            'permission': {
                'owner': attrs['access_type'] <= OrganizationMemberType.OWNER,
                'admin': attrs['access_type'] <= OrganizationMemberType.ADMIN,
            }
        }
        return d
