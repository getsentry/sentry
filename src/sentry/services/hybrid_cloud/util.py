# TODO(hybridcloud) Remove this shim once getsentry is updated.
from sentry.silo.base import all_silo_function, control_silo_function, region_silo_function

__all__ = ("region_silo_function", "control_silo_function", "all_silo_function")
