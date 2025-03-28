import logging
from typing import Literal

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.serializers import serialize
from sentry.integrations.source_code_management.repo_trees import (
    RepoAndBranch,
    RepoTreesIntegration,
)
from sentry.issues.auto_source_code_config.integration_utils import (
    InstallationCannotGetTreesError,
    InstallationNotFoundError,
)
from sentry.models.organization import Organization
from sentry.models.project import Project

from .code_mapping import (
    CodeMapping,
    CodeMappingTreesHelper,
    FrameInfo,
    NeedsExtension,
    create_code_mapping,
)
from .integration_utils import get_installation

logger = logging.getLogger(__name__)


def process_get_request(request: Request, organization: Organization) -> Response:
    try:
        file_repo_matches = []
        resp_status: Literal[200, 204, 400] = status.HTTP_400_BAD_REQUEST

        file_repo_matches = get_file_and_repo_matches(request, organization)
        if file_repo_matches:
            resp_status = status.HTTP_200_OK
        else:
            resp_status = status.HTTP_204_NO_CONTENT

        return Response(serialize(file_repo_matches), status=resp_status)
    except InstallationCannotGetTreesError:
        return Response(
            {"text": "The integration does not support getting trees"},
            status=status.HTTP_404_NOT_FOUND,
        )
    except InstallationNotFoundError:
        return Response(
            {"text": "Could not find this integration installed on your organization"},
            status=status.HTTP_404_NOT_FOUND,
        )
    except NeedsExtension:
        return Response({"text": "Needs extension"}, status=status.HTTP_400_BAD_REQUEST)
    except KeyError:
        return Response({"text": "Missing required parameters"}, status=status.HTTP_400_BAD_REQUEST)


def get_file_and_repo_matches(request: Request, organization: Organization) -> list[dict[str, str]]:
    frame_info = get_frame_info_from_request(request)
    installation = get_installation(organization)
    if not isinstance(installation, RepoTreesIntegration):
        return []
    trees = installation.get_trees_for_org()
    trees_helper = CodeMappingTreesHelper(trees)
    return trees_helper.get_file_and_repo_matches(frame_info)


def get_frame_info_from_request(request: Request) -> FrameInfo:
    frame = {
        "absPath": request.GET.get("absPath"),
        # Currently, the only required parameter, thus, avoiding the `get` method
        "filename": request.GET["stacktraceFilename"],
        "module": request.GET.get("module"),
    }
    return FrameInfo(frame, request.GET.get("platform"))


def process_post_request(request: Request, organization: Organization) -> Response:
    try:
        project = Project.objects.get(id=request.data["projectId"])
        if not request.access.has_project_access(project):
            return Response(status=status.HTTP_403_FORBIDDEN)
        installation = get_installation(organization)
        # It helps with typing since org_integration can be None
        if not installation.org_integration:
            raise InstallationNotFoundError

        code_mapping = get_code_mapping_from_request(request)
        new_code_mapping = create_code_mapping(organization, code_mapping, project)
        return Response(serialize(new_code_mapping, request.user), status=status.HTTP_201_CREATED)
    except KeyError:
        return Response({"text": "Missing required parameters"}, status=status.HTTP_400_BAD_REQUEST)
    except Project.DoesNotExist:
        return Response({"text": "Could not find project"}, status=status.HTTP_404_NOT_FOUND)
    except InstallationNotFoundError:
        return Response(
            {"text": "Could not find this integration installed on your organization"},
            status=status.HTTP_404_NOT_FOUND,
        )
    except InstallationCannotGetTreesError:
        return Response(
            {"text": "The integration does not support getting trees"},
            status=status.HTTP_404_NOT_FOUND,
        )


def get_code_mapping_from_request(request: Request) -> CodeMapping:
    return CodeMapping(
        repo=RepoAndBranch(
            name=request.data["repoName"],
            branch=request.data["defaultBranch"],
        ),
        stacktrace_root=request.data["stackRoot"],
        source_path=request.data["sourceRoot"],
    )
