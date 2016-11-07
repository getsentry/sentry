from __future__ import absolute_import

from sentry.utils.imports import import_submodules

import_submodules(globals(), __name__, __path__)

manager = FieldManager()
# there can be multiple input types, but there will only ever be one, unified
# output type per field
manager.register('choice', ChoiceField)
manager.register('text', TextField)

register = manager.register
get = manager.get
