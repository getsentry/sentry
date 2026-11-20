from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Protocol

from sentry.users.models.user import User
from sentry.utils.services import Service


class SubscriptionRecord(Protocol):
    @property
    def list_id(self) -> int: ...

    @property
    def subscribed(self) -> bool: ...

    @property
    def verified(self) -> bool | None: ...

    def get(self, key: str, default: object = None) -> object: ...


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

    DEFAULT_LISTS = (1,)
    DEFAULT_LIST_ID = DEFAULT_LISTS[0]

    enabled = False

    def is_enabled(self) -> bool:
        return self.enabled

    def optout_email(self, email: str, **kwargs: object) -> None:
        raise NotImplementedError

    """
    Replacements for the functions below that only accept a single list_id argument
    """

    def get_default_list_ids(self) -> tuple[int, ...]:
        return self.DEFAULT_LISTS

    def get_subscriptions(self, user: User) -> Mapping[str, Sequence[SubscriptionRecord]] | None:
        return None

    def update_subscriptions(
        self,
        user: User,
        *,
        list_ids: Sequence[int] | None = None,
        subscribed: bool = True,
        create: bool | None = None,
        verified: bool | None = None,
        subscribed_date: datetime | None = None,
        unsubscribed_date: datetime | None = None,
        **kwargs: object,
    ) -> Mapping[int, object] | None:
        return None

    def create_or_update_subscriptions(
        self,
        user: User,
        *,
        list_ids: Sequence[int] | None = None,
        subscribed: bool = True,
        verified: bool | None = None,
        subscribed_date: datetime | None = None,
        unsubscribed_date: datetime | None = None,
        **kwargs: object,
    ) -> Mapping[int, object] | None:
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
    ) -> Mapping[int, object] | None:
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
    ) -> Mapping[int, object] | None:
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
