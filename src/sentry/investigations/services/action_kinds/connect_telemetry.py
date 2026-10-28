from __future__ import annotations

from rest_framework import serializers

from sentry.investigations.contracts import ActionPayloadSerializer
from sentry.investigations.services.action_kinds.base import ActionKind

CONNECT_TELEMETRY_ACTION = "connect_telemetry"
TELEMETRY_PROVIDERS = ("datadog", "gcp")


class ConnectTelemetryActionSerializer(ActionPayloadSerializer):
    provider = serializers.ChoiceField(choices=TELEMETRY_PROVIDERS)


class ConnectTelemetryKind(ActionKind):
    kind = CONNECT_TELEMETRY_ACTION
    payload_serializer = ConnectTelemetryActionSerializer
