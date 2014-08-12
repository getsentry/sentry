from sentry.api.serializers import Serializer, register
from sentry.models import PendingTeamMember
from sentry.utils.avatar import get_gravatar_url


@register(PendingTeamMember)
class PendingTeamMemberSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        d = {
            'id': str(obj.id),
            'email': obj.email,
            'access': obj.get_type_display(),
            'pending': True,
            'dateCreated': obj.date_added,
            'avatarUrl': get_gravatar_url(obj.email, size=32),
        }
        return d
