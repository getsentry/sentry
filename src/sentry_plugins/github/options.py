from sentry.options import FLAG_PRIORITIZE_DISK, register

register("github.integration-private-key", default="", flags=FLAG_PRIORITIZE_DISK)
register("github.integration-hook-secret", default="", flags=FLAG_PRIORITIZE_DISK)
register("github.integration-app-id", default=0, flags=FLAG_PRIORITIZE_DISK)
register("github.apps-install-url", default="", flags=FLAG_PRIORITIZE_DISK)
