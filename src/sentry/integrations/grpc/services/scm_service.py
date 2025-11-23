"""gRPC service implementation for SCM operations."""

import logging
import re
from contextlib import contextmanager
from functools import wraps
from typing import Any

import grpc

from sentry.integrations import manager as integrations_manager
from sentry.integrations.grpc.generated import scm_pb2, scm_pb2_grpc
from sentry.integrations.grpc.services.base import BaseGrpcServicer, authenticated_method
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.models.group import Group
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.repository import Repository
from sentry.users.models.user import User

logger = logging.getLogger(__name__)


def _camel_to_snake(name: str) -> str:
    """Convert CamelCase to snake_case."""
    # Insert an underscore before any uppercase letter that follows a lowercase letter or digit
    s1 = re.sub("(.)([A-Z][a-z]+)", r"\1_\2", name)
    # Insert an underscore before any uppercase letter that follows a lowercase letter
    return re.sub("([a-z0-9])([A-Z])", r"\1_\2", s1).lower()


class ScmServicer(scm_pb2_grpc.ScmServiceServicer, BaseGrpcServicer):
    """
    gRPC service that generically proxies requests to integration methods.

    This service uses a context manager to load integrations and a generic
    wrapper to call integration methods, eliminating boilerplate.
    """

    @contextmanager
    def integration_installation(self, request: Any, context: grpc.ServicerContext):
        """
        Context manager that loads the integration installation and handles errors.

        Args:
            request: The gRPC request object (must have organization_id)
            context: The gRPC context

        Yields:
            The integration installation instance
        """
        try:
            # Get organization
            org = Organization.objects.get(id=request.organization_id)

            # Get integration based on what's in the request
            if hasattr(request, "integration_id") and request.integration_id:
                org_integration = OrganizationIntegration.objects.get(
                    organization=org, integration_id=request.integration_id
                )
            elif hasattr(request, "provider") and request.provider != scm_pb2.PROVIDER_UNSPECIFIED:
                provider_map = {
                    scm_pb2.PROVIDER_GITHUB: "github",
                    scm_pb2.PROVIDER_GITLAB: "gitlab",
                    scm_pb2.PROVIDER_BITBUCKET: "bitbucket",
                    scm_pb2.PROVIDER_BITBUCKET_SERVER: "bitbucket_server",
                    scm_pb2.PROVIDER_AZURE_DEVOPS: "vsts",
                    scm_pb2.PROVIDER_GITHUB_ENTERPRISE: "github_enterprise",
                }
                provider_key = provider_map.get(request.provider)
                if not provider_key:
                    raise ValueError(f"Unknown provider: {request.provider}")

                org_integration = OrganizationIntegration.objects.get(
                    organization=org, integration__provider=provider_key
                )
            else:
                # Get first available SCM integration
                org_integration = OrganizationIntegration.objects.filter(
                    organization=org,
                    integration__provider__in=[
                        "github",
                        "gitlab",
                        "bitbucket",
                        "bitbucket_server",
                        "vsts",
                        "github_enterprise",
                    ],
                ).first()
                if not org_integration:
                    raise ValueError(
                        f"No SCM integration found for organization {request.organization_id}"
                    )

            # Get integration class and create installation
            integration_cls = integrations_manager.get(org_integration.integration.provider)
            if not integration_cls:
                raise ValueError(
                    f"Integration provider {org_integration.integration.provider} not found"
                )

            installation = integration_cls.get_installation(
                model=org_integration.integration, organization_id=request.organization_id
            )

            yield installation

        except Organization.DoesNotExist:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f"Organization {request.organization_id} not found")
            yield None
        except OrganizationIntegration.DoesNotExist:
            context.set_code(grpc.StatusCode.NOT_FOUND)
            context.set_details(f"Integration not found for organization {request.organization_id}")
            yield None
        except Exception as e:
            logger.exception("Error loading integration")
            context.set_code(grpc.StatusCode.INTERNAL)
            context.set_details(str(e))
            yield None

    @classmethod
    def proxy_to_integration(
        cls,
        method_name: str | None = None,
        transform_request: callable | None = None,
        transform_response: callable | None = None,
    ):
        """
        Create a generic proxy method that calls the integration method.

        Args:
            method_name: Optional name of the method to call on the integration.
                         If not specified, the function name is converted to snake_case.
            transform_request: Optional function to transform request before calling integration
            transform_response: Optional function to transform integration response to protobuf

        Returns:
            Decorated method that proxies to integration
        """

        def decorator(func):
            @wraps(func)
            @authenticated_method
            def wrapper(self, request, context):
                # Determine method name: use provided or derive from function name
                actual_method_name = method_name or _camel_to_snake(func.__name__)

                with self.integration_installation(request, context) as installation:
                    if not installation:
                        # Return empty response of the expected type
                        return_type = func.__annotations__.get("return")
                        return return_type() if return_type else None

                    try:
                        # Transform request if needed
                        if transform_request:
                            args, kwargs = transform_request(request)
                        else:
                            # Default: pass request fields as kwargs
                            kwargs = {
                                k: getattr(request, k) for k in request.DESCRIPTOR.fields_by_name
                            }
                            args = []

                        # Call the integration method
                        method = getattr(installation, actual_method_name)
                        result = method(*args, **kwargs)

                        # Transform response if needed
                        if transform_response:
                            return transform_response(result)
                        else:
                            # Default: return result as-is
                            return result

                    except (NotImplementedError, AttributeError) as e:
                        context.set_code(grpc.StatusCode.UNIMPLEMENTED)
                        context.set_details(
                            f"Method {actual_method_name} not found on integration: {e}"
                        )
                        return_type = func.__annotations__.get("return")
                        return return_type() if return_type else None
                    except Exception as e:
                        context.set_code(grpc.StatusCode.INTERNAL)
                        context.set_details(
                            f"Error calling {actual_method_name} on integration: {e}"
                        )
                        return_type = func.__annotations__.get("return")
                        return return_type() if return_type else None

            return wrapper

        return decorator

    # Helper functions for common transformations
    def _get_repo_from_id(self, repo_id: int) -> Repository | None:
        """Get repository object from ID."""
        try:
            return Repository.objects.get(id=repo_id)
        except Repository.DoesNotExist:
            return None

    def _get_group_from_id(self, group_id: int) -> Group | None:
        """Get group object from ID."""
        try:
            return Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return None

    def _get_project_from_id(self, project_id: int) -> Project | None:
        """Get project object from ID."""
        try:
            return Project.objects.get(id=project_id)
        except Project.DoesNotExist:
            return None

    def _get_user_from_id(self, user_id: int) -> User | None:
        """Get user object from ID."""
        try:
            return User.objects.get(id=user_id)
        except User.DoesNotExist:
            return None

    # ============================================================================
    # RepositoryIntegration Methods - Direct proxies with minimal transformation
    # ============================================================================

    @proxy_to_integration(
        method_name="get_repositories",
        transform_request=lambda req: (
            [],
            {
                "query": req.query if req.query else None,
                "page_number_limit": req.page_size if req.page_size > 0 else None,
            },
        ),
        transform_response=lambda repos: scm_pb2.GetRepositoriesResponse(
            repositories=[
                scm_pb2.Repository(
                    name=repo.get("name", ""),
                    external_id=repo.get("identifier", ""),
                    url=repo.get("url", ""),
                )
                for repo in repos
            ]
        ),
    )
    def GetRepositories(
        self, request: scm_pb2.GetRepositoriesRequest, context: grpc.ServicerContext
    ) -> scm_pb2.GetRepositoriesResponse:
        """Proxy to get_repositories."""
        pass

    @proxy_to_integration(
        method_name="check_file",
        transform_request=lambda req: (
            [],
            {
                "repo": Repository.objects.get(id=req.repository_id) if req.repository_id else None,
                "filepath": req.filepath,
                "branch": req.branch if req.branch else None,
            },
        ),
        transform_response=lambda url: scm_pb2.CheckFileResponse(
            exists=url is not None, url=url if url else ""
        ),
    )
    def CheckFile(
        self, request: scm_pb2.CheckFileRequest, context: grpc.ServicerContext
    ) -> scm_pb2.CheckFileResponse:
        """Proxy to check_file."""
        pass

    @proxy_to_integration(
        method_name="get_stacktrace_link",
        transform_request=lambda req: (
            [],
            {
                "repo": Repository.objects.get(id=req.repository_id) if req.repository_id else None,
                "filepath": req.filepath,
                "default": req.default_branch,
                "version": req.version if req.version else None,
            },
        ),
        transform_response=lambda link: scm_pb2.GetStacktraceLinkResponse(
            url=link.url if link and hasattr(link, "url") else "", found=link is not None
        ),
    )
    def GetStacktraceLink(
        self, request: scm_pb2.GetStacktraceLinkRequest, context: grpc.ServicerContext
    ) -> scm_pb2.GetStacktraceLinkResponse:
        """Proxy to get_stacktrace_link."""
        pass

    @proxy_to_integration(
        method_name="get_codeowner_file",
        transform_request=lambda req: (
            [],
            {
                "repo": Repository.objects.get(id=req.repository_id) if req.repository_id else None,
                "ref": req.ref if req.ref else None,
            },
        ),
        transform_response=lambda result: scm_pb2.GetCodeownerFileResponse(
            content=result.get("raw", "") if result else "",
            filepath=result.get("filepath", "") if result else "",
            html_url=result.get("html_url", "") if result else "",
        ),
    )
    def GetCodeownerFile(
        self, request: scm_pb2.GetCodeownerFileRequest, context: grpc.ServicerContext
    ) -> scm_pb2.GetCodeownerFileResponse:
        """Proxy to get_codeowner_file."""
        pass

    @proxy_to_integration(
        method_name="format_source_url",
        transform_request=lambda req: (
            [],
            {
                "repo": Repository.objects.get(id=req.repository_id) if req.repository_id else None,
                "filepath": req.filepath,
                "branch": req.branch,
            },
        ),
        transform_response=lambda url: scm_pb2.FormatSourceUrlResponse(url=url if url else ""),
    )
    def FormatSourceUrl(
        self, request: scm_pb2.FormatSourceUrlRequest, context: grpc.ServicerContext
    ) -> scm_pb2.FormatSourceUrlResponse:
        """Proxy to format_source_url."""
        pass

    @proxy_to_integration(
        method_name="extract_branch_from_source_url",
        transform_request=lambda req: (
            [],
            {
                "repo": Repository.objects.get(id=req.repository_id) if req.repository_id else None,
                "url": req.url,
            },
        ),
        transform_response=lambda branch: scm_pb2.ExtractBranchResponse(
            branch=branch if branch else ""
        ),
    )
    def ExtractBranchFromSourceUrl(
        self, request: scm_pb2.ExtractBranchRequest, context: grpc.ServicerContext
    ) -> scm_pb2.ExtractBranchResponse:
        """Proxy to extract_branch_from_source_url."""
        pass

    @proxy_to_integration(
        method_name="extract_source_path_from_source_url",
        transform_request=lambda req: (
            [],
            {
                "repo": Repository.objects.get(id=req.repository_id) if req.repository_id else None,
                "url": req.url,
            },
        ),
        transform_response=lambda path: scm_pb2.ExtractSourcePathResponse(
            path=path if path else ""
        ),
    )
    def ExtractSourcePathFromSourceUrl(
        self, request: scm_pb2.ExtractSourcePathRequest, context: grpc.ServicerContext
    ) -> scm_pb2.ExtractSourcePathResponse:
        """Proxy to extract_source_path_from_source_url."""
        pass

    @proxy_to_integration(
        method_name="source_url_matches",
        transform_request=lambda req: ([], {"url": req.url}),
        transform_response=lambda matches: scm_pb2.SourceUrlMatchesResponse(matches=matches),
    )
    def SourceUrlMatches(
        self, request: scm_pb2.SourceUrlMatchesRequest, context: grpc.ServicerContext
    ) -> scm_pb2.SourceUrlMatchesResponse:
        """Proxy to source_url_matches."""
        pass

    @proxy_to_integration(
        method_name="has_repo_access",
        transform_request=lambda req: (
            [],
            {"repo": Repository.objects.get(id=req.repository_id) if req.repository_id else None},
        ),
        transform_response=lambda has_access: scm_pb2.HasRepoAccessResponse(has_access=has_access),
    )
    def HasRepoAccess(
        self, request: scm_pb2.HasRepoAccessRequest, context: grpc.ServicerContext
    ) -> scm_pb2.HasRepoAccessResponse:
        """Proxy to has_repo_access."""
        pass

    @proxy_to_integration(
        method_name="get_unmigratable_repositories",
        transform_request=lambda req: ([], {}),
        transform_response=lambda repos: scm_pb2.GetUnmigratableRepositoriesResponse(
            repositories=(
                [
                    scm_pb2.Repository(
                        name=repo.get("name", ""), external_id=repo.get("identifier", "")
                    )
                    for repo in repos
                ]
                if repos
                else []
            )
        ),
    )
    def GetUnmigratableRepositories(
        self, request: scm_pb2.GetUnmigratableRepositoriesRequest, context: grpc.ServicerContext
    ) -> scm_pb2.GetUnmigratableRepositoriesResponse:
        """Proxy to get_unmigratable_repositories."""
        pass

    # ============================================================================
    # IssueSyncIntegration Methods
    # ============================================================================

    @proxy_to_integration(
        method_name="create_issue",
        transform_request=lambda req: (
            [],
            {"data": {"title": req.title, "description": req.description, **dict(req.metadata)}},
        ),
        transform_response=lambda issue_data: scm_pb2.CreateIssueResponse(
            issue=scm_pb2.ExternalIssue(
                key=issue_data.get("key", ""),
                title=issue_data.get("title", ""),
                description=issue_data.get("description", ""),
                web_url=issue_data.get("url", ""),
                metadata=issue_data.get("metadata", {}),
            )
        ),
    )
    def CreateIssue(
        self, request: scm_pb2.CreateIssueRequest, context: grpc.ServicerContext
    ) -> scm_pb2.CreateIssueResponse:
        """Proxy to create_issue."""
        pass

    @proxy_to_integration(
        method_name="get_issue",
        transform_request=lambda req: ([req.issue_key], {}),
        transform_response=lambda issue_data: scm_pb2.GetIssueResponse(
            issue=scm_pb2.ExternalIssue(
                key=issue_data.get("key", ""),
                title=issue_data.get("title", ""),
                description=issue_data.get("description", ""),
                web_url=issue_data.get("url", ""),
                metadata=issue_data.get("metadata", {}),
            )
        ),
    )
    def GetIssue(
        self, request: scm_pb2.GetIssueRequest, context: grpc.ServicerContext
    ) -> scm_pb2.GetIssueResponse:
        """Proxy to get_issue."""
        pass

    @proxy_to_integration(
        method_name="search_issues",
        transform_request=lambda req: ([req.query], {}),
        transform_response=lambda issues: scm_pb2.SearchIssuesResponse(
            issues=[
                scm_pb2.ExternalIssue(
                    key=issue.get("key", ""),
                    title=issue.get("title", ""),
                    description=issue.get("description", ""),
                    web_url=issue.get("url", ""),
                    metadata=issue.get("metadata", {}),
                )
                for issue in issues
            ]
        ),
    )
    def SearchIssues(
        self, request: scm_pb2.SearchIssuesRequest, context: grpc.ServicerContext
    ) -> scm_pb2.SearchIssuesResponse:
        """Proxy to search_issues."""
        pass

    @proxy_to_integration(
        method_name="get_issue_url",
        transform_request=lambda req: ([req.key], {}),
        transform_response=lambda url: scm_pb2.GetIssueUrlResponse(url=url if url else ""),
    )
    def GetIssueUrl(
        self, request: scm_pb2.GetIssueUrlRequest, context: grpc.ServicerContext
    ) -> scm_pb2.GetIssueUrlResponse:
        """Proxy to get_issue_url."""
        pass

    # ============================================================================
    # RepoTreesIntegration Methods
    # ============================================================================

    @proxy_to_integration(
        method_name="get_trees_for_org",
        transform_request=lambda req: ([], {}),
        transform_response=lambda trees: scm_pb2.GetTreesForOrgResponse(
            trees=(
                [
                    scm_pb2.RepoTree(
                        repository_name=repo_name,
                        branch=repo_tree.branch if hasattr(repo_tree, "branch") else "",
                        files=repo_tree.files if hasattr(repo_tree, "files") else [],
                    )
                    for repo_name, repo_tree in trees.items()
                ]
                if trees
                else []
            )
        ),
    )
    def GetTreesForOrg(
        self, request: scm_pb2.GetTreesForOrgRequest, context: grpc.ServicerContext
    ) -> scm_pb2.GetTreesForOrgResponse:
        """Proxy to get_trees_for_org."""
        pass

    @proxy_to_integration(
        method_name="get_cached_repo_files",
        transform_request=lambda req: (
            [],
            {
                "repo_full_name": req.repo_full_name,
                "tree_sha": req.tree_sha if req.tree_sha else None,
                "shifted_seconds": req.shifted_seconds,
                "only_source_code_files": req.only_source_code_files,
                "only_use_cache": req.only_use_cache,
            },
        ),
        transform_response=lambda files: scm_pb2.GetCachedRepoFilesResponse(
            files=files if files else []
        ),
    )
    def GetCachedRepoFiles(
        self, request: scm_pb2.GetCachedRepoFilesRequest, context: grpc.ServicerContext
    ) -> scm_pb2.GetCachedRepoFilesResponse:
        """Proxy to get_cached_repo_files."""
        pass

    # ============================================================================
    # SourceCodeIssueIntegration Methods
    # ============================================================================

    @proxy_to_integration(
        method_name="get_repository_choices",
        transform_request=lambda req: (
            [],
            {
                "group": Group.objects.get(id=req.group_id) if req.group_id else None,
                "params": dict(req.params) if hasattr(req, "params") else {},
                "page_number_limit": req.page_size if req.page_size > 0 else None,
            },
        ),
        transform_response=lambda result: scm_pb2.GetRepositoryChoicesResponse(
            default_repository_id=str(result[0]) if result[0] else "",
            choices=(
                [
                    scm_pb2.RepositoryChoice(repository_id=str(repo_id), repository_name=repo_name)
                    for repo_id, repo_name in result[1]
                ]
                if result and len(result) > 1
                else []
            ),
        ),
    )
    def GetRepositoryChoices(
        self, request: scm_pb2.GetRepositoryChoicesRequest, context: grpc.ServicerContext
    ) -> scm_pb2.GetRepositoryChoicesResponse:
        """Proxy to get_repository_choices."""
        pass

    @proxy_to_integration(
        method_name="get_project_defaults",
        transform_request=lambda req: ([req.project_id], {}),
        transform_response=lambda defaults: scm_pb2.GetProjectDefaultsResponse(
            defaults=defaults if defaults else {}
        ),
    )
    def GetProjectDefaults(
        self, request: scm_pb2.GetProjectDefaultsRequest, context: grpc.ServicerContext
    ) -> scm_pb2.GetProjectDefaultsResponse:
        """Proxy to get_project_defaults."""
        pass
