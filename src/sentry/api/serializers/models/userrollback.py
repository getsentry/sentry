from typing import TypedDict

from sentry.api.serializers import Serializer


class RollbackOrganizationSerializerResponse(TypedDict):
    id: int
    name: str
    slug: str


class RollbackUserSerializerResponse(TypedDict):
    id: int
    name: str


class RollbackSerializerResponse(TypedDict):
    organization: RollbackOrganizationSerializerResponse
    user: RollbackUserSerializerResponse
    data: dict  # JSON Blob


class UserRollbackSerializer(Serializer):
    def serialize(self, obj, attrs, user, **kwargs) -> RollbackSerializerResponse:
        rollback_org = kwargs.get("rollback_org")

        return {
            "organization": {
                "id": obj.organization.id,
                "name": obj.organization.name,
                "slug": obj.organization.slug,
            },
            "user": {
                "id": obj.user_id,
                "name": user.name,
            },
            "data": {
                "user": obj.data,
                "organization": rollback_org.data if rollback_org else None,
            },
        }
