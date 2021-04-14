from sentry.mediators import Mediator, Param
from sentry.models import PlatformExternalIssue
from sentry.utils.html import escape


class Creator(Mediator):
    install = Param("sentry.models.SentryAppInstallation")
    group = Param("sentry.models.Group")
    web_url = Param((str,))
    project = Param((str,))
    identifier = Param((str,))

    def call(self):
        self._create_external_issue()
        return self.external_issue

    def _create_external_issue(self):
        display_name = f"{escape(self.project)}#{escape(self.identifier)}"
        self.external_issue = PlatformExternalIssue.objects.create(
            group_id=self.group.id,
            project_id=self.group.project_id,
            service_type=self.install.sentry_app.slug,
            display_name=display_name,
            web_url=self.web_url,
        )
