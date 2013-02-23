"""
sentry.plugins.bases.tag
~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.models import Group
from sentry.plugins import Plugin


class TagPlugin(Plugin):
    tag = None
    tag_label = None
    project_default_enabled = True

    def get_tag_values(self, event):
        """
        Must return a list of values.

        >>> get_tag_pairs(event)
        [tag1, tag2, tag3]
        """
        raise NotImplementedError

    def post_process(self, group, event, is_new, is_sample, **kwargs):
        Group.objects.add_tags(group, [(self.tag, v) for v in self.get_tag_values(event)])
