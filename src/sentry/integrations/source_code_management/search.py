from abc import ABC, abstractmethod
from typing import Any, Generic, TypeVar

from django.db.models import Q
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import control_silo_endpoint
from sentry.integrations.api.bases.integration import IntegrationEndpoint
from sentry.integrations.models.integration import Integration
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.integrations.source_code_management.metrics import (
    SCMIntegrationInteractionEvent,
    SCMIntegrationInteractionType,
    SourceCodeSearchEndpointHaltReason,
)
from sentry.organizations.services.organization import RpcOrganization

T = TypeVar("T", bound=SourceCodeIssueIntegration)


class SourceCodeSearchSerializer(serializers.Serializer):
    field = serializers.CharField(required=True)
    query = serializers.CharField(required=True)


@control_silo_endpoint
class SourceCodeSearchEndpoint(IntegrationEndpoint, Generic[T], ABC):
    owner = ApiOwner.ECOSYSTEM
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }

    @property
    def issue_field(self) -> str:
        return "externalIssue"

    # not used in VSTS
    @property
    def repository_field(self) -> str | None:
        return None

    @property
    @abstractmethod
    def integration_provider(self) -> str | None:
        raise NotImplementedError

    @property
    @abstractmethod
    def installation_class(
        self,
    ) -> type[T]:
        raise NotImplementedError

    @abstractmethod
    def handle_search_issues(self, installation: T, query: str, repo: str | None) -> Response:
        raise NotImplementedError

    def record_event(self, event: SCMIntegrationInteractionType):
        # XXX (mifu67): self.integration_provider is None for the GithubSharedSearchEndpoint,
        # which is used by both GitHub and GitHub Enterprise.
        provider_name = "github" if self.integration_provider is None else self.integration_provider
        return SCMIntegrationInteractionEvent(
            interaction_type=event,
            provider_key=provider_name,
        )

    # not used in VSTS
    def handle_search_repositories(
        self, integration: Integration, installation: T, query: str
    ) -> Response:
        raise NotImplementedError

    def get(
        self, request: Request, organization: RpcOrganization, integration_id: int, **kwds: Any
    ) -> Response:
        with self.record_event(SCMIntegrationInteractionType.GET).capture() as lifecycle:
            integration_query = Q(
                organizationintegration__organization_id=organization.id, id=integration_id
            )

            if self.integration_provider:
                integration_query &= Q(provider=self.integration_provider)
            try:
                integration: Integration = Integration.objects.get(integration_query)
            except Integration.DoesNotExist:
                lifecycle.record_halt(str(SourceCodeSearchEndpointHaltReason.MISSING_INTEGRATION))
                return Response(status=404)

            serializer = SourceCodeSearchSerializer(data=request.query_params)
            if not serializer.is_valid():
                lifecycle.record_halt(str(SourceCodeSearchEndpointHaltReason.SERIALIZER_ERRORS))
                return self.respond(serializer.errors, status=400)

            field = serializer.validated_data["field"]
            query = serializer.validated_data["query"]

            installation = integration.get_installation(organization.id)
            if not isinstance(installation, self.installation_class):
                raise NotFound(
                    f"Integration by that id is not of type {self.integration_provider}."
                )

            if field == self.issue_field:
                repo = None

                if self.repository_field:  # only fetch repository
                    repo = request.GET.get(self.repository_field)
                    if repo is None:
                        lifecycle.record_halt(
                            str(SourceCodeSearchEndpointHaltReason.MISSING_REPOSITORY_FIELD)
                        )
                        return Response(
                            {"detail": f"{self.repository_field} is a required parameter"},
                            status=400,
                        )

                return self.handle_search_issues(installation, query, repo)

            if self.repository_field and field == self.repository_field:
                return self.handle_search_repositories(integration, installation, query)

            return Response({"detail": "Invalid field"}, status=400)
