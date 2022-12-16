from typing import Any, Mapping

from sentry.api.serializers import Serializer, register
from sentry.models.user import User
from sentry.services.hybrid_cloud.organization_mapping import APIOrganizationMapping


@register(APIOrganizationMapping)
class APIOrganizationMappingSerializer(Serializer):  # type: ignore
    def serialize(self, obj: APIOrganizationMapping, attrs: Mapping[str, Any], user: User):
        return {
            "id": obj.id,
            "organizationId": str(obj.organization_id),
            "slug": obj.slug,
            "regionName": obj.region_name,
            "dateCreated": obj.date_created,
            "verified": obj.verified,
            "customerId": obj.customer_id,
        }
