def is_self_hosted() -> bool:
    # Backcompat for rename to support old consumers, particularly single-tenant.
    from django.conf import settings

    return settings.SENTRY_SELF_HOSTED
