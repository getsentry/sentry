__all__ = ("User",)


from collections.abc import Mapping
from typing import Any, Self, TypedDict

from sentry.interfaces.base import Interface
from sentry.interfaces.geo import Geo
from sentry.utils.json import prune_empty_keys
from sentry.web.helpers import render_to_string


class EventUserApiContext(TypedDict, total=False):
    id: str | None
    email: str | None
    username: str | None
    ip_address: str | None
    name: str | None
    geo: dict[str, str] | None
    data: dict[str, Any] | None


class User(Interface):
    """
    An interface which describes the authenticated User for a request.

    You should provide **at least** either an `id` (a unique identifier for
    an authenticated user) or `ip_address` (their IP address).

    All other attributes are optional.

    >>> {
    >>>     "id": "unique_id",
    >>>     "username": "my_user",
    >>>     "email": "foo@example.com"
    >>>     "ip_address": "127.0.0.1",
    >>>     "optional": "value"
    >>> }
    """

    score = 1
    display_score = 2020

    @classmethod
    def to_python(cls, data: dict[str, Any]) -> Self | None:  # justification: decoded JSON
        data = data.copy()
        for key in ("id", "email", "username", "ip_address", "name", "geo", "data"):
            data.setdefault(key, None)
        if data["geo"] is not None:
            data["geo"] = Geo.to_python(data["geo"])

        return super().to_python(data)

    def to_json(self) -> dict[str, Any]:  # justification: decoded JSON
        return prune_empty_keys(
            {
                "id": self.id,
                "email": self.email,
                "username": self.username,
                "ip_address": self.ip_address,
                "name": self.name,
                "geo": self.geo.to_json() if self.geo is not None else None,
                "data": self.data or None,
            }
        )

    def get_api_context(
        self, is_public: bool = False, platform: str | None = None
    ) -> EventUserApiContext:
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "ip_address": self.ip_address,
            "name": self.name,
            "geo": self.geo.to_json() if self.geo is not None else None,
            "data": self.data,
        }

    def get_api_meta(
        # justification: decoded JSON
        self,
        meta: Mapping[str, Any],  # justification: decoded JSON
        is_public: bool = False,
        platform: str | None = None,
    ) -> Mapping[str, Any] | None:  # justification: decoded JSON
        return {
            "": meta.get(""),
            "id": meta.get("id"),
            "email": meta.get("email"),
            "username": meta.get("username"),
            "ip_address": meta.get("ip_address"),
            "name": meta.get("name"),
            "geo": meta.get("geo"),
            "data": meta.get("data"),
        }

    def get_display_name(self) -> str | None:
        for value in (self.email, self.username):
            if isinstance(value, str) and value:
                return value
        return None

    def get_label(self) -> str | None:
        for value in (self.name, self.email, self.username, self.id, self.ip_address):
            if isinstance(value, str) and value:
                return value
        return None

    def to_email_html(self, event: Any, **kwargs: Any) -> str:  # justification: framework kwargs
        context = {
            "user_id": self.id,
            "user_email": self.email,
            "user_username": self.username,
            "user_ip_address": self.ip_address,
            "user_data": self.data,
            "user": self,
        }
        return render_to_string("sentry/partial/interfaces/user_email.html", context)
