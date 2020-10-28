from __future__ import absolute_import

__all__ = ("User",)


from sentry.interfaces.base import Interface
from sentry.utils.json import prune_empty_keys
from sentry.interfaces.geo import Geo
from sentry.web.helpers import render_to_string


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
    def to_python(cls, data):
        data = data.copy()
        for key in ("id", "email", "username", "ip_address", "name", "geo", "data"):
            data.setdefault(key, None)
        if data["geo"] is not None:
            data["geo"] = Geo.to_python(data["geo"])
        return cls(**data)

    def to_json(self):
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

    def get_api_context(self, is_public=False, platform=None):
        return {
            "id": self.id,
            "email": self.email,
            "username": self.username,
            "ip_address": self.ip_address,
            "name": self.name,
            "data": self.data,
        }

    def get_api_meta(self, meta, is_public=False, platform=None):
        return {
            "": meta.get(""),
            "id": meta.get("id"),
            "email": meta.get("email"),
            "username": meta.get("username"),
            "ip_address": meta.get("ip_address"),
            "name": meta.get("name"),
            "data": meta.get("data"),
        }

    def get_display_name(self):
        return self.email or self.username

    def get_label(self):
        return self.name or self.email or self.username or self.id or self.ip_address

    def to_email_html(self, event, **kwargs):
        context = {
            "user_id": self.id,
            "user_email": self.email,
            "user_username": self.username,
            "user_ip_address": self.ip_address,
            "user_data": self.data,
            "user": self,
        }
        return render_to_string("sentry/partial/interfaces/user_email.html", context)
