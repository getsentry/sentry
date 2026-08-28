# Please do not use
#     from __future__ import annotations
# in modules such as this one where hybrid cloud data models or service classes are
# defined, because we want to reflect on type annotations and avoid forward references.

from datetime import datetime

from django.utils import timezone
from pydantic import Field

from sentry.hybridcloud.rpc import RpcModel


class RpcServiceAccount(RpcModel):
    id: int = -1
    organization_id: int = -1
    name: str = ""
    is_active: bool = False
    date_added: datetime = Field(default_factory=timezone.now)
    date_updated: datetime = Field(default_factory=timezone.now)

    def __str__(self) -> str:
        return self.get_username()

    @property
    def is_authenticated(self) -> bool:
        return self.is_active

    @property
    def is_anonymous(self) -> bool:
        return False

    @property
    def is_staff(self) -> bool:
        return False

    @property
    def is_superuser(self) -> bool:
        return False

    @property
    def is_sentry_app(self) -> bool:
        return False

    @property
    def is_suspended(self) -> bool:
        return False

    @property
    def is_interactive(self) -> bool:
        return False

    @property
    def email(self) -> str:
        return ""

    def has_2fa(self) -> bool:
        return False

    def has_usable_password(self) -> bool:
        return False

    def has_verified_primary_email(self) -> bool:
        return False

    def get_avatar_type(self) -> str:
        return "letter_avatar"

    def get_audit_log_data(self) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "organization_id": self.organization_id,
            "actor_type": "service_account",
        }

    @property
    def permissions(self) -> frozenset[str]:
        return frozenset()

    @property
    def roles(self) -> frozenset[str]:
        return frozenset()

    def get_display_name(self) -> str:
        return self.name

    def get_label(self) -> str:
        return self.name

    def get_username(self) -> str:
        return self.name

    def get_full_name(self) -> str:
        return self.name

    def class_name(self) -> str:
        return "ServiceAccount"


class RpcServiceAccountToken(RpcModel):
    id: int = -1
    name: str | None = None
    scopes: list[str] = Field(default_factory=list)
    expires_at: datetime | None = None
    token_last_characters: str | None = None


class RpcServiceAccountDetail(RpcModel):
    account: RpcServiceAccount
    tokens: list[RpcServiceAccountToken] = Field(default_factory=list)


class RpcServiceAccountCreation(RpcModel):
    account: RpcServiceAccount
    token: str = Field(repr=False)
    token_metadata: RpcServiceAccountToken


class RpcServiceAccountTokenCreation(RpcModel):
    token: str = Field(repr=False)
    token_metadata: RpcServiceAccountToken
