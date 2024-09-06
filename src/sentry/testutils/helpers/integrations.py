from __future__ import annotations

from typing import TypeVar

from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.integration import Integration

T = TypeVar("T", bound=IntegrationInstallation)


def get_installation_of_type(tp: type[T], integration: Integration, org_id: int) -> T:
    install = integration.get_installation(org_id)
    if not isinstance(install, tp):
        raise TypeError(f"expected install of type {tp}, got {type(install)}")
    return install
