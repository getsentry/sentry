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

        result: OrganizationMemberSCIMSerializerResponse = {
            "schemas": [SCIM_SCHEMA_USER],
            "id": str(obj.id),
            "userName": obj.get_email(),
            "name": {"givenName": "N/A", "familyName": "N/A"},
            "emails": [{"primary": True, "value": obj.get_email(), "type": "work"}],
            "meta": {"resourceType": "User"},
        }
        if "active" in self.expand:
            result["active"] = True

        return result
