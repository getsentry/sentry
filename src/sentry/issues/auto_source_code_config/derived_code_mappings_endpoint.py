import logging

from rest_framework.request import Request

from sentry.integrations.source_code_management.repo_trees import (
    RepoAndBranch,
    RepoTreesIntegration,
)
from sentry.models.organization import Organization

from .code_mapping import CodeMapping, CodeMappingTreesHelper
from .frame_info import FrameInfo
from .integration_utils import get_installation

logger = logging.getLogger(__name__)


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
        "abs_path": request.GET.get("absPath"),
        "filename": request.GET["stacktraceFilename"],
        "module": request.GET.get("module"),
    }
    return FrameInfo(frame, request.GET.get("platform"))


def get_code_mapping_from_request(request: Request) -> CodeMapping:
    return CodeMapping(
        repo=RepoAndBranch(
            name=request.data["repoName"],
            branch=request.data["defaultBranch"],
        ),
        stacktrace_root=request.data["stackRoot"],
        source_path=request.data["sourceRoot"],
    )
