"""
sentry.plugins.sentry_sites.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import sentry

from django.utils.translation import ugettext_lazy as _

from sentry.plugins import register
from sentry.plugins.bases.tag import TagPlugin


class SitesPlugin(TagPlugin):
    """
    Automatically adds the 'site' tag from events.
    """
    slug = 'sites'
    title = _('Auto Tag: Sites')
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    tag = 'site'
    tag_label = _('Site')

    def get_tag_values(self, event):
        if not event.site:
            return []
        return [event.site]

register(SitesPlugin)
