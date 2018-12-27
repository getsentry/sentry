"""
sentry.tagstore.models
~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

backends = []

if settings.SENTRY_TAGSTORE == 'sentry.utils.services.ServiceDelegator':
    backends = [
        backend['path'] for backend in
        settings.SENTRY_TAGSTORE_OPTIONS.get('backends', {}).values()
    ]
elif settings.SENTRY_TAGSTORE.startswith('sentry.tagstore.multi'):
    backends = [
        backend[0] for backend in
        settings.SENTRY_TAGSTORE_OPTIONS.get('backends', [])
    ]
else:
    backends = [settings.SENTRY_TAGSTORE]

if not len(backends) > 0:
    raise ImproperlyConfigured('One or more tagstore backend(s) must be specified')

prefix_map = {
    # backend path prefix: path to the `models` parent model used
    'sentry.tagstore.legacy': 'sentry.tagstore.legacy',
    'sentry.tagstore.v2': 'sentry.tagstore.v2',
    'sentry.tagstore.snuba': 'sentry.tagstore.v2',
}

for i, backend in enumerate(backends):
    for prefix, path in prefix_map.items():
        if backend.startswith(prefix):
            models = __import__(path, globals(), locals(), ['models'], level=0).models
            if i == 0:
                # If this is the first iteration of the loop, we need to
                # emulate ``from x import *`` by copying the module contents
                # into the local (module) scope. This follows the same rules as
                # the import statement itself, as defined in the refrence docs:
                # https://docs.python.org/2.7/reference/simple_stmts.html#import
                if getattr(models, '__all__', None) is not None:
                    predicate = lambda name: name in models.__all__
                else:
                    predicate = lambda name: not name.startswith('_')
                locals().update({k: v for k, v in vars(models).items() if predicate(k)})
            break
    else:
        raise ImproperlyConfigured("Found unknown tagstore backend '%s'" % backend)
