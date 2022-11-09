from typing import Any, Mapping

from sentry.api.serializers import Serializer, register
from sentry.models.user import User
from sentry.services.hybrid_cloud.organizationmapping import APIOrganizationMapping


@register(APIOrganizationMapping)
class APIOrganizationMappingSerializer(Serializer):  # type: ignore
    def serialize(self, obj: APIOrganizationMapping, attrs: Mapping[str, Any], user: User):
        return {
            "id": obj.id,
            "organization_id": str(obj.organization_id),
            "slug": obj.slug,
            "region_name": obj.region_name,
        }
