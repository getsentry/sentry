from __future__ import annotations

import pytest

from sentry.investigations.services.action_kinds.connect_telemetry import (
    ConnectTelemetryActionSerializer,
)


@pytest.mark.parametrize("provider", ["datadog", "gcp"])
def test_accepts_supported_providers(provider: str) -> None:
    action = {"kind": "connect_telemetry", "provider": provider}
    serializer = ConnectTelemetryActionSerializer(data=action)

    assert serializer.is_valid()
    assert dict(serializer.validated_data) == action


@pytest.mark.parametrize("provider", ["honeycomb", None, ""])
def test_rejects_unknown_providers(provider: str | None) -> None:
    serializer = ConnectTelemetryActionSerializer(
        data={"kind": "connect_telemetry", "provider": provider}
    )

    assert not serializer.is_valid()
