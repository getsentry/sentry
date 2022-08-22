from sentry.constants import MAX_TAG_VALUE_LENGTH
from sentry.plugins.base.v2 import Plugin2


class TagPlugin(Plugin2):
    tag = None
    project_default_enabled = True

    def get_tag_values(self, event, **kwargs):
        """
        Must return a list of values.

        >>> get_tag_pairs(event)
        [tag1, tag2, tag3]
        """
        raise NotImplementedError

    def get_tags(self, event, **kwargs):
        return [(self.tag, v) for v in self.get_tag_values(event) if len(v) <= MAX_TAG_VALUE_LENGTH]
