from collections.abc import Mapping
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.agent_handoff.claims import ClaimedHandoff
from sentry.api.serializers import Serializer
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class AgentHandoffClaimResponse(TypedDict):
    sentryUrl: str
    userEmail: str
    organizationName: str
    organizationSlug: str
    clientId: str
    setupCode: str
    flowInstructions: str


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
