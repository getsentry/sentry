# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

import datetime
from enum import IntEnum
from typing import Any, TypedDict

from pydantic.fields import Field

from sentry.hybridcloud.rpc import DEFAULT_DATE, RpcModel


class RpcAvatar(RpcModel):
    id: int = 0
    file_id: int | None = None
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
    last_used_at: datetime.datetime | None = None
    type: int = -1
    config: Any = None


class RpcUserProfile(RpcModel):
    """Minimal set of user attributes that can be fetched efficiently."""

    id: int = -1
    pk: int = -1
    name: str = ""
    email: str = ""
    username: str = ""
    actor_id: int | None = None
    display_name: str = ""
    label: str = ""
    is_superuser: bool = False
    is_authenticated: bool = False
    is_anonymous: bool = False
    is_active: bool = False
    is_staff: bool = False
    is_unclaimed: bool = False
    last_active: datetime.datetime | None = None
    is_sentry_app: bool = False
    password_usable: bool = False
    is_password_expired: bool = False
    session_nonce: str | None = None


class RpcUser(RpcUserProfile):
    roles: frozenset[str] = frozenset()
    permissions: frozenset[str] = frozenset()
    avatar: RpcAvatar | None = None
    emails: frozenset[str] = frozenset()
    useremails: list[RpcUserEmail] = Field(default_factory=list)
    authenticators: list[RpcAuthenticator] = Field(default_factory=list)

    def __hash__(self) -> int:
        # Mimic the behavior of hashing a Django ORM entity, for compatibility with
        # legacy code that treats User entities as dict keys.
        # TODO: Remove the need for this
        return hash((self.id, self.pk))

    def __str__(self) -> str:  # API compatibility with ORM User
        return self.get_username()

    def by_email(self, email: str) -> "RpcUser":
        if email == self.email:
            return self
        return self.copy(update=dict(email=email))

    def has_unverified_emails(self) -> bool:
        return len(self.get_unverified_emails()) > 0

    def has_verified_emails(self) -> bool:
        return len(self.get_verified_emails()) > 0

    def has_verified_primary_email(self) -> bool:
        return bool([e for e in self.useremails if e.is_verified and e.email == self.email])

    def get_unverified_emails(self) -> list[RpcUserEmail]:
        return [e for e in self.useremails if not e.is_verified]

    def get_verified_emails(self) -> list[RpcUserEmail]:
        return [e for e in self.useremails if e.is_verified]

    def has_usable_password(self) -> bool:
        return self.password_usable

    def get_username(self) -> str:  # API compatibility with ORM User
        return self.username

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
        return any(a.type != 0 for a in self.authenticators)


class UserCreateResult(RpcModel):
    user: RpcUser
    created: bool


class UserSerializeType(IntEnum):  # annoying
    SIMPLE = 0
    DETAILED = 1
    SELF_DETAILED = 2


class UserFilterArgs(TypedDict, total=False):
    user_ids: list[int]
    """List of user ids to search with"""

    is_active: bool
    """Whether the user needs to be active"""

    organization_id: int
    """Organization to check membership in"""

    emails: list[str]
    """list of emails to match with"""

    email_verified: bool
    """Whether emails have to be verified or not"""

    query: str
    """Filter by email or name"""

    authenticator_types: list[int] | None
    """The type of MFA authenticator you want to query by"""


class UserUpdateArgs(TypedDict, total=False):
    avatar_url: str
    avatar_type: int
    actor_id: int  # TODO(hybrid-cloud): Remove this after the actor migration is complete
    is_active: bool


class UserIdEmailArgs(TypedDict):
    user_id: int
    email: str


class RpcVerifyUserEmail(RpcModel):
    exists: bool = False
    email: str = ""
