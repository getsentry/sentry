# XXX(dcramer): we dont use rest framework's serializers module for actual serialization,
# but rather we use it for validation. Consider this the appropriate place to put these
# components going forward, though many live in sentry/api/serializers/rest_framework for
# legacy reasons.

from sentry.utils.imports import import_submodules

import_submodules(globals(), __name__, __path__)
