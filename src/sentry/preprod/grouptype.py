from __future__ import annotations

import sentry.preprod.size_analysis.grouptype  # noqa: F401,F403

# We have to import sentry.preprod.size_analysis.grouptype above.
# grouptype modules in root packages (src/sentry/*) are auto imported
# but more deeply nested ones are not.
