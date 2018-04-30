"""
sentry.tagstore.base
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2017 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""

from __future__ import absolute_import

import re

from sentry.constants import TAG_LABELS
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
    __read_methods__ = frozenset([
        'get_tag_key',
        'get_tag_keys',
        'get_tag_value',
        'get_tag_values',
        'get_group_tag_key',
        'get_group_tag_keys',
        'get_group_tag_value',
        'get_group_tag_values',
        'get_group_list_tag_value',

        'get_groups_user_counts',
        'get_group_event_ids',
        'get_group_tag_value_count',
        'get_top_group_tag_values',
        'get_first_release',
        'get_last_release',
        'get_release_tags',

        'get_group_ids_for_users',
        'get_group_tag_values_for_users',
        'get_group_ids_for_search_filter',

        'get_group_tag_keys_and_top_values',

        'get_tag_value_qs',
        'get_group_tag_value_qs',
        'get_event_tag_qs',
    ])

    __write_methods__ = frozenset([
        'create_tag_key',
        'get_or_create_tag_key',
        'create_tag_value',
        'get_or_create_tag_value',
        'create_group_tag_key',
        'get_or_create_group_tag_key',
        'create_group_tag_value',
        'get_or_create_group_tag_value',
        'create_event_tags',

        'delete_tag_key',
        'delete_all_group_tag_keys',
        'delete_all_group_tag_values',

        'incr_tag_value_times_seen',
        'incr_group_tag_value_times_seen',
        'update_group_tag_key_values_seen',
        'update_group_for_events',
    ])

    __all__ = frozenset([
        'is_valid_key',
        'is_valid_value',
        'is_reserved_key',
        'prefix_reserved_key',
        'get_standardized_key',
        'get_tag_key_label',
        'get_tag_value_label',
    ]) | __read_methods__ | __write_methods__

    def setup_merge(self, grouptagkey_model, grouptagvalue_model):
        from sentry.tasks import merge

        merge.EXTRA_MERGE_MODELS += [
            grouptagvalue_model,
            grouptagkey_model,
        ]

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
        return key.split('sentry:', 1)[-1]

    def get_tag_key_label(self, key):
        return TAG_LABELS.get(key) or key.replace('_', ' ').title()

    def get_tag_value_label(self, key, value):
        label = value

        if key == 'sentry:user':
            if value.startswith('id:'):
                label = value[len('id:'):]
            elif value.startswith('email:'):
                label = value[len('email:'):]
            elif value.startswith('username:'):
                label = value[len('username:'):]
            elif value.startswith('ip:'):
                label = value[len('ip:'):]
        elif key == 'sentry:release':
            from sentry.models import Release

            label = Release.get_display_version(value)

        return label

    def create_tag_key(self, project_id, environment_id, key, **kwargs):
        """
        >>> create_tag_key(1, 2, "key1")
        """
        raise NotImplementedError

    def get_or_create_tag_key(self, project_id, environment_id, key, **kwargs):
        """
        >>> get_or_create_tag_key(1, 2, "key1")
        """
        raise NotImplementedError

    def create_tag_value(self, project_id, environment_id, key, value, **kwargs):
        """
        >>> create_tag_key(1, 2, "key1", "value1")
        """
        raise NotImplementedError

    def get_or_create_tag_value(self, project_id, environment_id, key, value, **kwargs):
        """
        >>> get_or_create_tag_key(1, 2, "key1", "value1")
        """
        raise NotImplementedError

    def create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        """
        >>> create_group_tag_key(1, 2, 3, "key1")
        """
        raise NotImplementedError

    def get_or_create_group_tag_key(self, project_id, group_id, environment_id, key, **kwargs):
        """
        >>> get_or_create_group_tag_key(1, 2, 3, "key1")
        """
        raise NotImplementedError

    def create_group_tag_value(self, project_id, group_id, environment_id,
                               key, value, **kwargs):
        """
        >>> create_group_tag_value(1, 2, 3, "key1", "value1")
        """
        raise NotImplementedError

    def get_or_create_group_tag_value(self, project_id, group_id,
                                      environment_id, key, value, **kwargs):
        """
        >>> get_or_create_group_tag_value(1, 2, 3, "key1", "value1")
        """
        raise NotImplementedError

    def create_event_tags(self, project_id, group_id, environment_id,
                          event_id, tags, date_added=None):
        """
        >>> create_event_tags(1, 2, 3, 4, [('foo', 'bar'), ('baz', 'qux')])
        """
        raise NotImplementedError

    def get_tag_key(self, project_id, environment_id, key, status=TagKeyStatus.VISIBLE):
        """
        >>> get_tag_key(1, 2, "key1")
        """
        raise NotImplementedError

    def get_tag_keys(self, project_id, environment_id, status=TagKeyStatus.VISIBLE):
        """
        >>> get_tag_key(1, 2)
        """
        raise NotImplementedError

    def get_tag_value(self, project_id, environment_id, key, value):
        """
        >>> get_tag_value(1, 2, "key1", "value1")
        """
        raise NotImplementedError

    def get_tag_values(self, project_id, environment_id, key):
        """
        >>> get_tag_values(1, 2, "key1")
        """
        raise NotImplementedError

    def get_group_tag_key(self, project_id, group_id, environment_id, key):
        """
        >>> get_group_tag_key(1, 2, 3, "key1")
        """
        raise NotImplementedError

    def get_group_tag_keys(self, project_id, group_id, environment_id, limit=None):
        """
        >>> get_group_tag_key(1, 2, 3)
        """
        raise NotImplementedError

    def get_group_tag_value(self, project_id, group_id, environment_id, key, value):
        """
        >>> get_group_tag_value(1, 2, 3, "key1", "value1")
        """
        raise NotImplementedError

    def get_group_tag_values(self, project_id, group_id, environment_id, key):
        """
        >>> get_group_tag_values(1, 2, 3, "key1")
        """
        raise NotImplementedError

    def get_group_list_tag_value(self, project_id, group_id_list, environment_id, key, value):
        """
        >>> get_group_tag_value(1, [1, 2, 3, 4, 5], 3, "key1", "value1")
        """
        raise NotImplementedError

    def delete_tag_key(self, project_id, key):
        """
        >>> delete_tag_key(1, "key1")
        """
        raise NotImplementedError

    def delete_all_group_tag_keys(self, project_id, group_id):
        """
        >>> delete_all_group_tag_keys(1, 2)
        """
        raise NotImplementedError

    def delete_all_group_tag_values(self, project_id, group_id):
        """
        >>> delete_all_group_tag_values(1, 2)
        """
        raise NotImplementedError

    def incr_tag_value_times_seen(self, project_id, environment_id,
                                  key, value, extra=None, count=1):
        """
        >>> incr_tag_value_times_seen(1, 2, "key1", "value1")
        """
        raise NotImplementedError

    def incr_group_tag_value_times_seen(
            self, project_id, group_id, environment_id, key, value, extra=None, count=1):
        """
        >>> incr_group_tag_value_times_seen(1, 2, 3, "key1", "value1")
        """
        raise NotImplementedError

    def get_group_event_ids(self, project_id, group_id, environment_id, tags):
        """
        >>> get_group_event_ids(1, 2, 3, {'key1': 'value1', 'key2': 'value2'})
        """
        raise NotImplementedError

    def get_tag_value_qs(self, project_id, environment_id, key, query=None):
        """
        >>> get_tag_value_qs(1, 2, 'environment', query='prod')
        """
        raise NotImplementedError

    def get_group_tag_value_qs(self, project_id, group_id, environment_id, key, value=None):
        """
        >>> get_group_tag_value_qs(1, 2, 3, 'environment')
        """
        raise NotImplementedError

    def get_event_tag_qs(self, project_id, environment_id, key, value):
        """
        >>> get_event_tag_qs(1, 2, 'environment', 'prod')
        """
        raise NotImplementedError

    def get_groups_user_counts(self, project_id, group_ids, environment_id):
        """
        >>> get_groups_user_counts(1, [2, 3], 4)
        """
        raise NotImplementedError

    def get_group_tag_value_count(self, project_id, group_id, environment_id, key):
        """
        >>> get_group_tag_value_count(1, 2, 3, 'key1')
        """
        raise NotImplementedError

    def get_top_group_tag_values(self, project_id, group_id, environment_id, key, limit=3):
        """
        >>> get_top_group_tag_values(1, 2, 3, 'key1')
        """
        raise NotImplementedError

    def get_first_release(self, project_id, group_id):
        """
        >>> get_first_release(1, 2)
        """
        raise NotImplementedError

    def get_last_release(self, project_id, group_id):
        """
        >>> get_last_release(1, 2)
        """
        raise NotImplementedError

    def get_release_tags(self, project_ids, environment_id, versions):
        """
        >>> get_release_tags([1, 2], 3, ["1", "2"])
        """
        raise NotImplementedError

    def get_group_ids_for_users(self, project_ids, event_users, limit=100):
        """
        >>> get_group_ids_for_users([1,2], [EventUser(1), EventUser(2)])
        """
        raise NotImplementedError

    def get_group_tag_values_for_users(self, event_users, limit=100):
        """
        >>> get_group_tag_values_for_users([EventUser(1), EventUser(2)])
        """
        raise NotImplementedError

    def get_group_ids_for_search_filter(
            self, project_id, environment_id, tags, candidates=None, limit=1000):
        """
        >>> get_group_ids_for_search_filter(1, 2, [('key1', 'value1'), ('key2', 'value2')])
        """
        raise NotImplementedError

    def update_group_for_events(self, project_id, event_ids, destination_id):
        """
        >>> update_group_for_events(1, [2, 3], 4)
        """
        raise NotImplementedError

    def update_group_tag_key_values_seen(self, project_id, group_ids):
        """
        >>> update_group_tag_key_values_seen(1, [2, 3])
        """
        raise NotImplementedError

    def get_group_tag_keys_and_top_values(self, project_id, group_id, environment_id, user=None):
        from sentry.api.serializers import serialize

        tag_keys = self.get_group_tag_keys(project_id, group_id, environment_id)

        return [dict(
            totalValues=self.get_group_tag_value_count(
                project_id, group_id, environment_id, tk.key),
            topValues=serialize(self.get_top_group_tag_values(
                project_id, group_id, environment_id, tk.key, limit=10)),
            **serialize([tk])[0]
        ) for tk in tag_keys]
