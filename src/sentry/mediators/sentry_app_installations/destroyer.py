from requests.exceptions import RequestException

from sentry import analytics
from sentry.mediators import Mediator, Param, sentry_app_installation_tokens, service_hooks
from sentry.mediators.sentry_app_installations.installation_notifier import InstallationNotifier
from sentry.models import (
    ApiToken,
    AuditLogEntryEvent,
    SentryAppInstallationForProvider,
    SentryAppInstallationToken,
    ServiceHook,
)
from sentry.utils.audit import create_audit_entry


class Destroyer(Mediator):
    install = Param("sentry.models.SentryAppInstallation")
    user = Param("sentry.models.User")
    request = Param("rest_framework.request.Request", required=False)
    notify = Param(bool, default=True)

    @property
    def _logging_context(self):
        return {"install_id": self.install.id, "install_uuid": self.install.uuid}

    def call(self):
        self._destroy_grant()
        self._destroy_service_hooks()
        self._destroy_api_tokens()
        self._destroy_installation_for_provider()
        self._destroy_installation()
        return self.install

    def _destroy_grant(self):
        if self.install.api_grant_id:
            self.install.api_grant.delete()

    def _destroy_service_hooks(self):
        hooks = ServiceHook.objects.filter(
            application_id=self.install.sentry_app.application_id, actor_id=self.install.id
        )
        for hook in hooks:
            service_hooks.Destroyer.run(service_hook=hook)

    def _destroy_api_tokens(self):
        tokens = ApiToken.objects.filter(
            id__in=SentryAppInstallationToken.objects.filter(
                sentry_app_installation_id=self.install.id
            ).values_list("api_token_id", flat=True)
        )

        for token in tokens:
            sentry_app_installation_tokens.Destroyer.run(
                api_token=token, user=self.user, request=self.request
            )

    def _destroy_installation_for_provider(self):
        SentryAppInstallationForProvider.objects.filter(
            sentry_app_installation=self.install
        ).delete()

    def _destroy_installation(self):
        if self.notify:
            try:
                InstallationNotifier.run(install=self.install, user=self.user, action="deleted")
            # if the error is from a request exception, log the error and continue
            except RequestException as exc:
                self.log(error=exc)
        self.install.delete()

    def audit(self):
        if self.request:
            create_audit_entry(
                request=self.request,
                organization=self.install.organization,
                target_object=self.install.organization.id,
                event=AuditLogEntryEvent.SENTRY_APP_UNINSTALL,
                data={"sentry_app": self.install.sentry_app.name},
            )

    def record_analytics(self):
        analytics.record(
            "sentry_app.uninstalled",
            user_id=self.user.id,
            organization_id=self.install.organization_id,
            sentry_app=self.install.sentry_app.slug,
        )
