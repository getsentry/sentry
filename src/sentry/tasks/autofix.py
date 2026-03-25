# Shim for backwards compatibility with getsentry imports.
# Remove once getsentry is updated to import from sentry.tasks.seer.autofix.
from sentry.tasks.seer.autofix import configure_seer_for_existing_org

__all__ = ["configure_seer_for_existing_org"]
