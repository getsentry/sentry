from collections.abc import Mapping
from typing import Annotated, Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.agent_handoff.claims import ClaimedHandoff
from sentry.api.serializers import Serializer
from sentry.apidocs.descriptions import ApiDescription
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class AgentHandoffClaimResponse(TypedDict):
    sentryUrl: Annotated[str, ApiDescription("The Sentry base URL to authenticate against")]
    userEmail: Annotated[str, ApiDescription("Email address of the Sentry user")]
    organizationName: Annotated[str, ApiDescription("Display name of the organization")]
    organizationSlug: Annotated[str, ApiDescription("Slug of the organization")]
    clientId: Annotated[str, ApiDescription("Client ID of the authorized OAuth application")]
    setupCode: Annotated[str, ApiDescription("One-time code used to authenticate the CLI")]
    flowInstructions: Annotated[
        str, ApiDescription("Instructions to display after authentication succeeds")
    ]


class AgentHandoffClaimSerializer(Serializer[AgentHandoffClaimResponse]):
    def serialize(
        self,
        obj: ClaimedHandoff,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> AgentHandoffClaimResponse:
        return {
            "sentryUrl": obj.sentry_url,
            "userEmail": obj.user_email,
            "organizationName": obj.organization_name,
            "organizationSlug": obj.organization_slug,
            "clientId": obj.client_id,
            "setupCode": obj.setup_code,
            "flowInstructions": obj.flow_instructions,
        }
