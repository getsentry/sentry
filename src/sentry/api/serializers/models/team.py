from sentry.api.serializers import Serializer, register
from sentry.constants import MEMBER_OWNER
from sentry.models import Team


@register(Team)
class TeamSerializer(Serializer):
    def get_attrs(self, item_list, user):
        team_map = Team.objects.get_for_user(user)

        result = {}
        for team in item_list:
            try:
                access_type = team_map[team.slug].access_type
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
                'edit': attrs['access_type'] == MEMBER_OWNER or user.is_superuser,
                'admin': obj.owner_id == user.id or user.is_superuser,
            }
        }
        return d
