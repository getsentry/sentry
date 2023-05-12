from sentry.api.serializers import Serializer, register, serialize
from sentry.models import OrganizationAccessRequest
from sentry.services.hybrid_cloud.user.service import user_service


@register(OrganizationAccessRequest)
class OrganizationAccessRequestSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        serialized_users = user_service.serialize_many(filter=dict(user_ids=[obj.requester_id]))
        if serialized_users:
            serialized_user = serialized_users[0]
        else:
            serialized_user = None

        d = {
            "id": str(obj.id),
            "member": serialize(obj.member),
            "team": serialize(obj.team),
            "requester": serialized_user,
        }
        return d
