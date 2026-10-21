from typing import TypedDict, TypeVar

from django.conf import settings
from rest_framework import serializers

from sentry.api.helpers.oauth_consent import OAuthDecision
from sentry.api.serializers.rest_framework import CamelSnakeSerializer


class ConsentDecision(TypedDict):
    op: OAuthDecision
    selected_organization_id: str | None
    scopes: list[str] | None


DecisionT = TypeVar("DecisionT", bound=ConsentDecision)


class ConsentDecisionSerializer(CamelSnakeSerializer[DecisionT]):
    op = serializers.ChoiceField(
        choices=("approve", "deny"), help_text="Approve or deny the prepared request."
    )
    selected_organization_id = serializers.CharField(
        required=False,
        allow_null=True,
        default=None,
        help_text="The organization receiving access for an organization-scoped application.",
    )
    scopes = serializers.ListField(
        child=serializers.ChoiceField(choices=sorted(settings.SENTRY_SCOPES)),
        required=False,
        allow_null=True,
        default=None,
        max_length=len(settings.SENTRY_SCOPES),
        help_text=("The subset of requested scopes to grant. Omit to grant every requested scope."),
    )
