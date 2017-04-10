from __future__ import absolute_import

__all__ = ('Repos',)

import six

from sentry.interfaces.base import Interface, InterfaceValidationError


class Repos(Interface):
    """
    Details about repositories connected to an event.

    This is primarily used to aid with mapping the application code's filepath
    to the equivilent path inside of a repository.

    >>> {
    >>>     "/abs/path/to/sentry": {
    >>>         "name": "getsentry/sentry",
    >>>         "prefix": "src",
    >>>         "revision": "..." // optional
    >>>     }
    >>> }
    """
    @classmethod
    def to_python(cls, data):
        result = {}
        for path, config in six.iteritems(data):
            if len(path) > 200:
                raise InterfaceValidationError("Invalid repository `path` (> 200 characters)")

            name = config.get('name')
            if not name:
                raise InterfaceValidationError("A repository must provide a value `name`")
            # 200 chars is enforced by db, and while we dont validate if the
            # repo actually exists, we know it could *never* exist if its beyond
            # the schema constraints.
            if len(name) > 200:
                raise InterfaceValidationError("Invalid repository `name`")

            prefix = config.get('prefix')
            if prefix and len(prefix) > 200:
                raise InterfaceValidationError("Invalid repository `prefix` (> 200 characters)")

            revision = config.get('revision')
            if revision and len(revision) > 40:
                raise InterfaceValidationError("Invalid repository `revision` (> 40 characters)")

            result[path] = {
                'name': name,
            }
            if prefix:
                result[path]['prefix'] = prefix
            if revision:
                result[path]['revision'] = revision
        return cls(**result)

    def get_path(self):
        return 'repos'
