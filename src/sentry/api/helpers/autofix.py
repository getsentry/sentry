import enum

import orjson
import requests
from django.conf import settings

from sentry.autofix.utils import get_autofix_repos_from_project_code_mappings
from sentry.seer.signed_seer_api import get_seer_salted_url, sign_with_seer_secret


class AutofixCodebaseIndexingStatus(str, enum.Enum):
    UP_TO_DATE = "up_to_date"
    INDEXING = "indexing"
    NOT_INDEXED = "not_indexed"


def get_project_codebase_indexing_status(project):
    repos = get_autofix_repos_from_project_code_mappings(project)

    if not repos:
        return None

    statuses = []
    path = "/v1/automation/codebase/index/status"
    for repo in repos:
        body = orjson.dumps(
            {
                "organization_id": project.organization.id,
                "project_id": project.id,
                "repo": repo,
            },
            option=orjson.OPT_UTC_Z,
        )

        url, salt = get_seer_salted_url(f"{settings.SEER_AUTOFIX_URL}{path}")
        response = requests.post(
            url,
            data=body,
            headers={
                "content-type": "application/json;charset=utf-8",
                **sign_with_seer_secret(
                    salt,
                    body=body,
                ),
            },
        )

        response.raise_for_status()

        statuses.append(response.json()["status"])

    if any(status == AutofixCodebaseIndexingStatus.NOT_INDEXED for status in statuses):
        return AutofixCodebaseIndexingStatus.NOT_INDEXED

    if any(status == AutofixCodebaseIndexingStatus.INDEXING for status in statuses):
        return AutofixCodebaseIndexingStatus.INDEXING

    return AutofixCodebaseIndexingStatus.UP_TO_DATE
