from __future__ import annotations

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


@region_silo_endpoint
class ProjectAutofixCreateCodebaseIndexEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    private = True

    def post(self, request: Request, project: Project) -> Response:
        """
        Create a codebase index for for a project's repositories, uses the code mapping to determine which repositories to index
        """
        repos = get_repos_from_project_code_mappings(project)

        for repo in repos:
            response = requests.post(
                f"{settings.SEER_AUTOFIX_URL}/v1/automation/codebase/index/create",
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

        return Response(
            status=202,
        )
