import logging
from dataclasses import dataclass
from html import escape

from django.db import router, transaction

from sentry.models.group import Group
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.sentry_apps.utils.errors import SentryAppSentryError

logger = logging.getLogger("sentry.sentry_apps.external_issues")


@dataclass
class ExternalIssueCreator:
    install: RpcSentryAppInstallation
    group: Group
    web_url: str
    project: str
    identifier: str

    def run(self) -> PlatformExternalIssue:
        try:
            with transaction.atomic(using=router.db_for_write(PlatformExternalIssue)):
                display_name = f"{escape(self.project)}#{escape(self.identifier)}"
                self.external_issue = PlatformExternalIssue.objects.update_or_create(
                    defaults={
                        "project_id": self.group.project_id,
                        "display_name": display_name,
                        "web_url": self.web_url,
                    },
                    group_id=self.group.id,
                    service_type=self.install.sentry_app.slug,
                )

                # Return only the external issue, of the tuple (external_issue, created) from update_or_create
                return self.external_issue[0]
        except Exception as e:
            logger.info(
                "create-failed",
                extra={
                    "error": str(e),
                    "installtion_id": self.install.uuid,
                    "group_id": self.group.id,
                    "sentry_app_slug": self.install.sentry_app.slug,
                },
            )
            raise SentryAppSentryError(e) from e
