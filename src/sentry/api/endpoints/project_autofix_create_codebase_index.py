from __future__ import annotations

import logging

import orjson
import requests
from django.conf import settings
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint, ProjectPermission
from sentry.autofix.utils import get_autofix_repos_from_project_code_mappings
from sentry.models.project import Project
from sentry.seer.signed_seer_api import get_seer_salted_url, sign_with_seer_secret

logger = logging.getLogger(__name__)

from rest_framework.request import Request


class ProjectAutofixCreateCodebaseIndexPermission(ProjectPermission):
    scope_map = {
        # We might want to re-evaluate this for LA/EA whether a user needs to have write access to the project to create a codebase index (probably yes?)
        "POST": ["project:read", "project:write", "project:admin"],
    }


@region_silo_endpoint
class ProjectAutofixCreateCodebaseIndexEndpoint(ProjectEndpoint):
    publish_status = {
        "POST": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    private = True

    permission_classes = (ProjectAutofixCreateCodebaseIndexPermission,)

    def post(self, request: Request, project: Project) -> Response:
        """
        Create a codebase index for for a project's repositories, uses the code mapping to determine which repositories to index
        """
        repos = get_autofix_repos_from_project_code_mappings(project)
        path = "/v1/automation/codebase/index/create"

        for repo in repos:
            body = orjson.dumps(
                {
                    "organization_id": project.organization.id,
                    "project_id": project.id,
                    "repo": repo,
                }
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

        return Response(
            status=202,
        )
