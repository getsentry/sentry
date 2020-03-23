from __future__ import absolute_import

from sentry.plugins.base.v2 import Plugin2


class NativePlugin(Plugin2):
    can_disable = False

    def get_event_enhancers(self, data):
        # TODO: graceful rollout
        return []
