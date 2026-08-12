def get_setting_string(value: object) -> str | None:
    """Return a configured string setting, treating bootstrap sentinels as unset."""
    return value if isinstance(value, str) else None


def is_self_hosted() -> bool:
    # Backcompat for rename to support old consumers, particularly single-tenant.
    from django.conf import settings

    return settings.SENTRY_SELF_HOSTED


def should_show_beacon_consent_prompt() -> bool:
    from django.conf import settings

    from sentry import options

    return settings.SENTRY_SELF_HOSTED and not options.isset("beacon.record_cpu_ram_usage")


def is_self_hosted_errors_only() -> bool:
    from django.conf import settings

    return settings.SENTRY_SELF_HOSTED_ERRORS_ONLY and settings.SENTRY_SELF_HOSTED
