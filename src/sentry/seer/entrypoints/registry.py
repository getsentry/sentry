from sentry.seer.entrypoints.types import SeerEntrypointCore
from sentry.utils.registry import Registry

entrypoint_registry = Registry[type[SeerEntrypointCore]]()
