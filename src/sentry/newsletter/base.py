from __future__ import annotations

from collections.abc import Collection, Sequence
from datetime import datetime
from typing import Protocol, ReadOnly, TypedDict

from sentry.users.models.user import User
from sentry.utils.services import Service


class SubscriptionRecord(Protocol):
    def get(self, key: str, /) -> object: ...


class NewsletterSubscriptions(TypedDict):
    subscriptions: ReadOnly[Sequence[SubscriptionRecord]]


class Newsletter(Service):
    __all__ = (
        "is_enabled",
        "get_default_list_id",
        "get_default_list_ids",
        "get_subscriptions",
        "update_subscription",
        "update_subscriptions",
        "create_or_update_subscription",
        "create_or_update_subscriptions",
        "optout_email",
    )

    DEFAULT_LISTS: Collection[int] = (1,)
    DEFAULT_LIST_ID = 1

    enabled = False

    def is_enabled(self) -> bool:
        return self.enabled

    def optout_email(self, email: str, **kwargs: object) -> object:
        raise NotImplementedError

    """
    Replacements for the functions below that only accept a single list_id argument
    """

    def get_default_list_ids(self) -> Collection[int]:
        return self.DEFAULT_LISTS

    def get_subscriptions(self, user: User) -> NewsletterSubscriptions | None:
        return None

    def update_subscriptions(
        self,
        user: User,
        *,
        list_ids: Collection[int] | None = None,
        subscribed: bool = True,
        create: bool | None = None,
        verified: bool | None = None,
        subscribed_date: datetime | None = None,
        unsubscribed_date: datetime | None = None,
        **kwargs: object,
    ) -> object:
        return None

    def create_or_update_subscriptions(
        self,
        user: User,
        *,
        list_ids: Collection[int] | None = None,
        subscribed: bool = True,
        verified: bool | None = None,
        subscribed_date: datetime | None = None,
        unsubscribed_date: datetime | None = None,
        **kwargs: object,
    ) -> object:
        return self.update_subscriptions(
            user=user,
            list_ids=list_ids,
            subscribed=subscribed,
            verified=verified,
            subscribed_date=subscribed_date,
            unsubscribed_date=unsubscribed_date,
            create=True,
            **kwargs,
        )

    """
    These methods are deprecated in favor of the corresponding functions that
    accept multiple list IDs
    """

    def get_default_list_id(self) -> int:
        return self.DEFAULT_LIST_ID

    def update_subscription(
        self,
        user: User,
        *,
        list_id: int | None = None,
        subscribed: bool = True,
        create: bool | None = None,
        verified: bool | None = None,
        subscribed_date: datetime | None = None,
        unsubscribed_date: datetime | None = None,
        **kwargs: object,
    ) -> object:
        return None

    def create_or_update_subscription(
        self,
        user: User,
        *,
        list_id: int | None = None,
        subscribed: bool = True,
        verified: bool | None = None,
        subscribed_date: datetime | None = None,
        unsubscribed_date: datetime | None = None,
        **kwargs: object,
    ) -> object:
        return self.update_subscription(
            user=user,
            list_id=list_id,
            subscribed=subscribed,
            verified=verified,
            subscribed_date=subscribed_date,
            unsubscribed_date=unsubscribed_date,
            create=True,
            **kwargs,
        )
