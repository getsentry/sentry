from __future__ import annotations

import enum
import logging

import requests
from django.conf import settings
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.repos import get_repos_from_project_code_mappings
from sentry.models.project import Project
from sentry.utils import json

logger = logging.getLogger(__name__)

from rest_framework.request import Request


class CodebaseIndexStatus(str, enum.Enum):
    UP_TO_DATE = "up_to_date"
    INDEXING = "indexing"
    NOT_INDEXED = "not_indexed"


@region_silo_endpoint
class ProjectAutofixCodebaseIndexStatusEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    private = True

    def get(self, request: Request, project: Project) -> Response:
        """
        Create a codebase index for for a project's repositories, uses the code mapping to determine which repositories to index
        """
        repos = get_repos_from_project_code_mappings(project)

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

        if any(status == CodebaseIndexStatus.NOT_INDEXED for status in statuses):
            return Response({"status": CodebaseIndexStatus.NOT_INDEXED}, status=200)

        if any(status == CodebaseIndexStatus.INDEXING for status in statuses):
            return Response({"status": CodebaseIndexStatus.INDEXING}, status=200)

        return Response({"status": CodebaseIndexStatus.UP_TO_DATE}, status=200)
