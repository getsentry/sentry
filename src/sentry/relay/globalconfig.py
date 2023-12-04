import sentry.options
from sentry.relay.config.measurements import get_measurements_config
from sentry.utils import metrics

# List of options to include in the global config.
RELAY_OPTIONS = []


@metrics.wraps("relay.globalconfig.get")
def get_global_config():
    """Return the global configuration for Relay."""

    options = dict()
    for option in RELAY_OPTIONS:
        options[option] = sentry.options.get(option)

    return {
        "measurements": get_measurements_config(),
        "options": options,
    }
