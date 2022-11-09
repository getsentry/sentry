from datetime import datetime
from typing import Any, Mapping

from typing_extensions import TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.user import User


class OrganizationMappingSerializerResponse(TypedDict):
    id: str
    organization_id: str
    slug: str
    created: datetime
    verified: bool
    region_name: str


@register(OrganizationMapping)
class OrganizationMappingSerializer(Serializer):  # type: ignore
    def serialize(
        self, obj: OrganizationMapping, attrs: Mapping[str, Any], user: User
    ) -> OrganizationMappingSerializerResponse:
        return {
            "id": obj.id,
            "organization_id": str(obj.organization_id),
            "slug": obj.slug,
            "created": obj.created,
            "verified": obj.verified,
            "region_name": obj.region_name,
        }
