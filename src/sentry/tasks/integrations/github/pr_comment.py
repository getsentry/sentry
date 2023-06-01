from dataclasses import dataclass
from typing import List

from django.db import connection

from sentry.models import GroupOwnerType


@dataclass
class PullRequestIssue:
    title: str
    subtitle: str
    url: str


body = """## Suspect Issues
This pull request has been deployed and Sentry has observed the following issues:

{issue_list}

<sub>Did you find this useful? React with a \U0001F44D or \U0001F44E</sub>"""

single_issue_template = "- ‼️ **{title}** `{subtitle}` [View Issue]({url})"


def format_comment(issues: List[PullRequestIssue]):
    def format_subtitle(subtitle):
        return subtitle[:47] + "..." if len(subtitle) > 50 else subtitle

    issue_list = "\n".join(
        [
            single_issue_template.format(
                title=issue.title, subtitle=format_subtitle(issue.subtitle), url=issue.url
            )
            for issue in issues
        ]
    )

    return body.format(issue_list=issue_list)


def pr_to_issue_query():

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT pr.repository_id repo_id,
                   pr.key pr_key,
                   pr.organization_id org_id,
                   array_agg(go.id) issues
            FROM sentry_groupowner go
            JOIN sentry_commit c ON c.id = (go.context::jsonb->>'commitId')::int
            JOIN sentry_pull_request pr ON c.key = pr.merge_commit_sha
            JOIN sentry_repository repo on pr.repository_id = repo.id
            WHERE go.type=%s
              AND pr.date_added > now() - interval '30 days'
              AND repo.provider = 'integrations:github'
            GROUP BY repo_id,
                     pr_key,
                     org_id
            """,
            [GroupOwnerType.SUSPECT_COMMIT.value],
        )
        return cursor.fetchall()
