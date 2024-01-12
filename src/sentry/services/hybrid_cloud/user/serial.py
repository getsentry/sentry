from __future__ import annotations

from typing import Any, FrozenSet, Iterable, List

from django.utils.functional import LazyObject

from sentry.db.models import BaseQuerySet
from sentry.models.avatars.user_avatar import UserAvatar
from sentry.models.user import User
from sentry.services.hybrid_cloud.user import RpcAuthenticator, RpcAvatar, RpcUser, RpcUserEmail


def serialize_generic_user(user: Any) -> RpcUser | None:
    """Serialize a user-representing object of unknown type to an RpcUser.

    Return None if the user is anonymous (not logged in).
    """
    if isinstance(user, LazyObject):  # from auth middleware
        user = getattr(user, "_wrapped")
    if user is None or user.id is None:
        return None
    if isinstance(user, RpcUser):
        return user
    if isinstance(user, User):
        return serialize_rpc_user(user)
    raise TypeError(f"Can't serialize {type(user)} to RpcUser")


def serialize_rpc_user(user: User) -> RpcUser:
    args = {
        field_name: getattr(user, field_name)
        for field_name in RpcUser.__fields__
        if hasattr(user, field_name)
    }
    args["pk"] = user.pk
    args["display_name"] = user.get_display_name()
    args["label"] = user.get_label()
    args["is_superuser"] = user.is_superuser
    args["is_sentry_app"] = bool(user.is_sentry_app)
    args["password_usable"] = user.has_usable_password()

    # Prefer eagerloaded attributes from _base_query
    if hasattr(user, "useremails") and user.useremails is not None:
        args["emails"] = frozenset([e["email"] for e in user.useremails if e["is_verified"]])
    else:
        args["emails"] = frozenset([email.email for email in user.get_verified_emails()])
    args["session_nonce"] = user.session_nonce

    # And process the _base_query special data additions
    args["permissions"] = frozenset(getattr(user, "permissions", None) or ())

    if args["name"] is None:
        # This field is non-nullable according to the Django schema, but may be null
        # on some servers due to migration history
        args["name"] = ""

    roles: FrozenSet[str] = frozenset()
    if hasattr(user, "roles") and user.roles is not None:
        roles = frozenset(_flatten(user.roles))
    args["roles"] = roles

    args["useremails"] = [
        RpcUserEmail(id=e["id"], email=e["email"], is_verified=e["is_verified"])
        for e in (getattr(user, "useremails", None) or ())
    ]

    avatar = None
    # Use eagerloaded attributes from _base_query() if available.
    if hasattr(user, "useravatar"):
        if user.useravatar is not None:
            avatar_dict = user.useravatar[0]
            avatar_type_map = dict(UserAvatar.AVATAR_TYPES)
            avatar = RpcAvatar(
                id=avatar_dict["id"],
                file_id=avatar_dict["file_id"],
                ident=avatar_dict["ident"],
                avatar_type=avatar_type_map.get(avatar_dict["avatar_type"], "letter_avatar"),
            )
    else:
        orm_avatar = user.avatar.first()
        if orm_avatar is not None:
            avatar = RpcAvatar(
                id=orm_avatar.id,
                file_id=orm_avatar.file_id,
                ident=orm_avatar.ident,
                avatar_type=orm_avatar.get_avatar_type_display(),
            )
    args["avatar"] = avatar

    args["authenticators"] = [
        RpcAuthenticator(
            id=a["id"],
            user_id=a["user_id"],
            created_at=a["created_at"],
            last_used_at=a["last_used_at"],
            type=a["type"],
            config=a["config"],
        )
        for a in (getattr(user, "authenticators", None) or ())
    ]

    return RpcUser(**args)


def _flatten(iter: Iterable[Any]) -> List[Any]:
    return (
        ((_flatten(iter[0]) + _flatten(iter[1:])) if len(iter) > 0 else [])
        if type(iter) is list or isinstance(iter, BaseQuerySet)
        else [iter]
    )
