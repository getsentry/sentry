from __future__ import absolute_import

from .base import Filter

from ua_parser.user_agent_parser import Parse
from rest_framework import serializers
from sentry.models import ProjectOption


MIN_VERSIONS = {
    'Chrome': 0,
    'IE': 10,
    'Firefox': 0,
    'Safari': 6,
    'Edge': 0,
    'Opera': 15,
    'Android': 4,
}


class OperaFilter(Filter):
    id = 'legacy-browsers:opera'
    name = 'Opera'
    description = 'Below Version 15'
    slug = 'opera'
    default = False

    def get_user_agent(self, data):
        try:
            for key, value in data['sentry.interfaces.Http']['headers']:
                if key.lower() == 'user-agent':
                    return value
        except LookupError:
            return ''

    def test(self, data, filter_opts):
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

        if not browser['family'] == "Opera":
            return False

        try:
            major_browser_version = int(browser['major'])
        except (TypeError, ValueError):
            return False

        if major_browser_version < 15:
            return True

        return False


class SafariFilter(Filter):
    id = 'legacy-browsers:safari'
    name = 'Safari'
    description = 'Below Version 6'
    slug = 'safari'
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

        if not browser['family'] == "Safari":
            return False

        try:
            major_browser_version = int(browser['major'])
        except (TypeError, ValueError):
            return False

        if major_browser_version < 6:
            return True

        return False


class AndroidFilter(Filter):
    id = 'legacy-browsers:android'
    name = 'Android'
    description = 'Below Version 4'
    slug = 'android'
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

        if not browser['family'] == "Android":
            return False

        try:
            major_browser_version = int(browser['major'])
        except (TypeError, ValueError):
            return False

        if major_browser_version < 4:
            return True

        return False


class IE8Filter(Filter):
    id = 'legacy-browsers:ie8'
    name = 'Internet Explorer'
    description = 'Version 8'
    slug = 'internet-explorer'
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

        if not browser['family'] == "IE":
            return False

        try:
            major_browser_version = int(browser['major'])
        except (TypeError, ValueError):
            return False

        if major_browser_version == 8:
            return True

        return False


class IE9Filter(Filter):
    id = 'legacy-browsers'
    key = 'ie9'
    name = 'Internet Explorer'
    description = 'Version 9'
    slug = 'internet-explorer'
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

        if not browser['family'] == "IE":
            return False

        try:
            major_browser_version = int(browser['major'])
        except (TypeError, ValueError):
            return False

        if major_browser_version == 9:
            return True

        return False


class LegacyBrowserFilterSerializer(serializers.Serializer):
    # TODO: maybe find a serializer that handles multple values already
    value = serializers.TextField()


class LegacyBrowsersFilter(Filter):
    id = 'legacy-browsers'
    name = 'Filter out known errors from legacy browsers'
    description = 'Older browsers often give less accurate information, and while they may report valid issues, the context to understand them is incorrect or missing.'
    default = False
    serializer_cls = LegacyBrowserFilterSerializer

    def is_enabled(self):
        # May be either a '1' or an iterable for new style
        return ProjectOption.objects.get_value(
            project=self.project,
            key='filters:{}'.format(self.id),
            default='1' if self.default else '0',
        ) != '0'

    def get_user_agent(self, data):
        try:
            for key, value in data['sentry.interfaces.Http']['headers']:
                if key.lower() == 'user-agent':
                    return value
        except LookupError:
            return ''

    def filter_default(self, ua):
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

    def filter_ie8(self, ua):
        pass

    def enable(self, value=None):
        if value is None:
            value = {'value': []}

        ProjectOption.objects.set_value(
            project=self.project,
            key='filters:{}'.format(self.id),
            value=set(value['value'].split(',')) if value['value'] else '0',
        )

    def test(self, data, opts):
        if data.get('platform') != 'javascript':
            return False

        opts = ProjectOption.objects.get_value(
            project=self.project,
            key='filters:{}'.format(self.id),
        )

        value = self.get_user_agent(data)
        if not value:
            return False

        ua = Parse(value)
        if not ua:
            return False

        # handle old style config
        if opts == '1':
            return self.filter_default(ua)

        # New style is not a simple boolean, but a list of
        # specific filters to apply
        for key in opts:
            try:
                fn = getattr(self, 'filter_' + key)
            except AttributeError:
                pass
            else:
                if fn(ua):
                    return True
