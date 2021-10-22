from sentry.db.models import FlexibleForeignKey, Model
from sentry.models import Project


class SentryAppInstallationToken(Model):
    __include_in_export__ = False

    api_token = FlexibleForeignKey("sentry.ApiToken")
    sentry_app_installation = FlexibleForeignKey("sentry.SentryAppInstallation")

    class Meta:
        app_label = "sentry"
        db_table = "sentry_sentryappinstallationtoken"
        unique_together = (("sentry_app_installation", "api_token"),)

    @classmethod
    def has_organization_access(cls, token, organization):
        try:
            install_token = cls.objects.select_related("sentry_app_installation").get(
                api_token=token
            )
        except cls.DoesNotExist:
            return False

        return install_token.sentry_app_installation.organization_id == organization.id

    @classmethod
    def get_projects(cls, token):
        try:
            install_token = cls.objects.select_related("sentry_app_installation").get(
                api_token=token
            )
        except cls.DoesNotExist:
            return Project.objects.none()

        return Project.objects.filter(
            organization_id=install_token.sentry_app_installation.organization_id
        )
