from collections.abc import Iterable

from sentry.mediators import Mediator, Param
from sentry.mediators.sentry_app_installation_tokens import (
    Creator as SentryAppInstallationTokenCreator,
)
from sentry.models import AuditLogEntryEvent

from ..sentry_app_installations import Creator as InstallationCreator
from .creator import Creator as SentryAppCreator


class InternalCreator(Mediator):
    name = Param((str,))
    organization = Param("sentry.models.Organization")
    scopes = Param(Iterable, default=lambda self: [])
    events = Param(Iterable, default=lambda self: [])
    webhook_url = Param((str,), required=False)
    redirect_url = Param((str,), required=False)
    is_alertable = Param(bool, default=False)
    schema = Param(dict, default=lambda self: {})
    overview = Param((str,), required=False)
    author = Param((str,), required=False)
    allowed_origins = Param(Iterable, default=lambda self: [])
    request = Param("rest_framework.request.Request", required=False)
    user = Param("sentry.models.User")

    def call(self):
        self.kwargs["author"] = self.kwargs.get("author") or self.organization.name
        self.kwargs["is_internal"] = True
        self.sentry_app = SentryAppCreator.run(**self.kwargs)
        self.sentry_app.verify_install = False
        self.sentry_app.save()

        self._install()
        self._create_access_token()

        return self.sentry_app

    def _create_access_token(self):
        data = {"sentry_app_installation": self.install, "user": self.user}

        self.install.api_token = SentryAppInstallationTokenCreator.run(request=self.request, **data)
        self.install.save()

    def _install(self):
        self.install = InstallationCreator.run(
            organization=self.organization,
            slug=self.sentry_app.slug,
            user=self.user,
            request=self.request,
            notify=False,
        )

    def audit(self):
        from sentry.utils.audit import create_audit_entry

        if self.request:
            create_audit_entry(
                request=self.request,
                organization=self.organization,
                target_object=self.organization.id,
                event=AuditLogEntryEvent.INTERNAL_INTEGRATION_ADD,
                data={"name": self.sentry_app.name},
            )

    def record_analytics(self):
        from sentry import analytics

        analytics.record(
            "internal_integration.created",
            user_id=self.user.id,
            organization_id=self.organization.id,
            sentry_app=self.sentry_app.slug,
        )
