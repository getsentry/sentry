from sentry.utils import metrics


@metrics.wraps("relay.globalconfig.get")
def get_global_config():
    """Return the global configuration for Relay."""
    # TODO(iker): Add entries for the global config as needed, empty during
    # development.
    return {}
