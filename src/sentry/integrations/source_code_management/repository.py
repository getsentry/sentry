from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from typing import Any

import sentry_sdk

from sentry.auth.exceptions import IdentityNotValid
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.services.repository import RpcRepository
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
)
from sentry.models.repository import Repository
from sentry.shared_integrations.client.base import BaseApiResponseX, RateLimitInfo
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.users.models.identity import Identity

REPOSITORY_INTEGRATION_CHECK_FILE_METRIC = "repository_integration.check_file.{result}"
REPOSITORY_INTEGRATION_GET_FILE_METRIC = "repository_integration.get_file.{result}"


class BaseRepositoryIntegration(ABC):
    @abstractmethod
    def get_repositories(self, query: str | None = None) -> Sequence[dict[str, Any]]:
        """
        Get a list of available repositories for an installation

        >>> def get_repositories(self):
        >>>     return self.get_client().get_repositories()

        return [{
            'name': display_name,
            'identifier': external_repo_id,
        }]

        The shape of the `identifier` should match the data
        returned by the integration's
        IntegrationRepositoryProvider.repository_external_slug()
        """
        raise NotImplementedError


class RepositoryIntegration(IntegrationInstallation, BaseRepositoryIntegration, ABC):
    @property
    def codeowners_locations(self) -> list[str] | None:
        """
        A list of possible locations for the CODEOWNERS file.
        """
        return None

    @property
    def repo_search(self) -> bool:
        return True

    @property
    @abstractmethod
    def integration_name(self) -> str:
        raise NotImplementedError

    @abstractmethod
    def get_client(self) -> RepositoryClient:
        """Returns the client for the integration. The client must be a subclass of RepositoryClient."""
        raise NotImplementedError

    @abstractmethod
    def source_url_matches(self, url: str) -> bool:
        """Checks if the url matches the integration's source url. Used for stacktrace linking."""
        raise NotImplementedError

    @abstractmethod
    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        """Formats the source code url used for stacktrace linking."""
        raise NotImplementedError

    @abstractmethod
    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        """Extracts the branch from the source code url. Used for stacktrace linking."""
        raise NotImplementedError

    @abstractmethod
    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        """Extracts the source path from the source code url. Used for stacktrace linking."""
        raise NotImplementedError

    @abstractmethod
    def has_repo_access(self, repo: RpcRepository) -> bool:
        """Used for migrating repositories. Checks if the installation has access to the repository."""
        raise NotImplementedError

    def get_unmigratable_repositories(self) -> list[RpcRepository]:
        """
        Get all repositories which are in our database but no longer exist as far as
        the external service is concerned.
        """
        return []

    def record_event(self, event: SCMIntegrationInteractionType):
        return SCMIntegrationInteractionEvent(
            interaction_type=event,
            provider_key=self.integration_name,
            organization=self.organization,
            org_integration=self.org_integration,
        )

    def check_file(self, repo: Repository, filepath: str, branch: str | None = None) -> str | None:
        """
        Calls the client's `check_file` method to see if the file exists.
        Returns the link to the file if it exists, otherwise return `None`.

        So far only GitHub, GitLab and VSTS have this implemented, all of which give
        use back 404s. If for some reason an integration gives back a different
        status code, this method could be overwritten.

        repo: Repository (object)
        filepath: file from the stacktrace (string)
        branch: commitsha or default_branch (string)
        """
        with self.record_event(SCMIntegrationInteractionType.CHECK_FILE).capture():
            filepath = filepath.lstrip("/")
            try:
                client = self.get_client()
            except (Identity.DoesNotExist, IntegrationError):
                sentry_sdk.capture_exception()
                return None
            try:
                response = client.check_file(repo, filepath, branch)
                if not response:
                    return None
            except IdentityNotValid:
                return None
            except ApiError as e:
                if e.code != 404:
                    sentry_sdk.capture_exception()
                    raise

                return None

            return self.format_source_url(repo, filepath, branch)

    def get_stacktrace_link(
        self, repo: Repository, filepath: str, default: str, version: str | None
    ) -> str | None:
        """
        Handle formatting and returning back the stack trace link if the client
        request was successful.

        Uses the version first, and re-tries with the default branch if we 404
        trying to use the version (commit sha).

        If no file was found return `None`, and re-raise for non-"Not Found"
        errors, like 403 "Account Suspended".
        """
        with self.record_event(
            SCMIntegrationInteractionType.GET_STACKTRACE_LINK
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "filepath": filepath,
                    "default": default,
                    "version": version,
                    "organization_id": repo.organization_id,
                }
            )
            scope = sentry_sdk.Scope.get_isolation_scope()
            scope.set_tag("stacktrace_link.tried_version", False)
            if version:
                scope.set_tag("stacktrace_link.tried_version", True)
                source_url = self.check_file(repo, filepath, version)
                if source_url:
                    scope.set_tag("stacktrace_link.used_version", True)
                    return source_url
            scope.set_tag("stacktrace_link.used_version", False)
            source_url = self.check_file(repo, filepath, default)

            return source_url

    def get_codeowner_file(
        self, repo: Repository, ref: str | None = None
    ) -> Mapping[str, str] | None:
        """
        Find and get the contents of a CODEOWNERS file. Returns the link to the file if it exists, otherwise return `None`.

        args:
         * repo - Repository object
         * ref (optional) - if needed when searching/fetching the file

        returns an Object {} with the following keys:
         * html_url - the web url link to view the codeowner file
         * filepath - full path of the file i.e. CODEOWNERS, .github/CODEOWNERS, docs/CODEOWNERS
         * raw - the decoded raw contents of the codeowner file
        """
        with self.record_event(
            SCMIntegrationInteractionType.GET_CODEOWNER_FILE
        ).capture() as lifecycle:
            lifecycle.add_extras(
                {
                    "ref": ref,
                    "organization_id": repo.organization_id,
                }
            )
            if self.codeowners_locations is None:
                raise NotImplementedError("Implement self.codeowners_locations to use this method.")

            for filepath in self.codeowners_locations:
                html_url = self.check_file(repo, filepath, ref)
                if html_url:
                    try:
                        contents = self.get_client().get_file(repo, filepath, ref, codeowners=True)
                    except ApiError:
                        continue
                    return {"filepath": filepath, "html_url": html_url, "raw": contents}
            return None


class RepositoryClient(ABC):
    @abstractmethod
    def check_file(self, repo: Repository, path: str, version: str | None) -> BaseApiResponseX:
        """Check if the file exists. Currently used for stacktrace linking and CODEOWNERS."""
        raise NotImplementedError

    @abstractmethod
    def get_file(
        self, repo: Repository, path: str, ref: str | None, codeowners: bool = False
    ) -> str:
        """Get the file contents. Currently used for CODEOWNERS."""
        raise NotImplementedError

    @abstractmethod
    def get_repositories(self, fetch_max_pages: bool = False) -> list[dict[str, Any]]:
        """Get the list of repositories."""
        raise NotImplementedError

    @abstractmethod
    def get_rate_limit(self, specific_resource: str = "core") -> RateLimitInfo:
        """Get the rate limit."""
        raise NotImplementedError

    @abstractmethod
    def get_tree(self, repo_full_name: str, tree_sha: str) -> list[dict[str, Any]]:
        """Get the tree."""
        raise NotImplementedError
