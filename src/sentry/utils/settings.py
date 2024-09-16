def is_self_hosted() -> bool:
    """Determines if the application is self-hosted.

    This function checks the SENTRY_SELF_HOSTED setting from the Django
    settings to determine if the application is running in a self-hosted
    environment. It provides backcompat for consumers that rely on the
    previous naming convention, particularly for single-tenant setups.

    Returns:
        bool: True if the application is self-hosted, False otherwise.
    """
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
