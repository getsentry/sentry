"""
sentry.plugins.sentry_useragents.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import httpagentparser
import sentry

from django.utils.translation import ugettext_lazy as _

from sentry.plugins import register
from sentry.plugins.bases.tag import TagPlugin


class UserAgentPlugin(TagPlugin):
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/dcramer/sentry"

    def get_tag_values(self, event):
        http = event.interfaces.get('sentry.interfaces.Http')
        if not http:
            return []
        if not http.headers:
            return []
        if 'User-Agent' not in http.headers:
            return []
        ua = httpagentparser.detect(http.headers['User-Agent'])
        if not ua:
            return []
        result = self.get_tag_from_ua(ua)
        if not result:
            return []
        return [result]


class BrowserPlugin(UserAgentPlugin):
    """
    Adds additional support for showing information about browsers including:

    * A panel which shows all browsers a message was seen on.
    * A sidebar module which shows the browsers most actively seen on.
    """
    slug = 'browsers'
    title = _('Browsers')
    tag = 'browser'
    tag_label = _('Browser Name')

    def get_tag_from_ua(self, ua):
        return '%(name)s %(version)s' % ua['browser']


register(BrowserPlugin)


class OsPlugin(UserAgentPlugin):
    """
    Adds additional support for showing information about operating systems including:

    * A panel which shows all operating systems a message was seen on.
    * A sidebar module which shows the operating systems most actively seen on.
    """
    slug = 'os'
    title = _('Operating Systems')
    tag = 'os'
    tag_label = _('Operating System')

    def get_tag_from_ua(self, ua):
        if 'flavor' in ua:
            return '%(name)s %(version)s' % ua['flavor']
        return '%(name)s %(version)s' % ua['os']

register(OsPlugin)
