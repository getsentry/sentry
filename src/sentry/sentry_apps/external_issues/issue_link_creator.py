from dataclasses import dataclass
from typing import Any

from django.db import router, transaction

from sentry.models.group import Group
from sentry.sentry_apps.external_issues.external_issue_creator import ExternalIssueCreator
from sentry.sentry_apps.external_requests.issue_link_requester import IssueLinkRequester
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
            external_issue = self._create_external_issue(response=response)
            return external_issue

    def _verify_action(self) -> None:
        if self.action not in VALID_ACTIONS:
            raise SentryAppSentryError(message=f"Invalid action: {self.action}")

    def _make_external_request(self) -> dict[str, Any]:
        response = IssueLinkRequester(
            install=self.install,
            uri=self.uri,
            group=self.group,
            fields=self.fields,
            user=self.user,
            action=self.action,
        ).run()
        return response

    def _create_external_issue(self, response: dict[str, Any]) -> PlatformExternalIssue:
        external_issue = ExternalIssueCreator(
            install=self.install,
            group=self.group,
            web_url=response["webUrl"],
            project=response["project"],
            identifier=response["identifier"],
        ).run()

        return external_issue
