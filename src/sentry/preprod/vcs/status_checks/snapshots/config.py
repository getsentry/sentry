from __future__ import annotations

ENABLED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_enabled"
FAIL_ON_ADDED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_fail_on_added"
FAIL_ON_REMOVED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_fail_on_removed"
FAIL_ON_CHANGED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_fail_on_changed"
FAIL_ON_RENAMED_OPTION_KEY = "sentry:preprod_snapshot_status_checks_fail_on_renamed"

ENABLED_DEFAULT = True
FAIL_ON_ADDED_DEFAULT = False
FAIL_ON_REMOVED_DEFAULT = True
FAIL_ON_CHANGED_DEFAULT = True
FAIL_ON_RENAMED_DEFAULT = False
