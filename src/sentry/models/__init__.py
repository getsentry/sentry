from __future__ import absolute_import

from django.conf import settings

from sentry.utils.imports import import_submodules

import_submodules(globals(), __name__, __path__)

if "south" in settings.INSTALLED_APPS:
    from south.modelsinspector import add_introspection_rules

    add_introspection_rules([], ["^social_auth\.fields\.JSONField"])
