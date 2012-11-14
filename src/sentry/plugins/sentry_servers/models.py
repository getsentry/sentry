"""
sentry.plugins.sentry_servers.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import sentry

from django.utils.translation import ugettext_lazy as _

from sentry.plugins import register
from sentry.plugins.bases.tag import TagPlugin


class ServersPlugin(TagPlugin):
    """
    Automatically adds the 'server_name' tag from events.
    """
    slug = 'servers'
    title = _('Servers')
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    tag = 'server_name'
    tag_label = _('Server Name')

    def get_tag_values(self, event):
        if not event.server_name:
            return []
        return [event.server_name]

register(ServersPlugin)
