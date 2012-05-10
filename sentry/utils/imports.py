"""
sentry.utils.imports
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


class ModuleProxyCache(dict):
    def __missing__(self, key):
        module, class_name = key.rsplit('.', 1)

        handler = getattr(__import__(module, {}, {}, [class_name], -1), class_name)

        self[key] = handler

        return handler

_cache = ModuleProxyCache()


def import_string(path):
    """
    Path must be module.path.ClassName

    >>> cls = import_string('sentry.models.Group')
    """
    return _cache[path]
