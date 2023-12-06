from __future__ import annotations

from collections import defaultdict
from typing import Any, Sequence

from django.utils import timezone

from sentry.models.user import User

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
        from sentry.models.useremail import UserEmail

        self.email = user.email or email
        self.list_id = list_id
        self.list_description = list_description
        self.list_name = list_name
        # is the email address verified?
        self.verified = (
            UserEmail.objects.get_primary_email(user).is_verified if verified is None else verified
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

    def __init__(self, enabled: bool = False) -> None:
        self._subscriptions: dict[User, dict[int, NewsletterSubscription]] = defaultdict(dict)
        self._enabled = enabled

    def enable(self):
        self._enabled = True

    def disable(self):
        self._enabled = False

    def clear(self):
        self._subscriptions = defaultdict(dict)

    def is_enabled(self):
        return self._enabled

    def get_subscriptions(self, user: User):
        return {"subscriptions": list((self._subscriptions.get(user) or {}).values())}

    def update_subscription(
        self,
        user: User,
        list_id: int | None = None,
        create: bool | None = False,
        **kwargs: Any,
    ) -> dict[int, NewsletterSubscription]:
        if not list_id:
            list_id = self.get_default_list_id()

        if create:
            self._subscriptions[user].setdefault(
                list_id, NewsletterSubscription(user, list_id, subscribed=True)
            )
        self._subscriptions[user][list_id].update(**kwargs)

        return self._subscriptions[user]

    def update_subscriptions(
        self,
        user: User,
        list_ids: Sequence[int] | None = None,
        create: bool | None = False,
        **kwargs: Any,
    ):
        if not list_ids:
            list_ids = self.get_default_list_ids()

        for list_id in list_ids:
            self.update_subscription(user, list_id, create, **kwargs)

        return self._subscriptions[user]

    def optout_email(self, email: str, **kwargs: Any) -> None:
        unsubscribe_date = timezone.now()
        for by_list in self._subscriptions.values():
            for subscription in by_list.values():
                if subscription.email == email:
                    subscription.update(subscribed=False, unsubscribe_date=unsubscribe_date)
