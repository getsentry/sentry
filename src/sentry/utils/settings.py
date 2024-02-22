def is_self_hosted() -> bool:
    # Backcompat for rename to support old consumers, particularly single-tenant.
    from django.conf import settings

    return settings.SENTRY_SELF_HOSTED


def should_show_beacon_consent_prompt() -> bool:
    from django.conf import settings

    from sentry import options

    return settings.SENTRY_SELF_HOSTED and not options.isset("beacon.record_cpu_ram_usage")
