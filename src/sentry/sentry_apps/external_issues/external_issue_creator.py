import logging
from dataclasses import dataclass
from html import escape

from django.db import router, transaction

from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.sentry_apps.utils.errors import SentryAppSentryError
from sentry.types.activity import ActivityType

logger = logging.getLogger("sentry.sentry_apps.external_issues")


@dataclass
class ExternalIssueCreator:
    install: RpcSentryAppInstallation
    group: Group
    web_url: str
    project: str
    identifier: str
    user_id: int | None = None

    def run(self) -> tuple[PlatformExternalIssue, bool]:
        try:
            with transaction.atomic(using=router.db_for_write(PlatformExternalIssue)):
                display_name = f"{escape(self.project)}#{escape(self.identifier)}"
                external_issue, created = PlatformExternalIssue.objects.update_or_create(
                    defaults={
                        "project_id": self.group.project_id,
                        "display_name": display_name,
                        "web_url": self.web_url,
                    },
                    group_id=self.group.id,
                    service_type=self.install.sentry_app.slug,
                )

                return external_issue, created
        except Exception as e:
            logger.info(
                "platform-external-issue.create-failed",
                exc_info=e,
                extra={
                    "installation_id": self.install.uuid,
                    "group_id": self.group.id,
                    "sentry_app_slug": self.install.sentry_app.slug,
                },
            )
            raise SentryAppSentryError(
                message="Failed to create external issue obj",
            ) from e

    def create_issue_activity(
        self, external_issue: PlatformExternalIssue, *, new: bool = True
    ) -> None:
        Activity.objects.create_group_activity(
            group=self.group,
            type=ActivityType.CREATE_ISSUE,
            user_id=self.user_id,
            data={
                "title": external_issue.display_name,
                "provider": self.install.sentry_app.name,
                "location": external_issue.web_url,
                "label": external_issue.display_name,
                "new": new,
            },
        )
