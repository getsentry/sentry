"""
sentry.plugins.sentry_useragents.models
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from ua_parser.user_agent_parser import Parse

import sentry
from sentry.plugins import register
from sentry.plugins.bases.tag import TagPlugin


class UserAgentPlugin(TagPlugin):
    version = sentry.VERSION
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    project_default_enabled = True

    def get_tag_values(self, event):
        contexts = event.interfaces.get('contexts')
        # disable tagging if contexts are present
        if contexts:
            return []

        http = event.interfaces.get('sentry.interfaces.Http')
        if not http:
            return []
        if not http.headers:
            return []

        headers = http.headers
        # XXX: transitional support for workers
        if isinstance(headers, dict):
            headers = headers.items()

        output = []
        for key, value in headers:
            if key != 'User-Agent':
                continue
            ua = Parse(value)
            if not ua:
                continue
            result = self.get_tag_from_ua(ua)
            if result:
                output.append(result)
        return output


class BrowserPlugin(UserAgentPlugin):
    """
    Automatically adds the 'browser' tag from events containing interface data
    from ``sentry.interfaces.Http``.
    """
    slug = 'browsers'
    title = 'Auto Tag: Browsers'
    tag = 'browser'

    def get_tag_from_ua(self, ua):
        ua = ua['user_agent']

        if not ua['family']:
            return

        version = '.'.join(value for value in [
            ua['major'],
            ua['minor'],
        ] if value)
        tag = ua['family']
        if version:
            tag += ' ' + version

        return tag

register(BrowserPlugin)


class OsPlugin(UserAgentPlugin):
    """
    Automatically adds the 'os' tag from events containing interface data
    from ``sentry.interfaces.Http``.
    """
    slug = 'os'
    title = 'Auto Tag: Operating Systems'
    tag = 'os'

    def get_tag_from_ua(self, ua):
        ua = ua['os']

        if not ua['family']:
            return

        version = '.'.join(value for value in [
            ua['major'],
            ua['minor'],
            ua['patch'],
        ] if value)
        tag = ua['family']
        if version:
            tag += ' ' + version

        return tag

register(OsPlugin)


class DevicePlugin(UserAgentPlugin):
    """
    Automatically adds the 'device' tag from events containing interface data
    from ``sentry.interfaces.Http``.
    """
    slug = 'device'
    title = 'Auto Tag: Device'
    tag = 'device'

    def get_tag_from_ua(self, ua):
        return ua['device']['family']

register(DevicePlugin)
