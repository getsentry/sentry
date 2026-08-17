from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import TYPE_CHECKING, Any

from rest_framework.response import Response

from sentry.api.base import control_silo_endpoint
from sentry.api.paginator import SequencePaginator
from sentry.integrations.gitea.integration import GiteaIntegration
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.metrics import SCMIntegrationInteractionType
from sentry.integrations.source_code_management.search import SourceCodeSearchEndpoint
from sentry.integrations.types import IntegrationProviderSlug
from sentry.shared_integrations.exceptions import ApiError, IntegrationError

if TYPE_CHECKING:
    # `@control_silo_endpoint` rebuilds the class it decorates with `type()`,
    # which drops its `Generic` parameters - so the base is only subscriptable
    # to a type checker, never at runtime.
    _SearchEndpoint = SourceCodeSearchEndpoint[GiteaIntegration]
else:
    _SearchEndpoint = SourceCodeSearchEndpoint


@control_silo_endpoint
class GiteaIssueSearchEndpoint(_SearchEndpoint):
    """Autocomplete for the repository and issue pickers on the issue-linking forms."""

    @property
    def repository_field(self) -> str:
        return "repo"

    @property
    def integration_provider(self) -> str:
        return IntegrationProviderSlug.GITEA.value

    @property
    def installation_class(self) -> type[GiteaIntegration]:
        return GiteaIntegration

    def _paginated(
        self,
        results: Sequence[Any],
        as_choice: Callable[[Any], dict[str, Any]],
    ) -> Response:
        """
        The choices, in the order the provider returned them.

        Paginated over the fetched page rather than returned bare: Gitea has no
        relevance ordering to lean on, so a repository with hundreds of open
        issues can fill a response the picker then has to render whole.
        """
        return self.paginate(
            request=self.request,
            paginator=SequencePaginator(list(enumerate(results))),
            on_results=lambda items: [as_choice(item) for item in items],
        )

    def handle_search_issues(
        self, installation: GiteaIntegration, query: str, repo: str | None
    ) -> Response:
        with self.record_event(
            SCMIntegrationInteractionType.HANDLE_SEARCH_ISSUES,
            organization_id=installation.organization_id,
            integration_id=installation.org_integration.integration_id,
        ).capture() as lifecycle:
            assert repo

            try:
                response = installation.search_issues(query=query, repo=repo)
            except IntegrationError as e:
                # `repo` arrives as a raw query parameter, so an unknown or
                # malformed one is user error rather than an integration
                # failure.
                lifecycle.record_halt(e)
                return Response({"detail": str(e)}, status=400)
            except ApiError as e:
                lifecycle.record_failure(e)
                return Response({"detail": str(e)}, status=400)

            assert isinstance(response, list)
            return self._paginated(
                response,
                # The bare index, not `{repo}#{index}`: the link form carries the
                # repository in its own field, and that is where `get_issue`
                # reads it from.
                lambda issue: {
                    "label": "#{} {}".format(issue["number"], issue["title"]),
                    "value": issue["number"],
                },
            )

    def handle_search_repositories(
        self, integration: Integration, installation: GiteaIntegration, query: str
    ) -> Response:
        with self.record_event(
            SCMIntegrationInteractionType.HANDLE_SEARCH_REPOSITORIES,
            organization_id=installation.organization_id,
            integration_id=integration.id,
        ).capture() as lifecycle:
            assert isinstance(installation, self.installation_class)
            try:
                repos = installation.get_repositories(query=query)
            except (ApiError, IntegrationError) as e:
                lifecycle.record_failure(e)
                return Response({"detail": str(e)}, status=400)

            return self._paginated(
                repos, lambda repo: {"label": repo["name"], "value": repo["identifier"]}
            )
