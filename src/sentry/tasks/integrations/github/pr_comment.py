from typing import List, Tuple

from django.db import connection

from sentry.models import GroupOwnerType


def format_comment(issues: List[Tuple[str]]):
    body = "## Suspect Issues\nThis pull request has been deployed and Sentry has observed the following issues:\n\n"

    for issue in issues:
        title = issue[0]
        subtitle = issue[1]
        formatted_subtitle = subtitle[:47] + "..." if len(subtitle) > 50 else subtitle
        url = issue[2]
        body += f"- !! **{title}** `{formatted_subtitle}` [View Issue]({url})\n"

    body += "\n<sub>Did you find this useful? React with a 👍 or 👎</sub>"

    return body


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
