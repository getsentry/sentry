from typing import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.rollbackuser import RollbackUser


class RollbackOrganizationSerializerResponse(TypedDict):
    id: int
    name: str
    slug: str


class UserRollbacksSerializerResponse(TypedDict):
    organization: RollbackOrganizationSerializerResponse
    rollback_uuid: str
    rollback_shared_uuid: str


@register(RollbackUser)
class UserRollbacksSerializer(Serializer):
    def serialize(
        self, obj: RollbackUser, attrs, user, **kwargs
    ) -> UserRollbacksSerializerResponse:
        return {
            "organization": {
                "id": obj.organization.id,
                "name": obj.organization.name,
                "slug": obj.organization.slug,
            },
            "rollback_uuid": str(obj.uuid),
            "rollback_shared_uuid": str(obj.share_uuid),
        }
