from __future__ import absolute_import

from sentry.utils.services import Service


class Newsletter(Service):
    __all__ = (
        'is_enabled', 'get_default_list_id', 'get_subscriptions', 'update_subscription',
        'create_or_update_subscription', 'optout_email',
    )

    DEFAULT_LIST_ID = 1

    enabled = False

    def get_default_list_id(self):
        return self.DEFAULT_LIST_ID

    def is_enabled(self):
        return self.enabled

    def get_subscriptions(self, user):
        return None

    def update_subscription(self, user, list_id=None, subscribed=True, create=None,
                            verified=None, subscribed_date=None, unsubscribed_date=None, **kwargs):
        return None

    def create_or_update_subscription(self, user, list_id=None, subscribed=True, verified=None,
                                      subscribed_date=None, unsubscribed_date=None, **kwargs):
        return self.update_subscription(
            user=user,
            list_id=list_id,
            subscribed=subscribed,
            verified=verified,
            subscribed_date=subscribed_date,
            unsubscribed_date=unsubscribed_date,
            create=True,
            **kwargs
        )

    def optout_email(self, email, **kwargs):
        raise NotImplementedError
