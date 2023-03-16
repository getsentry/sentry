import re

from sentry.constants import TAG_LABELS
from sentry.tagstore.exceptions import (
    GroupTagKeyNotFound,
    GroupTagValueNotFound,
    TagKeyNotFound,
    TagValueNotFound,
)
from sentry.utils.services import Service, raises

# Valid pattern for tag key names
TAG_KEY_RE = re.compile(r"^[a-zA-Z0-9_\.:-]+$")

# Number of tag values to return by default for any query returning the "top"
# values for a tag.
TOP_VALUES_DEFAULT_LIMIT = 9

# These tags are special and are used in pairing with `sentry:{}`
# they should not be allowed to be set via data ingest due to ambiguity
INTERNAL_TAG_KEYS = frozenset(("release", "dist", "user", "filename", "function"))


# TODO(dcramer): pull in enum library
class TagKeyStatus:
    VISIBLE = 0
    PENDING_DELETION = 1
    DELETION_IN_PROGRESS = 2


class TagStorage(Service):
    __read_methods__ = frozenset(
        [
            "get_tag_key",
            "get_tag_keys",
            "get_tag_value",
            "get_tag_values",
            "get_group_tag_key",
            "get_group_tag_keys",
            "get_group_tag_value",
            "get_group_tag_values",
            "get_group_list_tag_value",
            "get_perf_group_list_tag_value",
            "get_generic_group_list_tag_value",
            "get_tag_keys_for_projects",
            "get_groups_user_counts",
            "get_perf_groups_user_counts",
            "get_generic_groups_user_counts",
            "get_group_event_filter",
            "get_group_tag_value_count",
            "get_top_group_tag_values",
            "get_first_release",
            "get_last_release",
            "get_release_tags",
            "get_group_ids_for_users",
            "get_group_tag_values_for_users",
            "get_group_tag_keys_and_top_values",
            "get_tag_value_paginator",
            "get_group_tag_value_paginator",
            "get_tag_value_paginator_for_projects",
            "get_group_tag_value_iter",
            "get_group_tag_value_qs",
            "get_group_seen_values_for_environments",
        ]
    )

    __all__ = (
        frozenset(
            [
                "is_valid_key",
                "is_valid_value",
                "is_reserved_key",
                "prefix_reserved_key",
                "get_standardized_key",
                "get_tag_key_label",
                "get_tag_value_label",
            ]
        )
        | __read_methods__
    )

    def setup_merge(self, grouptagkey_model, grouptagvalue_model):
        from sentry.tasks import merge

        merge.EXTRA_MERGE_MODELS += [grouptagvalue_model, grouptagkey_model]

    def is_valid_key(self, key):
        return bool(TAG_KEY_RE.match(key))

    def is_valid_value(self, value):
        return "\n" not in value

    def is_reserved_key(self, key):
        return key in INTERNAL_TAG_KEYS

    def prefix_reserved_key(self, key):
        # XXX(dcramer): kill sentry prefix for internal reserved tags
        if self.is_reserved_key(key):
            return f"sentry:{key}"
        else:
            return key

    def get_standardized_key(self, key):
        return key.split("sentry:", 1)[-1]

    def get_tag_key_label(self, key):
        return TAG_LABELS.get(key) or key.replace("_", " ").title()

    def get_tag_value_label(self, key, value):
        label = value

        if key == "sentry:user" and value:
            if value.startswith("id:"):
                label = value[len("id:") :]
            elif value.startswith("email:"):
                label = value[len("email:") :]
            elif value.startswith("username:"):
                label = value[len("username:") :]
            elif value.startswith("ip:"):
                label = value[len("ip:") :]

        return label

    @raises([TagKeyNotFound])
    def get_tag_key(
        self, project_id, environment_id, key, status=TagKeyStatus.VISIBLE, tenant_ids=None
    ):
        """
        >>> get_tag_key(1, 2, "key1")
        """
        raise NotImplementedError

    def get_tag_keys(
        self,
        project_id,
        environment_id,
        status=TagKeyStatus.VISIBLE,
        include_values_seen=False,
        tenant_ids=None,
    ):
        """
        >>> get_tag_keys(1, 2)
        """
        raise NotImplementedError

    def get_tag_keys_for_projects(
        self, projects, environments, start, end, status=TagKeyStatus.VISIBLE, tenant_ids=None
    ):
        """
        >>> get_tag_key([1], [2])
        """
        raise NotImplementedError

    @raises([TagValueNotFound])
    def get_tag_value(self, project_id, environment_id, key, value, tenant_ids=None):
        """
        >>> get_tag_value(1, 2, "key1", "value1")
        """
        raise NotImplementedError

    def get_tag_values(self, project_id, environment_id, key, tenant_ids=None):
        """
        >>> get_tag_values(1, 2, "key1")
        """
        raise NotImplementedError

    @raises([GroupTagKeyNotFound])
    def get_group_tag_key(self, group, environment_id, key, tenant_ids=None):
        """
        >>> get_group_tag_key(group, 3, "key1")
        """
        raise NotImplementedError

    def get_group_tag_keys(self, group, environment_ids, limit=None, keys=None, tenant_ids=None):
        """
        >>> get_group_tag_key(group, 2, [3])
        """
        raise NotImplementedError

    @raises([GroupTagValueNotFound])
    def get_group_tag_value(
        self, project_id, group_id, environment_id, key, value, tenant_ids=None
    ):
        """
        >>> get_group_tag_value(1, 2, 3, "key1", "value1")
        """
        raise NotImplementedError

    def get_group_tag_values(self, group, environment_id, key, tenant_ids=None):
        """
        >>> get_group_tag_values(group, 3, "key1")
        """
        raise NotImplementedError

    def get_group_list_tag_value(
        self, project_ids, group_id_list, environment_ids, key, value, tenant_ids=None
    ):
        """
        >>> get_group_list_tag_value([1, 2], [1, 2, 3, 4, 5], [3], "key1", "value1")
        """
        raise NotImplementedError

    def get_perf_group_list_tag_value(
        self, project_ids, group_id_list, environment_ids, key, value, tenant_ids=None
    ):
        raise NotImplementedError

    def get_generic_group_list_tag_value(
        self, project_ids, group_id_list, environment_ids, key, value, tenant_ids=None
    ):
        raise NotImplementedError

    def get_group_event_filter(
        self, project_id, group_id, environment_ids, tags, start, end, tenant_ids=None
    ):
        """
        >>> get_group_event_filter(1, 2, 3, {'key1': 'value1', 'key2': 'value2'})
        """
        raise NotImplementedError

    def get_tag_value_paginator(
        self, project_id, environment_id, key, query=None, order_by="-last_seen", tenant_ids=None
    ):
        """
        >>> get_tag_value_paginator(1, 2, 'environment', query='prod')
        """
        raise NotImplementedError

    def get_tag_value_paginator_for_projects(
        self,
        projects,
        environments,
        key,
        start,
        end,
        query=None,
        order_by="-last_seen",
        tenant_ids=None,
    ):
        """
        Includes tags and also snuba columns, with the arrayjoin when they are nested.
        Also supports a query parameter to do a substring match on the tag/column values.
        >>> get_tag_value_paginator_for_projects([1], [2], 'environment', query='prod')
        """
        raise NotImplementedError

    def get_group_tag_value_iter(
        self, group, environment_ids, key, callbacks=(), offset=0, tenant_ids=None
    ):
        """
        >>> get_group_tag_value_iter(group, 2, 3, 'environment')
        """
        raise NotImplementedError

    def get_group_tag_value_paginator(
        self, group, environment_ids, key, order_by="-id", tenant_ids=None
    ):
        """
        >>> get_group_tag_value_paginator(group, 3, 'environment')
        """
        raise NotImplementedError

    def get_group_tag_value_qs(self, project_id, group_id, environment_id, key, value=None):
        """
        >>> get_group_tag_value_qs(1, 2, 3, 'environment')
        """
        raise NotImplementedError

    def get_groups_user_counts(
        self, project_ids, group_ids, environment_ids, start=None, end=None, tenant_ids=None
    ):
        """
        >>> get_groups_user_counts([1, 2], [2, 3], [4, 5])
        `start` and `end` are only used by the snuba backend
        """
        raise NotImplementedError

    def get_perf_groups_user_counts(
        self, project_ids, group_ids, environment_ids, start=None, end=None, tenant_ids=None
    ):
        raise NotImplementedError

    def get_generic_groups_user_counts(
        self, project_ids, group_ids, environment_ids, start=None, end=None, tenant_ids=None
    ):
        raise NotImplementedError

    def get_group_tag_value_count(self, group, environment_id, key, tenant_ids=None):
        """
        >>> get_group_tag_value_count(group, 3, 'key1')
        """
        raise NotImplementedError

    def get_top_group_tag_values(
        self, group, environment_id, key, limit=TOP_VALUES_DEFAULT_LIMIT, tenant_ids=None
    ):
        """
        >>> get_top_group_tag_values(group, 3, 'key1')
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

    def get_release_tags(self, organization_id, project_ids, environment_id, versions):
        """
        >>> get_release_tags([1, 2], 3, ["1", "2"])
        """
        raise NotImplementedError

    def get_group_ids_for_users(self, project_ids, event_users, limit=100, tenant_ids=None):
        """
        >>> get_group_ids_for_users([1,2], [EventUser(1), EventUser(2)])
        """
        raise NotImplementedError

    def get_group_tag_values_for_users(self, event_users, limit=100, tenant_ids=None):
        """
        >>> get_group_tag_values_for_users([EventUser(1), EventUser(2)])
        """
        raise NotImplementedError

    def get_group_tag_keys_and_top_values(
        self,
        group,
        environment_ids,
        keys=None,
        value_limit=TOP_VALUES_DEFAULT_LIMIT,
        tenant_ids=None,
        **kwargs,
    ):

        # only the snuba backend supports multi env, and that overrides this method
        if environment_ids and len(environment_ids) > 1:
            environment_ids = environment_ids[:1]

        # If keys is unspecified, we will grab all tag keys for this group.
        tag_keys = self.get_group_tag_keys(group, environment_ids, keys=keys, tenant_ids=tenant_ids)

        environment_id = environment_ids[0] if environment_ids else None
        for tk in tag_keys:
            tk.top_values = self.get_top_group_tag_values(
                group, environment_id, tk.key, limit=value_limit
            )
            if tk.count is None:
                tk.count = self.get_group_tag_value_count(group, environment_id, tk.key)

        return tag_keys

    def get_group_seen_values_for_environments(
        self, project_ids, group_id_list, environment_ids, start=None, end=None, tenant_ids=None
    ):
        raise NotImplementedError
