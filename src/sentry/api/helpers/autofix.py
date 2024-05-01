import enum

import requests
from django.conf import settings

from sentry.api.helpers.repos import get_repos_from_project_code_mappings
from sentry.utils import json


class AutofixCodebaseIndexingStatus(str, enum.Enum):
    UP_TO_DATE = "up_to_date"
    INDEXING = "indexing"
    NOT_INDEXED = "not_indexed"


def get_project_codebase_indexing_status(project):
    repos = get_repos_from_project_code_mappings(project)

    if not repos:
        return None

    statuses = []
    for repo in repos:
        response = requests.post(
            f"{settings.SEER_AUTOFIX_URL}/v1/automation/codebase/index/status",
            data=json.dumps(
                {
                    "organization_id": project.organization.id,
                    "project_id": project.id,
                    "repo": repo,
                }
            ),
            headers={"content-type": "application/json;charset=utf-8"},
        )

        response.raise_for_status()

        statuses.append(response.json()["status"])

    if any(status == AutofixCodebaseIndexingStatus.NOT_INDEXED for status in statuses):
        return AutofixCodebaseIndexingStatus.NOT_INDEXED

    if any(status == AutofixCodebaseIndexingStatus.INDEXING for status in statuses):
        return AutofixCodebaseIndexingStatus.INDEXING

    return AutofixCodebaseIndexingStatus.UP_TO_DATE
