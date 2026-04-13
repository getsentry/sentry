from typing import Any

from sentry.seer.entrypoints.types import SeerAutofixEntrypoint, SeerExplorerEntrypoint
from sentry.utils.registry import Registry

autofix_entrypoint_registry = Registry[type[SeerAutofixEntrypoint[Any]]]()
explorer_entrypoint_registry = Registry[type[SeerExplorerEntrypoint[Any]]]()
