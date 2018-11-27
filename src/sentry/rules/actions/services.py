from __future__ import absolute_import


class PluginService(object):
    def __init__(self, obj):
        self.service = obj

    @property
    def slug(self):
        return self.service.slug

    @property
    def title(self):
        return self.service.get_title()

    @property
    def service_type(self):
        return 'plugin'


class LegacyPluginService(PluginService):
    def __init__(self, obj):
        super(LegacyPluginService, self).__init__(obj)
        self.service = obj

    @property
    def service_type(self):
        return 'legacy_plugin'


class SentryAppService(PluginService):
    def __init__(self, obj):
        super(SentryAppService, self).__init__(obj)
        self.service = obj

    @property
    def title(self):
        return self.service.name

    @property
    def service_type(self):
        return 'sentry_app'
