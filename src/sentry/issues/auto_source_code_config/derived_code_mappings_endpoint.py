import logging

from rest_framework.request import Request

from sentry.integrations.source_code_management.repo_trees import (
    RepoAndBranch,
    RepoTreesIntegration,
)
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.models.organization import Organization

from .code_mapping import CodeMapping, CodeMappingTreesHelper
from .frame_info import FrameInfo, create_frame_info
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
    return create_frame_info(frame, request.GET.get("platform"))


def get_code_mapping_from_request(
    request: Request, installation: RepositoryIntegration
) -> CodeMapping:
    repo_name = request.data["repoName"]
    repos = installation.get_repositories(query=repo_name)
    repo_info = RepositoryIntegration.find_repo_info(repos, repo_name)
    if not repo_info:
        raise ValueError(f"Repository {repo_name} not found on provider")
    external_id = repo_info["external_id"]

    return CodeMapping(
        repo=RepoAndBranch(
            name=repo_name,
            branch=request.data["defaultBranch"],
            external_id=external_id,
        ),
        stacktrace_root=request.data["stackRoot"],
        source_path=request.data["sourceRoot"],
    )
