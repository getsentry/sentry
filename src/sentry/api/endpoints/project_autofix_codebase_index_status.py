from __future__ import annotations

import logging

from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.helpers.autofix import get_project_codebase_indexing_status
from sentry.models.project import Project

logger = logging.getLogger(__name__)

from rest_framework.request import Request


@region_silo_endpoint
class ProjectAutofixCodebaseIndexStatusEndpoint(ProjectEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.EXPERIMENTAL,
    }
    owner = ApiOwner.ML_AI
    private = True

    def get(self, request: Request, project: Project) -> Response:
        """
        Create a codebase index for for a project's repositories, uses the code mapping to determine which repositories to index
        """
        status = get_project_codebase_indexing_status(project)

        return Response({"status": status}, status=200)
