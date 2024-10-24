from dataclasses import dataclass
from html import escape

from django.db import router, transaction

from sentry.models.group import Group
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.services.app import RpcSentryAppInstallation


@dataclass
class ExternalIssueCreator:
    install: RpcSentryAppInstallation
    group: Group
    web_url: str
    project: str
    identifier: str

    def run(self) -> PlatformExternalIssue:
        with transaction.atomic(using=router.db_for_write(PlatformExternalIssue)):
            display_name = f"{escape(self.project)}#{escape(self.identifier)}"
            self.external_issue = PlatformExternalIssue.objects.create(
                group_id=self.group.id,
                project_id=self.group.project_id,
                service_type=self.install.sentry_app.slug,
                display_name=display_name,
                web_url=self.web_url,
            )
            return self.external_issue
