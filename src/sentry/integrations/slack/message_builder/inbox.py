from typing import Optional
from urllib.parse import urlencode

from sentry.integrations.slack.message_builder.base.base import SlackMessageBuilder
from sentry.models import Organization, Project
from sentry.utils.cursors import CursorResult
from sentry.utils.http import absolute_uri

ISSUES_INBOX_MAXIMUM = 5
ISSUES_INBOX_MORE_MESSAGE = (
    "There are <{url}|{n} issues for your review>. Here are the first {m} issues:"
)
ISSUES_INBOX_MESSAGE = "There are <{url}|{n} issues for your review>:"
ISSUES_INBOX_ONE_MESSAGE = "There is <{url}|1 issue for your review>:"
ISSUES_INBOX_ZERO_MESSAGE = "There are <{url}|no issues for you to review>!"


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


def get_issues_message(issues: CursorResult, project: Optional[Project] = None) -> str:
    issues_count = len(issues)
    if issues_count == 0:
        if project:
            return ISSUES_INBOX_ZERO_MESSAGE.format(url=get_url(project.organization, project))
        return ISSUES_INBOX_ZERO_MESSAGE.format(url=get_url())

    first_issue = issues[0]
    url = get_url(first_issue.organization, project or first_issue.project)

    if issues_count == 1:
        return ISSUES_INBOX_ONE_MESSAGE.format(url=url)

    if issues_count <= ISSUES_INBOX_MAXIMUM:
        return ISSUES_INBOX_MESSAGE.format(n=issues_count, url=url)

    return ISSUES_INBOX_MORE_MESSAGE.format(n=issues_count, m=ISSUES_INBOX_MAXIMUM, url=url)


class SlackInboxMessageBuilder(SlackMessageBuilder):
    def __init__(self, issues: CursorResult, project: Optional[Project] = None) -> None:
        super().__init__()
        self.issues = issues
        self.project = project

    def build_str(self) -> str:
        return get_issues_message(self.issues)
