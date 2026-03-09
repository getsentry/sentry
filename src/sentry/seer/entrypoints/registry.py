from sentry.seer.entrypoints.types import SeerEntrypoint
from sentry.utils.registry import Registry

entrypoint_registry = Registry[type[SeerEntrypoint]]()
