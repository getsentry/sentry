from contextlib import AbstractContextManager, nullcontext
from dataclasses import dataclass, field
from typing import Any

from sentry.locks import locks
from sentry.models.group import Group
from sentry.sentry_apps.external_issues.external_issue_creator import ExternalIssueCreator
from sentry.sentry_apps.external_requests.issue_link_requester import (
    IssueLinkRequester,
    IssueRequestActionType,
)
from sentry.sentry_apps.models.platformexternalissue import PlatformExternalIssue
from sentry.sentry_apps.services.app import RpcSentryAppInstallation
from sentry.sentry_apps.utils.errors import SentryAppError, SentryAppSentryError
from sentry.users.services.user import RpcUser
from sentry.utils.locking import UnableToAcquireLock

VALID_ACTIONS = ["link", "create"]


@dataclass
class IssueLinkCreator:
    install: RpcSentryAppInstallation
    group: Group
    action: str
    fields: dict[str, Any]
    uri: str
    user: RpcUser
    expected_external_issue_url: str | None = None
    changed: bool = field(init=False, default=False)

    def run(self) -> PlatformExternalIssue:
        self._verify_action()
        lock: AbstractContextManager[None] = nullcontext()
        if self.expected_external_issue_url is not None:
            if self.action != IssueRequestActionType.LINK:
                raise SentryAppError(
                    message="expectedExternalIssueUrl is only supported for linking an issue.",
                    status_code=400,
                )
            try:
                lock = locks.get(
                    f"platform-external-issue-link:{self.group.id}:{self.install.sentry_app.slug}",
                    duration=300,
                    name="platform_external_issue_link",
                ).acquire()
            except UnableToAcquireLock as e:
                raise SentryAppError(
                    message="This issue link is being updated. Try again.", status_code=409
                ) from e

        with lock:
            if self.expected_external_issue_url is not None:
                existing = PlatformExternalIssue.objects.filter(
                    group_id=self.group.id, service_type=self.install.sentry_app.slug
                ).first()
                if existing is not None:
                    self._verify_expected_url(existing.web_url)
                    return existing

            response = self._make_external_request()
            self._verify_expected_url(response["webUrl"])
            external_issue, created, external_issue_creator = self._create_external_issue(
                response=response
            )
            # Legacy writers can race the callback; never replace their association
            # when the caller supplied an expected target.
            self._verify_expected_url(external_issue.web_url)
            self.changed = created or self.expected_external_issue_url is None

        if created:
            external_issue_creator.create_issue_activity(
                external_issue, new=self.action == IssueRequestActionType.CREATE
            )

        return external_issue

    def _verify_expected_url(self, web_url: str) -> None:
        if (
            self.expected_external_issue_url is not None
            and web_url != self.expected_external_issue_url
        ):
            raise SentryAppError(
                message="A different external issue would be linked. Unlink the existing issue first.",
                status_code=409,
            )

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
            replace=self.expected_external_issue_url is None,
        )
        external_issue, created = external_issue_creator.run()

        return external_issue, created, external_issue_creator
