from __future__ import annotations

from collections.abc import Sequence
from typing import TYPE_CHECKING, Literal, TypedDict

from django.db import router, transaction
from django.db.models import QuerySet
from rest_framework import serializers

from sentry import features
from sentry.auth.access import Access
from sentry.investigations.contracts import ActionPayloadSerializer
from sentry.investigations.services.action_kinds.base import (
    ActionInvalid,
    ActionKind,
    ApplyContext,
    CannotApplyReason,
    FollowUpCommand,
)
from sentry.models.organization import Organization
from sentry.notebooks.models import Notebook, NotebookActionRequest, NotebookActionRequestState
from sentry.seer.agent.monitoring_providers import org_monitoring_provider_registry

if TYPE_CHECKING:
    from sentry.auth.principal import RequestPrincipal

CONNECT_TELEMETRY_ACTION = "connect_telemetry"
TelemetryProvider = Literal["datadog", "gcp"]
TELEMETRY_PROVIDERS: tuple[TelemetryProvider, ...] = ("datadog", "gcp")

TELEMETRY_FEATURE = "organizations:seer-infra-telemetry"
# The scope the integration pipeline needs to install a provider.
_INSTALL_SCOPE = "org:integrations"


class ConnectTelemetryActionSerializer(ActionPayloadSerializer):
    provider = serializers.ChoiceField(choices=TELEMETRY_PROVIDERS)


class ConnectTelemetryAppliedDetails(TypedDict):
    provider: TelemetryProvider


def telemetry_available(organization: Organization, provider: TelemetryProvider) -> bool:
    """Whether Seer can read this provider for the organization. Only org integrations count."""

    monitoring_provider = org_monitoring_provider_registry.get(provider)()
    return bool(monitoring_provider.build_connection(organization)) and (
        monitoring_provider.is_verified(organization)
    )


def _provider(action_request: NotebookActionRequest) -> TelemetryProvider:
    payload = action_request.action_payload
    assert payload is not None
    return payload["provider"]


def telemetry_provider_for_integration(integration_provider: str) -> TelemetryProvider | None:
    if integration_provider in TELEMETRY_PROVIDERS:
        return integration_provider
    return None


def open_connect_requests(
    organization_id: int, provider: TelemetryProvider
) -> QuerySet[NotebookActionRequest]:
    return NotebookActionRequest.objects.filter(
        notebook__organization_id=organization_id,
        action_kind=CONNECT_TELEMETRY_ACTION,
        state=NotebookActionRequestState.SUGGESTED,
        action_payload__provider=provider,
    )


class ConnectTelemetryKind(ActionKind):
    kind = CONNECT_TELEMETRY_ACTION
    payload_serializer = ConnectTelemetryActionSerializer

    def cannot_apply_reasons(
        self,
        action_requests: Sequence[NotebookActionRequest],
        *,
        investigations: dict[int, Notebook],
        access: Access,
        user: RequestPrincipal,
    ) -> dict[int, CannotApplyReason | None]:
        can_install = access.has_scope(_INSTALL_SCOPE)
        reasons: dict[int, CannotApplyReason | None] = {}
        for item in action_requests:
            if not features.has(TELEMETRY_FEATURE, investigations[item.notebook_id].organization):
                reasons[item.id] = CannotApplyReason.UNSUPPORTED_ACTION
            elif not can_install:
                reasons[item.id] = CannotApplyReason.PERMISSION_DENIED
            else:
                reasons[item.id] = None
        return reasons

    def check_remote(self, investigation: Notebook, action_request: NotebookActionRequest) -> None:
        # The user connects the provider in its integration settings. Applying only records it.
        if not telemetry_available(investigation.organization, _provider(action_request)):
            raise ActionInvalid(["This provider isn't connected yet."])

    def apply(self, context: ApplyContext) -> ConnectTelemetryAppliedDetails:
        return {"provider": _provider(context.action_request)}

    def follow_up_command(self, action_request: NotebookActionRequest) -> FollowUpCommand:
        # Seer starts the re-run, or holds it until the busy run completes.
        return {
            "type": "rerun_after_connection",
            "payload": {"provider": _provider(action_request)},
        }

    def after_upsert(self, action_request: NotebookActionRequest) -> None:
        from sentry.tasks.seer.investigation import mark_investigation_telemetry_connected

        provider = _provider(action_request)
        organization_id = Notebook.objects.values_list("organization_id", flat=True).get(
            id=action_request.notebook_id
        )
        # Let the task check the connection, so event ingest doesn't call the control silo.
        transaction.on_commit(
            lambda: mark_investigation_telemetry_connected.delay(
                organization_id=organization_id, provider=provider, user_id=None, retry=False
            ),
            using=router.db_for_write(NotebookActionRequest),
        )
