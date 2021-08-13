from typing import Optional
from urllib.parse import urlencode

from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.models import Organization, Project
from sentry.utils.cursors import CursorResult
from sentry.utils.http import absolute_uri

ISSUES_MAXIMUM = 5

# TODO: Enumify the messages
# `class MessagesEnum(Enum)` and `class MessagesEnum(str, Enum)` both fail mypy typing tests

MORE = "MORE"
LESS = "LESS"
ONE = "ONE"
ZERO = "ZERO"


INBOX_MESSAGES = {
    MORE: "There are <{url}|{n} issues for your review>. Here are the first {m} issues:",
    LESS: "There are <{url}|{n} issues for your review>:",
    ONE: "There is <{url}|1 issue for your review>:",
    ZERO: "There are <{url}|no issues for you to review>!",
}


ALL_MESSAGES = {
    MORE: "There are <{url}|{n} issues>. Here are the first {m} issues:",
    LESS: "There are <{url}|{n} issues>:",
    ONE: "There is <{url}|1 issue>:",
    ZERO: "There are <{url}|no issues>!",
}


def get_url(organization: Optional[Organization] = None, project: Optional[Project] = None) -> str:
    if not organization:
        return str(absolute_uri("/"))

    qparams = {
        "sort": "inbox",
        "query": "is:unresolved is:for_review assigned_or_suggested:[me, none]",
    }
    if project:
        qparams["project"] = project.id

    return str(absolute_uri(f"/organizations/{organization.slug}/issues/?{urlencode(qparams)}"))


def get_issues_message(
    issues: CursorResult, is_inbox: bool, project: Optional[Project] = None
) -> str:
    messages_dict = INBOX_MESSAGES if is_inbox else ALL_MESSAGES
    issues_count = len(issues)
    if issues_count == 0:
        if project:
            return messages_dict[ZERO].format(url=get_url(project.organization, project))
        return messages_dict[ZERO].format(url=get_url())

    first_issue = issues[0]
    url = get_url(first_issue.organization, project or first_issue.project)

    if issues_count == 1:
        return messages_dict[ONE].format(url=url)

    if issues_count <= ISSUES_MAXIMUM:
        return messages_dict[LESS].format(n=issues_count, url=url)

    return messages_dict[MORE].format(n=issues_count, m=ISSUES_MAXIMUM, url=url)


class SlackInboxMessageBuilder(SlackMessageBuilder):
    def __init__(
        self,
        issues: CursorResult,
        project: Optional[Project] = None,
        is_inbox: bool = True,
    ) -> None:
        super().__init__()
        self.issues = issues
        self.project = project
        self.is_inbox = is_inbox

    def build_str(self) -> str:
        return get_issues_message(self.issues, is_inbox=self.is_inbox)
