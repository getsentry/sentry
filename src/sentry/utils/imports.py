"""
sentry.utils.imports
~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""


class ModuleProxyCache(dict):
    def __missing__(self, key):
        if not '.' in key:
            return __import__(key)

        module_name, class_name = key.rsplit('.', 1)

        module = __import__(module_name, {}, {}, [class_name], -1)
        handler = getattr(module, class_name)

        # We cache a NoneType for missing imports to avoid repeated lookups
        self[key] = handler

        return handler

_cache = ModuleProxyCache()


def import_string(path):
    """
    Path must be module.path.ClassName

    >>> cls = import_string('sentry.models.Group')
    """
    result = _cache[path]
    return result
