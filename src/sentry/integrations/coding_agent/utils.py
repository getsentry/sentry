from __future__ import annotations
from typing import int

from sentry.integrations.coding_agent.integration import CodingAgentIntegrationProvider


def get_coding_agent_providers() -> list[str]:
    """Get list of all coding agent provider keys."""
    from sentry.integrations.manager import all

    return [p.key for p in all() if isinstance(p, CodingAgentIntegrationProvider)]
