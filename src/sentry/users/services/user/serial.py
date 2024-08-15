from __future__ import annotations

from collections.abc import Iterable
from typing import Any

from django.utils.functional import LazyObject

from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.users.models.user import User
from sentry.users.models.user_avatar import UserAvatar
from sentry.users.services.user import (
    RpcAuthenticator,
    RpcAvatar,
    RpcUser,
    RpcUserEmail,
    RpcUserProfile,
)


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


def _serialize_from_user_fields(user: User) -> dict[str, Any]:
    args = {
        field_name: getattr(user, field_name)
        for field_name in RpcUserProfile.__fields__
        if hasattr(user, field_name)
    }
    args["pk"] = user.pk
    args["display_name"] = user.get_display_name()
    args["label"] = user.get_label()
    args["is_superuser"] = user.is_superuser
    args["is_unclaimed"] = user.is_unclaimed
    args["is_sentry_app"] = bool(user.is_sentry_app)
    args["password_usable"] = user.has_usable_password()
    args["session_nonce"] = user.session_nonce

    if args["name"] is None:
        # This field is non-nullable according to the Django schema, but may be null
        # on some servers due to migration history
        args["name"] = ""

    return args


def serialize_rpc_user_profile(user: User) -> RpcUserProfile:
    return RpcUserProfile(**_serialize_from_user_fields(user))


def serialize_rpc_user(user: User) -> RpcUser:
    args = _serialize_from_user_fields(user)

    # Prefer eagerloaded attributes from _base_query
    if hasattr(user, "useremails") and user.useremails is not None:
        args["emails"] = frozenset([e["email"] for e in user.useremails if e["is_verified"]])
    else:
        args["emails"] = frozenset([email.email for email in user.get_verified_emails()])

    # And process the _base_query special data additions
    args["permissions"] = frozenset(getattr(user, "permissions", None) or ())

    roles: frozenset[str] = frozenset()
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
                file_id=avatar_dict["control_file_id"],
                ident=avatar_dict["ident"],
                avatar_type=avatar_type_map.get(avatar_dict["avatar_type"], "letter_avatar"),
            )
    else:
        orm_avatar = user.avatar.first()
        if orm_avatar is not None:
            avatar = serialize_user_avatar(avatar=orm_avatar)
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


def serialize_user_avatar(avatar: UserAvatar) -> RpcAvatar:
    return RpcAvatar(
        id=avatar.id,
        file_id=avatar.control_file_id,
        ident=avatar.ident,
        avatar_type=avatar.get_avatar_type_display(),
    )


def _flatten(iter: Iterable[Any]) -> list[Any]:
    return (
        ((_flatten(iter[0]) + _flatten(iter[1:])) if len(iter) > 0 else [])
        if type(iter) is list or isinstance(iter, BaseQuerySet)
        else [iter]
    )
