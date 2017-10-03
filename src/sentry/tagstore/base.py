"""
sentry.tagstore.base
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import re

from sentry.utils.services import Service

# Valid pattern for tag key names
TAG_KEY_RE = re.compile(r'^[a-zA-Z0-9_\.:-]+$')

# These tags are special and are used in pairing with `sentry:{}`
# they should not be allowed to be set via data ingest due to ambiguity
INTERNAL_TAG_KEYS = frozenset(
    ('release', 'dist', 'user', 'filename', 'function'))


# TODO(dcramer): pull in enum library
class TagKeyStatus(object):
    VISIBLE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


class TagStorage(Service):
    __all__ = (
        'is_valid_key', 'is_valid_value', 'is_reserved_key', 'prefix_reserved_key',
        'get_standardized_key', 'create_tag_key', 'get_or_create_tag_key',
        'create_tag_value', 'get_or_create_tag_value', 'get_tag_key', 'get_tag_keys',
        'get_tag_value', 'get_tag_values', 'delete_tag_key', 'incr_values_seen',
        'incr_times_seen', 'get_group_event_ids', 'get_tag_value_qs'
    )

    def is_valid_key(self, key):
        return bool(TAG_KEY_RE.match(key))

    def is_valid_value(self, value):
        return '\n' not in value

    def is_reserved_key(self, key):
        return key in INTERNAL_TAG_KEYS

    def prefix_reserved_key(self, key):
        # XXX(dcramer): kill sentry prefix for internal reserved tags
        if self.is_reserved_key(key):
            return 'sentry:{0}'.format(key)
        else:
            return key

    def get_standardized_key(self, key):
        if key.startswith('sentry:'):
            return key.split('sentry:', 1)[-1]
        return key

    def create_tag_key(self, project_id, key, **kwargs):
        """
        >>> create_tag_key(1, "key1")
        """
        raise NotImplementedError

    def get_or_create_tag_key(self, project_id, key, **kwargs):
        """
        >>> get_or_create_tag_key(1, "key1")
        """
        raise NotImplementedError

    def create_tag_value(self, project_id, key, value, **kwargs):
        """
        >>> create_tag_key(1, "key1", "value1")
        """
        raise NotImplementedError

    def get_or_create_tag_value(self, project_id, key, value, **kwargs):
        """
        >>> get_or_create_tag_key(1, "key1", "value1")
        """
        raise NotImplementedError

    def get_tag_key(self, project_id, key, status=TagKeyStatus.VISIBLE):
        """
        >>> get_tag_key(1, "key1")
        """
        raise NotImplementedError

    def get_tag_keys(self, project_id, keys=None, status=TagKeyStatus.VISIBLE):
        """
        >>> get_tag_key(1, ["key1", "key2"])
        """
        raise NotImplementedError

    def get_tag_value(self, project_id, key, value):
        """
        >>> get_tag_value(1, "key1", "value1")
        """
        raise NotImplementedError

    def get_tag_values(self, project_ids, key, values=None):
        """
        >>> get_tag_values([1, 2], "key1", ["value1, "value2"])
        """
        raise NotImplementedError

    def delete_tag_key(self, project_id, key):
        """
        >>> delete_tag_key(1, "key1")
        """
        raise NotImplementedError

    def incr_values_seen(self, project_id, key, count=1):
        """
        >>> incr_values_seen(1, "key1")
        """
        raise NotImplementedError

    def incr_times_seen(self, project_id, key, value, extra=None, count=1):
        """
        >>> incr_times_seen(1, "key1", "value1")
        """
        raise NotImplementedError

    def get_group_event_ids(self, project_id, group_id, tags):
        """
        >>> get_group_event_ids(1, 2, {'key1': 'value1', 'key2': 'value2'})
        """
        raise NotImplementedError

    def get_tag_value_qs(self, project_id, key, query=None):
        """
        >>> get_tag_value_qs(1, 'environment', query='prod')
        """
        raise NotImplementedError
