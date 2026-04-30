# Integration action handlers self-register via @action_handler_registry.register at
# import time (a Django startup side-effect). Tests that exercise these handlers through
# dynamic dispatch — e.g. action.save() triggering schema validation, or
# IssueAlertMigrator routing through the registry — have no static import of the handler
# modules, so Sentry's selective testing scanner cannot trace the dependency and won't
# select those tests when a handler file changes.
#
# The explicit imports below fix the static-scanner gap. pytest loads conftest.py before
# any test in the directory tree, and find_test_imports.py (the selective testing scanner)
# includes conftest.py files in its search, so changing any of these handler modules will
# now correctly select the affected integration tests.
#
# The production-code alternative is to add an integrations AppConfig.ready() that
# imports all handler packages centrally (mirroring workflow_engine/apps.py), which would
# fix both selective testing and any other tooling that relies on static import graphs.
# That's a larger change tracked separately.
import sentry.integrations.github.handlers  # noqa: F401
import sentry.integrations.github_enterprise.handlers  # noqa: F401
