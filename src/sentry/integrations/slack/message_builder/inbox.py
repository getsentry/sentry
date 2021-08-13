from enum import Enum
from typing import Optional
from urllib.parse import urlencode

from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.models import Organization, Project
from sentry.utils.cursors import CursorResult
from sentry.utils.http import absolute_uri

ISSUES_MAXIMUM = 5


class InboxMessages(str, Enum):
    MORE = "There are <{url}|{n} issues for your review>. Here are the first {m} issues:"
    LESS = "There are <{url}|{n} issues for your review>:"
    ONE = "There is <{url}|1 issue for your review>:"
    ZERO = "There are <{url}|no issues for you to review>!"


class AllMessages(str, Enum):
    MORE = "There are <{url}|{n} issues>. Here are the first {m} issues:"
    LESS = "There are <{url}|{n} issues>:"
    ONE = "There is <{url}|1 issue>:"
    ZERO = "There are <{url}|no issues>!"


def get_url(organization: Optional[Organization] = None, project: Optional[Project] = None) -> str:
    if not organization:
        return absolute_uri("/")

    qparams = {
        "sort": "inbox",
        "query": "is:unresolved is:for_review assigned_or_suggested:[me, none]",
    }
    if project:
        qparams["project"] = project.id

    return absolute_uri(f"/organizations/{organization.slug}/issues/?{urlencode(qparams)}")


def get_issues_message(
    issues: CursorResult, is_inbox: bool, project: Optional[Project] = None
) -> str:
    messagesEnum = InboxMessages if is_inbox else AllMessages
    issues_count = len(issues)
    if issues_count == 0:
        if project:
            return messagesEnum.ZERO.format(url=get_url(project.organization, project))
        return messagesEnum.ZERO.format(url=get_url())

    first_issue = issues[0]
    url = get_url(first_issue.organization, project or first_issue.project)

    if issues_count == 1:
        return messagesEnum.ONE.format(url=url)

    if issues_count <= ISSUES_MAXIMUM:
        return messagesEnum.LESS.format(n=issues_count, url=url)

    return messagesEnum.MORE.format(n=issues_count, m=ISSUES_MAXIMUM, url=url)


class SlackInboxMessageBuilder(SlackMessageBuilder):
    def __init__(
        self,
        issues: CursorResult,
        project: Optional[Project] = None,
        is_inbox: Optional[bool] = True,
    ) -> None:
        super().__init__()
        self.issues = issues
        self.project = project
        self.is_inbox = is_inbox

    def build_str(self) -> str:
        return get_issues_message(self.issues, is_inbox=self.is_inbox)
