from __future__ import annotations

from typing import TypedDict

from drf_spectacular.utils import extend_schema
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import cell_silo_endpoint
from sentry.api.bases.project import ProjectEndpoint
from sentry.apidocs.constants import RESPONSE_FORBIDDEN, RESPONSE_NOT_FOUND
from sentry.apidocs.utils import inline_sentry_response_serializer
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.issues.auto_source_code_config.directory_prefixes import rank_directory_prefixes
from sentry.issues.auto_source_code_config.stack_filename_sample import sample_in_app_filenames
from sentry.models.project import Project


class PrefixItem(TypedDict):
    path: str
    fileCount: int


class StackPrefixesResponse(TypedDict):
    prefixes: list[PrefixItem]


def _get_stack_prefixes(project: Project) -> list[PrefixItem]:
    filenames = sample_in_app_filenames(project)
    stack_roots = _saved_stack_roots(project)
    ranked = rank_directory_prefixes(filenames + stack_roots)
    return [{"path": p.path, "fileCount": p.file_count} for p in ranked]


def _saved_stack_roots(project: Project) -> list[str]:
    roots = (
        RepositoryProjectPathConfig.objects.filter(
            project_repository__project_id=project.id,
        )
        .exclude(stack_root="")
        .values_list("stack_root", flat=True)
    )
    return [_ensure_trailing_sep(r) for r in roots]


def _ensure_trailing_sep(root: str) -> str:
    if root.endswith(("/", "\\")):
        return root
    sep = "\\" if ("\\" in root and "/" not in root) else "/"
    return f"{root}{sep}"


@extend_schema(tags=["Integrations"])
@cell_silo_endpoint
class ProjectCodeMappingStackPrefixesEndpoint(ProjectEndpoint):
    owner = ApiOwner.ISSUES
    publish_status = {"GET": ApiPublishStatus.EXPERIMENTAL}

    @extend_schema(
        operation_id="listStackCodeMappingPrefixes",
        summary="List stack trace directory prefixes for code mapping autocomplete",
        responses={
            200: inline_sentry_response_serializer("StackPrefixesResponse", StackPrefixesResponse),
            403: RESPONSE_FORBIDDEN,
            404: RESPONSE_NOT_FOUND,
        },
    )
    def get(self, request: Request, project: Project) -> Response:
        return self.respond({"prefixes": _get_stack_prefixes(project)})
