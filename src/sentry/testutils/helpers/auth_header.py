__all__ = ("get_auth_header",)


def get_auth_header(
    client: str,
    api_key: str | None = None,
    secret_key: str | None = None,
    version: str | None = None,
) -> str:
    if version is None:
        version = "6"

    header = [("sentry_client", client), ("sentry_version", version)]

    if api_key:
        header.append(("sentry_key", api_key))
    if secret_key:
        header.append(("sentry_secret", secret_key))

    return "Sentry %s" % ", ".join(f"{k}={v}" for k, v in header)
