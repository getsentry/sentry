"""
sentry.models
~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from sentry.utils.imports import import_submodules
from south.modelsinspector import add_introspection_rules

import_submodules(globals(), __name__, __path__)

add_introspection_rules([], ["^social_auth\.fields\.JSONField"])
