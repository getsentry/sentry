def normalize_integration_provider_key(provider_key: str | None) -> str:
    if provider_key is None:
        return ""

    return provider_key.removeprefix("integrations:")


def get_integration_name(provider_key: str | None, *, default: str = "other") -> str:
    if provider_key is None:
        return default

    return normalize_integration_provider_key(provider_key)
