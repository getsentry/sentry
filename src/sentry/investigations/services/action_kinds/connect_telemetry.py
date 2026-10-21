from __future__ import annotations

from rest_framework import serializers

from sentry.investigations.contracts import ActionPayloadSerializer

CONNECT_TELEMETRY_ACTION = "connect_telemetry"
TELEMETRY_PROVIDERS = ("datadog", "gcp")


class ConnectTelemetryActionSerializer(ActionPayloadSerializer):
    provider = serializers.ChoiceField(choices=TELEMETRY_PROVIDERS)
