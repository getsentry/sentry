from sentry.relay.config.measurements import get_measurements_config
from sentry.utils import metrics


@metrics.wraps("relay.globalconfig.get")
def get_global_config():
    """Return the global configuration for Relay."""
    return {
        "measurements": get_measurements_config(),
    }
