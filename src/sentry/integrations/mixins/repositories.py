from __future__ import annotations

from typing import Mapping, Sequence

from sentry_sdk import configure_scope

from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.models import Identity, Repository
from sentry.shared_integrations.exceptions import ApiError


class RepositoryMixin:
    # whether or not integration has the ability to search through Repositories
    # dynamically given a search query
    repo_search = False

    def format_source_url(self, repo: Repository, filepath: str, branch: str) -> str:
        """Formats the source code url used for stack trace linking."""
        raise NotImplementedError

    def check_file(self, repo: Repository, filepath: str, branch: str) -> str | None:
        """
        Calls the client's `check_file` method to see if the file exists.
        Returns the link to the file if it's exists, otherwise return `None`.

        So far only GitHub and GitLab have this implemented, both of which give
        use back 404s. If for some reason an integration gives back a different
        status code, this method could be overwritten.

        repo: Repository (object)
        filepath: file from the stacktrace (string)
        branch: commitsha or default_branch (string)
        """
        filepath = filepath.lstrip("/")
        try:
            client = self.get_client()
        except Identity.DoesNotExist:
            return None
        try:
            response = client.check_file(repo, filepath, branch)
            if response is None:
                return None
        except IdentityNotValid:
            return None
        except ApiError as e:
            if e.code != 404:
                raise
            return None

        return self.format_source_url(repo, filepath, branch)

    def get_stacktrace_link(
        self, repo: Repository, filepath: str, default: str, version: str
    ) -> str | None:
        """
        Handle formatting and returning back the stack trace link if the client
        request was successful.

        Uses the version first, and re-tries with the default branch if we 404
        trying to use the version (commit sha).

        If no file was found return `None`, and re-raise for non-"Not Found"
        errors, like 403 "Account Suspended".
        """
        with configure_scope() as scope:
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

    def get_repositories(self, query: str | None = None) -> Sequence[Repository]:
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

    def get_unmigratable_repositories(self) -> Sequence[Repository]:
        return []

    def reinstall_repositories(self) -> None:
        """Reinstalls repositories associated with the integration."""
        organizations = self.model.organizations.all()
        Repository.objects.filter(
            organization_id__in=organizations.values_list("id", flat=True),
            provider=f"integrations:{self.model.provider}",
            integration_id=self.model.id,
        ).update(status=ObjectStatus.VISIBLE)

    def has_repo_access(self, repo: Repository) -> bool:
        raise NotImplementedError

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
                    contents = self.get_client().get_file(repo, filepath, ref)
                except ApiError:
                    continue
                return {"filepath": filepath, "html_url": html_url, "raw": contents}
        return None
