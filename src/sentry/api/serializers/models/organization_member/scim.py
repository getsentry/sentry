from typing import Any, Mapping, Optional, Sequence

from sentry.api.serializers import Serializer
from sentry.models import OrganizationMember
from sentry.scim.endpoints.constants import SCIM_SCHEMA_USER

from .response import OrganizationMemberSCIMSerializerResponse


class OrganizationMemberSCIMSerializer(Serializer):  # type: ignore
    def __init__(self, expand: Optional[Sequence[str]] = None) -> None:
        self.expand = expand or []

    def serialize(
        self, obj: OrganizationMember, attrs: Mapping[str, Any], user: Any, **kwargs: Any
    ) -> OrganizationMemberSCIMSerializerResponse:

        given_name = "N/A"
        family_name = "N/A"
        if obj.data:
            given_name = obj.data.get("givenName") if obj.data.get("givenName") else "N/A"
            family_name = obj.data.get("familyName") if obj.data.get("familyName") else "N/A"

        result: OrganizationMemberSCIMSerializerResponse = {
            "schemas": [SCIM_SCHEMA_USER],
            "id": str(obj.id),
            "userName": obj.get_email(),
            "name": {"givenName": given_name, "familyName": family_name},
            "emails": [{"primary": True, "value": obj.get_email(), "type": "work"}],
            "meta": {"resourceType": "User"},
            "sentryOrgRole": obj.role,
        }
        if "active" in self.expand:
            result["active"] = True

        return result
