# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import datetime
from enum import IntEnum
from typing import Any, FrozenSet, List, Optional

from pydantic.fields import Field
from typing_extensions import TypedDict

from sentry.services.hybrid_cloud import DEFAULT_DATE, RpcModel


class RpcAvatar(RpcModel):
    id: int = 0
    file_id: Optional[int] = None
    ident: str = ""
    avatar_type: str = "letter_avatar"


class RpcUserEmail(RpcModel):
    id: int = 0
    email: str = ""
    is_verified: bool = False


class RpcAuthenticator(RpcModel):
    id: int = 0
    user_id: int = -1
    created_at: datetime.datetime = DEFAULT_DATE
    last_used_at: Optional[datetime.datetime] = None
    type: int = -1
    config: Any = None


class RpcUser(RpcModel):
    id: int = -1
    pk: int = -1
    name: str = ""
    email: str = ""
    emails: FrozenSet[str] = frozenset()
    username: str = ""
    actor_id: Optional[int] = None
    display_name: str = ""
    label: str = ""
    is_superuser: bool = False
    is_authenticated: bool = False
    is_anonymous: bool = False
    is_active: bool = False
    is_staff: bool = False
    last_active: Optional[datetime.datetime] = None
    is_sentry_app: bool = False
    password_usable: bool = False
    is_password_expired: bool = False
    session_nonce: Optional[str] = None

    roles: FrozenSet[str] = frozenset()
    permissions: FrozenSet[str] = frozenset()
    avatar: Optional[RpcAvatar] = None
    useremails: List[RpcUserEmail] = Field(default_factory=list)
    authenticators: List[RpcAuthenticator] = Field(default_factory=list)

    def __hash__(self) -> int:
        # Mimic the behavior of hashing a Django ORM entity, for compatibility with
        # legacy code that treats User entities as dict keys.
        # TODO: Remove the need for this
        return hash((self.id, self.pk))

    def has_unverified_emails(self) -> bool:
        return len(self.get_unverified_emails()) > 0

    def has_verified_emails(self) -> bool:
        return len(self.get_verified_emails()) > 0

    def get_unverified_emails(self) -> List[RpcUserEmail]:
        return [e for e in self.useremails if not e.is_verified]

    def get_verified_emails(self) -> List[RpcUserEmail]:
        return [e for e in self.useremails if e.is_verified]

    def has_usable_password(self) -> bool:
        return self.password_usable

    def get_display_name(self) -> str:  # API compatibility with ORM User
        return self.display_name

    def get_label(self) -> str:  # API compatibility with ORM User
        return self.label

    def get_full_name(self) -> str:
        return self.name

    def get_salutation_name(self) -> str:
        name = self.name or self.username.split("@", 1)[0].split(".", 1)[0]
        first_name = name.split(" ", 1)[0]
        return first_name.capitalize()

    def get_avatar_type(self) -> str:
        if self.avatar is not None:
            return self.avatar.avatar_type
        return "letter_avatar"

    def class_name(self) -> str:
        return "User"

    def has_2fa(self) -> bool:
        return len(self.authenticators) > 0


class UserSerializeType(IntEnum):  # annoying
    SIMPLE = 0
    DETAILED = 1
    SELF_DETAILED = 2


class UserFilterArgs(TypedDict, total=False):
    user_ids: List[int]
    is_active: bool
    organization_id: int
    project_ids: List[int]
    team_ids: List[int]
    is_active_memberteam: bool
    emails: List[str]


class UserUpdateArgs(TypedDict, total=False):
    avatar_url: str
    avatar_type: int
    actor_id: int  # TODO(hybrid-cloud): Remove this after the actor migration is complete
