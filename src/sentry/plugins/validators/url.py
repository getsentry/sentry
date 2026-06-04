from sentry.exceptions import PluginError
from sentry.net.socket import is_valid_url


def URLValidator(value: str, **kwargs: object) -> str:
    if not value.startswith(("http://", "https://")):
        raise PluginError("Not a valid URL.")
    if not is_valid_url(value):
        raise PluginError("Not a valid URL.")
    return value
