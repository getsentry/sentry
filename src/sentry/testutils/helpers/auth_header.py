from __future__ import absolute_import

__all__ = ("get_auth_header",)


def get_auth_header(client, api_key=None, secret_key=None, version=None):
    if version is None:
        version = "6"

    header = [("sentry_client", client), ("sentry_version", version)]

    if api_key:
        header.append(("sentry_key", api_key))
    if secret_key:
        header.append(("sentry_secret", secret_key))

    return "Sentry %s" % ", ".join("%s=%s" % (k, v) for k, v in header)
