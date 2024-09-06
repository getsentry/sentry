from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Mapping, Sequence
from typing import Any

import sentry_sdk

from sentry.auth.exceptions import IdentityNotValid
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.services.repository import RpcRepository
from sentry.models.repository import Repository
from sentry.shared_integrations.client.base import BaseApiResponseX
from sentry.shared_integrations.exceptions import ApiError, IntegrationError
from sentry.users.models.identity import Identity
from sentry.utils import metrics

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

    def check_file(self, repo: Repository, filepath: str, branch: str | None = None) -> str | None:
        """
        Calls the client's `check_file` method to see if the file exists.
        Returns the link to the file if it's exists, otherwise return `None`.

        So far only GitHub, GitLab and VSTS have this implemented, all of which give
        use back 404s. If for some reason an integration gives back a different
        status code, this method could be overwritten.

        repo: Repository (object)
        filepath: file from the stacktrace (string)
        branch: commitsha or default_branch (string)
        """
        filepath = filepath.lstrip("/")
        try:
            client = self.get_client()
        except (Identity.DoesNotExist, IntegrationError):
            sentry_sdk.capture_exception()
            return None
        try:
            response = client.check_file(repo, filepath, branch)
            metrics.incr(
                REPOSITORY_INTEGRATION_CHECK_FILE_METRIC.format(result="success"),
                tags={"integration": self.integration_name},
            )
            if not response:
                return None
        except IdentityNotValid:
            return None
        except ApiError as e:
            if e.code != 404:
                metrics.incr(
                    REPOSITORY_INTEGRATION_CHECK_FILE_METRIC.format(result="failure"),
                    tags={"integration": self.integration_name},
                )
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
        Find and get the contents of a CODEOWNERS file.

        args:
         * repo - Repository object
         * ref (optional) - if needed when searching/fetching the file

        returns an Object {} with the following keys:
         * html_url - the web url link to view the codeowner file
         * filepath - full path of the file i.e. CODEOWNERS, .github/CODEOWNERS, docs/CODEOWNERS
         * raw - the decoded raw contents of the codeowner file
        """
        if self.codeowners_locations is None:
            raise NotImplementedError("Implement self.codeowners_locations to use this method.")

        for filepath in self.codeowners_locations:
            html_url = self.check_file(repo, filepath, ref)
            if html_url:
                try:
                    contents = self.get_client().get_file(repo, filepath, ref, codeowners=True)
                    metrics.incr(
                        REPOSITORY_INTEGRATION_GET_FILE_METRIC.format(result="success"),
                        tags={"integration": self.integration_name},
                    )
                except ApiError:
                    metrics.incr(
                        REPOSITORY_INTEGRATION_GET_FILE_METRIC.format(result="success"),
                        tags={"integration": self.integration_name},
                    )
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
