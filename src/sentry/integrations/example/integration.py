from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from django.http import HttpResponse
from rest_framework.request import Request

from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.mixins import ResolveSyncAction
from sentry.integrations.mixins.issues import IssueSyncIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.integration.serial import serialize_integration
from sentry.integrations.services.repository.model import RpcRepository
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.models.repository import Repository
from sentry.organizations.services.organization import RpcOrganizationSummary
from sentry.pipeline import PipelineView
from sentry.plugins.migrator import Migrator
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service


class ExampleSetupView(PipelineView):
    TEMPLATE = """
        <form method="POST">
            <p>This is an example integration configuration page.</p>
            <p><label>Integration Name:</label></p>
            <p><input type="name" name="name" /></p>
            <p><input type="submit" value="Continue" /></p>
        </form>
    """

    def dispatch(self, request: Request, pipeline) -> HttpResponse:
        if "name" in request.POST:
            pipeline.bind_state("name", request.POST["name"])
            return pipeline.next_step()

        return HttpResponse(self.TEMPLATE)


DESCRIPTION = """
This is an example integration. Descriptions support _markdown rendering_.
"""

FEATURES = [
    FeatureDescription(
        "This is a feature description. Also *supports markdown*", IntegrationFeatures.ISSUE_SYNC
    )
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun="example",
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Integration%20Problem",
    source_url="https://github.com/getsentry/sentry",
    aspects={},
)


class ExampleIntegration(RepositoryIntegration, SourceCodeIssueIntegration, IssueSyncIntegration):
    comment_key = "sync_comments"
    outbound_status_key = "sync_status_outbound"
    inbound_status_key = "sync_status_inbound"
    outbound_assignee_key = "sync_assignee_outbound"
    inbound_assignee_key = "sync_assignee_inbound"

    @property
    def integration_name(self) -> str:
        return "example"

    def get_client(self):
        pass

    def get_issue_url(self, key):
        return f"https://example/issues/{key}"

    def create_comment(self, issue_id, user_id, group_note):
        user = user_service.get_user(user_id)
        attribution = f"{user.name} wrote:\n\n"
        comment = {
            "id": "123456789",
            "text": "{}<blockquote>{}</blockquote>".format(attribution, group_note.data["text"]),
        }
        return comment

    def get_persisted_default_config_fields(self) -> Sequence[str]:
        return ["project", "issueType"]

    def get_persisted_user_default_config_fields(self):
        return ["assignedTo", "reportedBy"]

    def get_create_issue_config(self, group, user, **kwargs):
        kwargs["link_referrer"] = "example_integration"
        fields = super().get_create_issue_config(group, user, **kwargs)
        default = self.get_project_defaults(group.project_id)
        example_project_field = self.generate_example_project_field(default)
        return fields + [example_project_field]

    def generate_example_project_field(self, default_fields):
        project_field = {
            "name": "project",
            "label": "Project",
            "choices": [("1", "Project 1"), ("2", "Project 2")],
            "type": "select",
        }

        default_project = default_fields.get("project")
        if default_project is not None:
            project_field["default"] = default_project

        return project_field

    def get_link_issue_config(self, group, **kwargs):
        fields = super().get_link_issue_config(group, **kwargs)
        default = self.get_project_defaults(group.project_id)
        example_project_field = self.generate_example_project_field(default)
        return fields + [example_project_field]

    def create_issue(self, data, **kwargs):
        if "assignee" not in data:
            raise IntegrationError("Assignee is required")
        return {
            "key": "APP-123",
            "title": "This is a test external issue title",
            "description": "This is a test external issue description",
        }

    def get_issue(self, issue_id, **kwargs):
        return {
            "key": issue_id,
            "title": "This is a test external issue title",
            "description": "This is a test external issue description",
        }

    def get_repositories(self, query: str | None = None, **kwargs: Any) -> list[dict[str, Any]]:
        return [{"name": "repo", "identifier": "user/repo"}]

    def get_unmigratable_repositories(self):
        return []

    def sync_assignee_outbound(
        self,
        external_issue: ExternalIssue,
        user: RpcUser | None,
        assign: bool = True,
        **kwargs: Any,
    ) -> None:
        pass

    def sync_status_outbound(self, external_issue, is_resolved, project_id):
        pass

    def get_resolve_sync_action(self, data: Mapping[str, Any]) -> ResolveSyncAction:
        category = data["status"]["category"]
        return ResolveSyncAction.from_resolve_unresolve(
            should_resolve=category == "done",
            should_unresolve=category != "done",
        )

    def get_issue_display_name(self, external_issue):
        return f"display name: {external_issue.key}"

    def get_stacktrace_link(
        self, repo: Repository, filepath: str, default: str, version: str
    ) -> str | None:
        pass

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        return f"https://example.com/{repo.name}/blob/{branch}/{filepath}"

    def source_url_matches(self, url: str) -> bool:
        return True

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        return ""

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        return ""

    def has_repo_access(self, repo: RpcRepository) -> bool:
        return False

    def search_issues(self, query: str | None, **kwargs):
        return []


class ExampleIntegrationProvider(IntegrationProvider):
    """
    An example integration, generally used for testing.
    """

    key = "example"
    name = "Example"
    metadata = metadata

    integration_cls = ExampleIntegration

    features = frozenset(
        [
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.ISSUE_BASIC,
            IntegrationFeatures.STACKTRACE_LINK,
        ]
    )

    def get_pipeline_views(self):
        return [ExampleSetupView()]

    def get_config(self):
        return [{"name": "name", "label": "Name", "type": "text", "required": True}]

    def post_install(
        self,
        integration: Integration,
        organization: RpcOrganizationSummary,
        extra: Any | None = None,
    ) -> None:
        Migrator(integration=serialize_integration(integration), organization=organization).run()

    def build_integration(self, state):
        return {"external_id": state["name"]}

    def setup(self):
        """
        Executed once Sentry has been initialized at runtime.

        >>> def setup(self):
        >>>     bindings.add('repository.provider', GitHubRepositoryProvider, key='github')
        """


class AliasedIntegration(ExampleIntegration):
    pass


class AliasedIntegrationProvider(ExampleIntegrationProvider):
    key = "aliased"
    integration_key = "example"
    name = "Integration Key Example"


class ServerExampleProvider(ExampleIntegrationProvider):
    key = "example_server"
    name = "Example Server"


class FeatureFlagIntegration(ExampleIntegrationProvider):
    key = "feature_flag_integration"
    name = "Feature Flag Integration"
    requires_feature_flag = True


class AlertRuleIntegrationProvider(ExampleIntegrationProvider):
    key = "alert_rule_integration"
    name = "Alert Rule Integration"
    features = frozenset([IntegrationFeatures.ALERT_RULE])
