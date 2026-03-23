from typing import Any

from sentry.seer.entrypoints.types import SeerAutofixEntrypoint
from sentry.utils.registry import Registry

autofix_entrypoint_registry = Registry[type[SeerAutofixEntrypoint[Any]]]()
