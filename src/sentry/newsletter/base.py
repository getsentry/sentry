from __future__ import absolute_import


class Newsletter(object):
    __all__ = ('is_enabled', 'get_subscriptions', 'update_subscription',
               'create_or_update_subscription')

    DEFAULT_LIST_ID = 1

    enabled = False

    def is_enabled(self):
        return self.enabled

    def get_subscriptions(self, user):
        return None

    def update_subscription(self, user, **kwargs):
        return None

    def create_or_update_subscription(self, user, **kwargs):
        kwargs['create'] = True
        return self.update_subscription(user, **kwargs)
