from typing import Mapping, Optional

from sentry.sentry_metrics.configuration import MAX_INDEXED_COLUMN_LENGTH


class TagsValidator:
    """
    This class is used to enforce the limits on tags that are received by the indexer.
    """

    MAX_TAG_KEY_LENGTH = MAX_INDEXED_COLUMN_LENGTH
    MAX_TAG_VALUE_LENGTH = MAX_INDEXED_COLUMN_LENGTH

    def is_allowed(self, tags: Optional[Mapping[str, str]]) -> bool:
        """
        Returns True if the tags key value pairs are within limits.
        """
        if tags is None:
            return True

        for key, value in tags.items():
            if key is None or len(key) > self.MAX_TAG_KEY_LENGTH:
                return False
            if value is None or len(value) > self.MAX_TAG_VALUE_LENGTH:
                return False

        return True


class ReleaseHealthTagsValidator(TagsValidator):
    """
    The release health pipeline has the same limits as the default tags limit enforcer.
    """

    pass


class GenericMetricsTagsValidator(TagsValidator):
    """
    The generic metrics pipeline has the same limits has the same limits for tag keys
    as the default tags limit enforcer, but has a different limit for tag values since tag values
    are not indexed.
    """

    MAX_TAG_VALUE_LENGTH = 1000
