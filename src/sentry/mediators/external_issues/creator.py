from html import escape

from django.db import router

from sentry.mediators.mediator import Mediator
from sentry.mediators.param import Param
from sentry.models.group import Group
from sentry.models.platformexternalissue import PlatformExternalIssue
from sentry.services.hybrid_cloud.app import RpcSentryAppInstallation


class Creator(Mediator):
    install = Param(RpcSentryAppInstallation)
    group = Param(Group)
    web_url = Param(str)
    project = Param(str)
    identifier = Param(str)
    using = router.db_for_write(PlatformExternalIssue)

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
