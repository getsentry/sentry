from __future__ import annotations

from typing import TYPE_CHECKING, Any, Iterable, Mapping, MutableMapping

from django.utils import timezone

from sentry import options
from sentry.db.models import Model
from sentry.http import get_server_hostname
from sentry.models import LostPasswordHashType
from sentry.notifications.notifications.base import BaseNotification
from sentry.notifications.utils import send_base_notification
from sentry.types.integrations import ExternalProviders

if TYPE_CHECKING:
    from sentry.models import LostPasswordHash, Team, User


class LostPasswordNotification(BaseNotification):
    category = "lost_password"
    type = "user.password_recovery"

    def __init__(
        self,
        password_hash: LostPasswordHash,
        ip: str,
        mode: LostPasswordHashType = LostPasswordHashType.RECOVER,
    ) -> None:
        super().__init__()
        self.password_hash = password_hash
        self.ip = ip
        self.mode = mode

    @property
    def filename(self) -> str:
        _filename: str = self.mode.value
        return _filename

    def get_context(self) -> MutableMapping[str, Any]:
        return {
            "datetime": timezone.now(),
            "domain": get_server_hostname(),
            "ip_address": self.ip,
            "url": self.password_hash.get_absolute_url(self.mode),
            "user": self.password_hash.user,
        }

    def get_participants(self) -> Mapping[ExternalProviders, Iterable[Team | User]]:
        return {ExternalProviders.EMAIL: {self.password_hash.user}}

    def get_subject(self, context: Mapping[str, Any] | None = None) -> str:
        prefix = options.get("mail.subject-prefix")
        return f"{prefix}Password Recovery"

    def get_reference(self) -> Model | None:
        return None

    def send(self) -> None:
        return send_base_notification(
            notification=self, participants_by_provider=self.get_participants()
        )
