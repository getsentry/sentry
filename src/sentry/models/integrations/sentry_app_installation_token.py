from __future__ import annotations

from typing import TYPE_CHECKING, ClassVar, List

from django.db.models import QuerySet

from sentry.backup.scopes import RelocationScope
from sentry.db.models import BaseManager, FlexibleForeignKey, control_silo_only_model
from sentry.db.models.outboxes import ControlOutboxProducingModel
from sentry.models.apitoken import ApiToken
from sentry.models.outbox import ControlOutboxBase

if TYPE_CHECKING:
    from sentry.services.hybrid_cloud.auth import AuthenticatedToken


class SentryAppInstallationTokenManager(BaseManager["SentryAppInstallationToken"]):
    def get_token(self, organization_id: int, provider: str) -> str | None:
        """Find a token associated with the installation so we can use it for authentication."""
        sentry_app_installation_tokens = self.select_related("api_token").filter(
            sentry_app_installation__sentryappinstallationforprovider__organization_id=organization_id,
            sentry_app_installation__sentryappinstallationforprovider__provider=provider,
        )
        if not sentry_app_installation_tokens:
            return None

        return sentry_app_installation_tokens[0].api_token.token

    def _get_token(self, token: ApiToken | AuthenticatedToken) -> SentryAppInstallationToken | None:
        if isinstance(token, ApiToken):
            id = token.id
        elif token.kind == "api_token" and token.entity_id is not None:
            id = token.entity_id
        else:
            return None

        try:
            return self.select_related("sentry_app_installation").get(api_token_id=id)
        except SentryAppInstallationToken.DoesNotExist:
            pass
        return None

    def get_projects(self, token: ApiToken) -> QuerySet:
        from sentry.models.project import Project

        install_token = self._get_token(token)
        if not install_token:
            return Project.objects.none()

        return Project.objects.filter(
            organization_id=install_token.sentry_app_installation.organization_id
        )

    def has_organization_access(
        self, token: ApiToken | AuthenticatedToken, organization_id: int
    ) -> bool:
        install_token = self._get_token(token)
        if not install_token:
            return False

        return install_token.sentry_app_installation.organization_id == organization_id


@control_silo_only_model
class SentryAppInstallationToken(ControlOutboxProducingModel):
    __relocation_scope__ = RelocationScope.Excluded

    api_token = FlexibleForeignKey("sentry.ApiToken")
    sentry_app_installation = FlexibleForeignKey("sentry.SentryAppInstallation")

    objects: ClassVar[SentryAppInstallationTokenManager] = SentryAppInstallationTokenManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappinstallationtoken"
        unique_together = (("sentry_app_installation", "api_token"),)

    def outboxes_for_update(self, shard_identifier: int | None = None) -> List[ControlOutboxBase]:
        try:
            return self.api_token.outboxes_for_update()
        except ApiToken.DoesNotExist:
            return []
