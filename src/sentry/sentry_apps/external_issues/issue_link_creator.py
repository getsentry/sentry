from dataclasses import dataclass
from typing import Any

from django.db import router, transaction

from sentry.models.group import Group
from sentry.sentry_apps.external_issues.external_issue_creator import ExternalIssueCreator
from sentry.sentry_apps.external_requests.issue_link_requester import (
    IssueLinkRequester,
    IssueRequestActionType,
)
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.sentry_apps.utils.errors import SentryAppSentryError
from sentry.users.services.user import RpcUser

VALID_ACTIONS = ["link", "create"]


@dataclass
class IssueLinkCreator:
    install: RpcSentryAppInstallation
    group: Group
    action: str
    fields: dict[str, Any]
    uri: str
    user: RpcUser

    def run(self) -> PlatformExternalIssue:
        with transaction.atomic(using=router.db_for_write(PlatformExternalIssue)):
            self._verify_action()
            response = self._make_external_request()
            external_issue, created, external_issue_creator = self._create_external_issue(
                response=response
            )

        if created:
            external_issue_creator.create_issue_activity(
                external_issue, new=self.action == IssueRequestActionType.CREATE
            )

        return external_issue

    def _verify_action(self) -> None:
        try:
            self.action = IssueRequestActionType(self.action)
        except ValueError as e:
            raise SentryAppSentryError(
                message=f"Invalid action: {self.action}", status_code=500
            ) from e

    def _make_external_request(self) -> dict[str, Any]:
        response = IssueLinkRequester(
            install=self.install,
            uri=self.uri,
            group=self.group,
            fields=self.fields,
            user=self.user,
            action=IssueRequestActionType(self.action),
        ).run()
        return response

    def _create_external_issue(
        self, response: dict[str, Any]
    ) -> tuple[PlatformExternalIssue, bool, ExternalIssueCreator]:
        external_issue_creator = ExternalIssueCreator(
            install=self.install,
            group=self.group,
            web_url=response["webUrl"],
            project=response["project"],
            identifier=response["identifier"],
            user_id=self.user.id,
        )
        external_issue, created = external_issue_creator.run()

        return external_issue, created, external_issue_creator
