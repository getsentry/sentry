from collections import defaultdict

from django.utils import timezone

from .base import Newsletter


class NewsletterSubscription:
    def __init__(
        self,
        user,
        list_id,
        list_name=None,
        list_description=None,
        email=None,
        verified=None,
        subscribed=False,
        subscribed_date=None,
        unsubscribed_date=None,
        **kwargs,
    ):
        from sentry.models import UserEmail

        self.email = user.email or email
        self.list_id = list_id
        self.list_description = list_description
        self.list_name = list_name
        # is the email address verified?
        self.verified = (
            UserEmail.get_primary_email(user).is_verified if verified is None else verified
        )
        # are they subscribed to ``list_id``
        self.subscribed = subscribed
        if subscribed:
            self.subscribed_date = subscribed_date or timezone.now()
        elif subscribed is False:
            self.unsubscribed_date = unsubscribed_date or timezone.now()

    def __getitem__(self, key):
        return getattr(self, key)

    def get(self, key, default=None):
        return getattr(self, key, default)

    def update(
        self, verified=None, subscribed=None, subscribed_date=None, unsubscribed_date=None, **kwargs
    ):
        if verified is not None:
            self.verified = verified
        if subscribed is not None:
            self.subscribed = subscribed
        if subscribed_date is not None:
            self.subscribed_date = subscribed_date
        elif subscribed:
            self.subscribed_date = timezone.now()
        if unsubscribed_date is not None:
            self.unsubscribed_date = unsubscribed_date
        elif subscribed is False:
            self.unsubscribed_date = timezone.now()


class DummyNewsletter(Newsletter):
    """
    The ``DummyNewsletter`` implementation is primarily used for test cases. It uses a in-memory
    store for tracking subscriptions, which means its not suitable for any real production use-case.
    """

    def __init__(self, enabled=False):
        self._subscriptions = defaultdict(dict)
        self._optout = set()
        self._enabled = enabled

    def enable(self):
        self._enabled = True

    def disable(self):
        self._enabled = False

    def clear(self):
        self._subscriptions = defaultdict(dict)
        self._optout = set()

    def is_enabled(self):
        return self._enabled

    def get_subscriptions(self, user):
        return {"subscriptions": list((self._subscriptions.get(user) or {}).values())}

    def update_subscription(self, user, list_id=None, create=False, **kwargs):
        if not list_id:
            list_id = self.get_default_list_id()

        if create:
            self._subscriptions[user].setdefault(
                list_id, NewsletterSubscription(user, list_id, subscribed=True)
            )
        self._subscriptions[user][list_id].update(**kwargs)

        return self._subscriptions[user]

    def update_subscriptions(self, user, list_ids=None, create=False, **kwargs):
        if not list_ids:
            list_ids = self.get_default_list_ids()

        for list_id in list_ids:
            self.update_subscription(user, list_id, create, **kwargs)

        return self._subscriptions[user]

    def optout_email(self, email, **kwargs):
        self._optout.add(email)
