from __future__ import absolute_import

from .base import Filter

from ua_parser.user_agent_parser import Parse

MIN_VERSIONS = {
    'Chrome': 0,
    'IE': 10,
    'Firefox': 0,
    'Safari': 6,
    'Edge': 0,
    'Opera': 15,
}


class LegacyBrowsersFilter(Filter):
    id = 'legacy-browsers'
    name = 'Filter out known errors from legacy browsers'
    description = 'Older browsers often give less accurate information, and while they may report valid issues, the context to understand them is incorrect or missing.'
    default = False

    def get_user_agent(self, data):
        try:
            for key, value in data['sentry.interfaces.Http']['headers']:
                if key.lower() == 'user-agent':
                    return value
        except LookupError:
            return ''

    def test(self, data):
        if data.get('platform') != 'javascript':
            return False

        value = self.get_user_agent(data)
        if not value:
            return False

        ua = Parse(value)
        if not ua:
            return False

        browser = ua['user_agent']
        if not browser['family']:
            return False

        try:
            minimum_version = MIN_VERSIONS[browser['family']]
        except KeyError:
            return False

        try:
            major_browser_version = int(browser['major'])
        except (TypeError, ValueError):
            return False

        if minimum_version > major_browser_version:
            return True

        return False
