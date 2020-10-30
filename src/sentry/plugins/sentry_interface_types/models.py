from __future__ import absolute_import

import six

import sentry

from sentry.plugins.bases.tag import TagPlugin


class InterfaceTypePlugin(TagPlugin):
    """
    Automatically adds the 'interface_type' tag from events containing referencing
    the class name of each interface (e.g. Http, Stacktrace, Exception).
    """

    description = __doc__
    slug = "interface_types"
    title = "Auto Tag: Interface Types"
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    tag = "interface_type"
    project_default_enabled = False

    def get_tag_values(self, event):
        return [i.rsplit(".", 1)[-1] for i in six.iterkeys(event.interfaces)]
