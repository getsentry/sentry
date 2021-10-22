from typing import TYPE_CHECKING, Optional

from django.db.models import QuerySet
from sentry.db.models import BaseManager, FlexibleForeignKey, Model

if TYPE_CHECKING:
    from sentry.models import Organization


class SentryAppInstallationTokenManager(BaseManager):
    def _get_token(self, token: str) -> Optional["SentryAppInstallationToken"]:
        try:
            return self.select_related("sentry_app_installation").get(
                api_token=token
            )
        except SentryAppInstallationToken.DoesNotExist:
            pass
        return None

    def get_projects(self, token: str) -> QuerySet:
        from sentry.models import Project

        install_token = self._get_token(token)
        if not install_token:
            return Project.objects.none()

        return Project.objects.filter(
            organization_id=install_token.sentry_app_installation.organization_id
        )

    def has_organization_access(self, token: str, organization: "Organization") -> bool:
        install_token = self._get_token(token)
        if not install_token:
            return False

        return install_token.sentry_app_installation.organization_id == organization.id


class SentryAppInstallationToken(Model):
    __include_in_export__ = False

    api_token = FlexibleForeignKey("sentry.ApiToken")
    sentry_app_installation = FlexibleForeignKey("sentry.SentryAppInstallation")

    objects = SentryAppInstallationTokenManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappinstallationtoken"
        unique_together = (("sentry_app_installation", "api_token"),)
