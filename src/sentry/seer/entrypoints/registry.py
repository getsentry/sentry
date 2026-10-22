from typing import Any

from sentry.seer.entrypoints.types import (
    SeerAgentEntrypoint,
    SeerAutofixEntrypoint,
    SeerInvestigationEntrypoint,
)
from sentry.utils.registry import Registry

autofix_entrypoint_registry = Registry[type[SeerAutofixEntrypoint[Any]]]()
agent_entrypoint_registry = Registry[type[SeerAgentEntrypoint[Any]]]()
investigation_entrypoint_registry = Registry[type[SeerInvestigationEntrypoint[Any]]]()
