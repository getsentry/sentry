from __future__ import annotations

import logging
import re
from collections.abc import Mapping, MutableMapping, Sequence
from time import time
from typing import Any
from urllib.parse import parse_qs, quote, urlencode, urlparse

from django.utils.translation import gettext as _

from sentry import features, http
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.identity.services.identity.model import RpcIdentity
from sentry.identity.vsts.provider import get_user_info
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.models.integration import Integration as IntegrationModel
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.services.integration import RpcOrganizationIntegration, integration_service
from sentry.integrations.services.repository import RpcRepository, repository_service
from sentry.integrations.source_code_management.repository import RepositoryIntegration
from sentry.integrations.vsts.client import VstsApiClient, VstsSetupApiClient
from sentry.integrations.vsts.issues import VstsIssuesSpec
from sentry.models.apitoken import generate_token
from sentry.models.repository import Repository
from sentry.organizations.services.organization import RpcOrganizationSummary
from sentry.pipeline import PipelineView
from sentry.shared_integrations.exceptions import (
    ApiError,
    IntegrationError,
    IntegrationProviderError,
)
from sentry.silo.base import SiloMode

from .repository import AzureDevOpsRepositoryProvider

DESCRIPTION = """
Connect your Sentry organization to one or more of your Azure DevOps
organizations. Get started streamlining your bug squashing workflow by unifying
your Sentry and Azure DevOps organization together.
"""

FEATURES = [
    FeatureDescription(
        """
        Authorize repositories to be added to your Sentry organization to augment
        sentry issues with commit data with [deployment
        tracking](https://docs.sentry.io/learn/releases/).
        """,
        IntegrationFeatures.COMMITS,
    ),
    FeatureDescription(
        """
        Create and link Sentry issue groups directly to a Azure DevOps work item in any of
        your projects, providing a quick way to jump from Sentry bug to tracked
        work item!
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
    FeatureDescription(
        """
        Automatically synchronize comments and assignees to and from Azure DevOps. Don't get
        confused who's fixing what, let us handle ensuring your issues and work
        items match up to your Sentry and Azure DevOps assignees.
        """,
        IntegrationFeatures.ISSUE_SYNC,
    ),
    FeatureDescription(
        """
        Never forget to close a resolved workitem! Resolving an issue in Sentry
        will resolve your linked workitems and vice versa.
        """,
        IntegrationFeatures.ISSUE_SYNC,
    ),
    FeatureDescription(
        """
        Link your Sentry stack traces back to your Azure DevOps source code with stack
        trace linking.
        """,
        IntegrationFeatures.STACKTRACE_LINK,
    ),
    FeatureDescription(
        """
        Automatically create Azure DevOps work items based on Issue Alert conditions.
        """,
        IntegrationFeatures.TICKET_RULES,
    ),
]

metadata = IntegrationMetadata(
    description=DESCRIPTION.strip(),
    features=FEATURES,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Azure%20DevOps%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/azure_devops",
    aspects={},
)

logger = logging.getLogger("sentry.integrations")


class AzureDevOpsIssuesSpec(VstsIssuesSpec):
    # for new integration
    slug = "azure_devops"
    conf_key = slug


class AzureDevOpsIntegration(RepositoryIntegration, AzureDevOpsIssuesSpec):
    logger = logger
    comment_key = "sync_comments"
    outbound_status_key = "sync_status_forward"
    inbound_status_key = "sync_status_reverse"
    outbound_assignee_key = "sync_forward_assignment"
    inbound_assignee_key = "sync_reverse_assignment"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.org_integration: RpcOrganizationIntegration | None
        self.default_identity: RpcIdentity | None = None

    @property
    def integration_name(self) -> str:
        return "azure_devops"

    def get_client(self) -> VstsApiClient:
        base_url = self.instance
        if SiloMode.get_current_mode() != SiloMode.REGION:
            if self.default_identity is None:
                self.default_identity = self.get_default_identity()
            self._check_domain_name(self.default_identity)

        if self.org_integration is None:
            raise Exception("self.org_integration is not defined")
        if self.org_integration.default_auth_id is None:
            raise Exception("self.org_integration.default_auth_id is not defined")
        return VstsApiClient(
            base_url=base_url,
            oauth_redirect_url=AzureDevOpsIntegrationProvider.oauth_redirect_url,
            org_integration_id=self.org_integration.id,
            identity_id=self.org_integration.default_auth_id,
        )

    # IntegrationInstallation methods

    def get_organization_config(self) -> Sequence[Mapping[str, Any]]:
        client = self.get_client()

        project_selector = []
        all_states_set = set()
        try:
            projects = client.get_projects()
            for idx, project in enumerate(projects):
                project_selector.append({"value": project["id"], "label": project["name"]})
                # only request states for the first 5 projects to limit number
                # of requests
                if idx <= 5:
                    work_item_states = client.get_work_item_states(project["id"])
                    assert isinstance(work_item_states, dict)

                    project_states = work_item_states["value"]
                    assert isinstance(project_states, list)

                    for state in project_states:
                        all_states_set.add(state["name"])

            all_states = [(state, state) for state in all_states_set]
            disabled = False
        except (ApiError, IdentityNotValid):
            all_states = []
            disabled = True

        fields: list[dict[str, Any]] = [
            {
                "name": self.outbound_status_key,
                "type": "choice_mapper",
                "disabled": disabled,
                "label": _("Sync Sentry Status to Azure DevOps"),
                "help": _(
                    "When a Sentry issue changes status, change the status of the linked work item in Azure DevOps."
                ),
                "addButtonText": _("Add Azure DevOps Project"),
                "addDropdown": {
                    "emptyMessage": _("All projects configured"),
                    "noResultsMessage": _("Could not find Azure DevOps project"),
                    "items": project_selector,
                },
                "mappedSelectors": {
                    "on_resolve": {"choices": all_states, "placeholder": _("Select a status")},
                    "on_unresolve": {"choices": all_states, "placeholder": _("Select a status")},
                },
                "columnLabels": {
                    "on_resolve": _("When resolved"),
                    "on_unresolve": _("When unresolved"),
                },
                "mappedColumnLabel": _("Azure DevOps Project"),
                "formatMessageValue": False,
            },
            {
                "name": self.outbound_assignee_key,
                "type": "boolean",
                "label": _("Sync Sentry Assignment to Azure DevOps"),
                "help": _(
                    "When an issue is assigned in Sentry, assign its linked Azure DevOps work item to the same user."
                ),
            },
            {
                "name": self.comment_key,
                "type": "boolean",
                "label": _("Sync Sentry Comments to Azure DevOps"),
                "help": _("Post comments from Sentry issues to linked Azure DevOps work items"),
            },
            {
                "name": self.inbound_status_key,
                "type": "boolean",
                "label": _("Sync Azure DevOps Status to Sentry"),
                "help": _(
                    "When a Azure DevOps work item is marked done, resolve its linked issue in Sentry. "
                    "When a Azure DevOps work item is removed from being done, unresolve its linked Sentry issue."
                ),
            },
            {
                "name": self.inbound_assignee_key,
                "type": "boolean",
                "label": _("Sync Azure DevOps Assignment to Sentry"),
                "help": _(
                    "When a work item is assigned in Azure DevOps, assign its linked Sentry issue to the same user."
                ),
            },
        ]

        has_issue_sync = features.has("organizations:integrations-issue-sync", self.organization)
        if not has_issue_sync:
            for field in fields:
                field["disabled"] = True
                field["disabledReason"] = _(
                    "Your organization does not have access to this feature"
                )

        return fields

    def update_organization_config(self, data: MutableMapping[str, Any]) -> None:
        if not self.org_integration:
            return
        if "sync_status_forward" in data:
            project_ids_and_statuses = data.pop("sync_status_forward")
            if any(
                not mapping["on_unresolve"] or not mapping["on_resolve"]
                for mapping in project_ids_and_statuses.values()
            ):
                raise IntegrationError("Resolve and unresolve status are required.")

            data["sync_status_forward"] = bool(project_ids_and_statuses)

            IntegrationExternalProject.objects.filter(
                organization_integration_id=self.org_integration.id
            ).delete()

            for project_id, statuses in project_ids_and_statuses.items():
                IntegrationExternalProject.objects.create(
                    organization_integration_id=self.org_integration.id,
                    external_id=project_id,
                    resolved_status=statuses["on_resolve"],
                    unresolved_status=statuses["on_unresolve"],
                )

        config = self.org_integration.config
        config.update(data)
        self.org_integration = integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id,
            config=config,
        )

    def get_config_data(self) -> Mapping[str, Any]:
        if not self.org_integration:
            return {}
        config: MutableMapping[str, Any] = self.org_integration.config
        project_mappings = IntegrationExternalProject.objects.filter(
            organization_integration_id=self.org_integration.id
        )
        sync_status_forward = {}
        for pm in project_mappings:
            sync_status_forward[pm.external_id] = {
                "on_unresolve": pm.unresolved_status,
                "on_resolve": pm.resolved_status,
            }
        config["sync_status_forward"] = sync_status_forward
        return config

    # RepositoryIntegration methods

    def get_repositories(self, query: str | None = None) -> Sequence[dict[str, Any]]:
        try:
            repos = self.get_client().get_repos()
            assert isinstance(repos, dict)
        except (ApiError, IdentityNotValid) as e:
            raise IntegrationError(self.message_from_error(e))
        data = []
        for repo in repos["value"]:
            data.append(
                {
                    "name": "{}/{}".format(repo["project"]["name"], repo["name"]),
                    "identifier": repo["id"],
                }
            )
        return data

    def get_unmigratable_repositories(self) -> list[RpcRepository]:
        repos = repository_service.get_repositories(
            organization_id=self.organization_id, providers=["visualstudio"]
        )
        identifiers_to_exclude = {r["identifier"] for r in self.get_repositories()}
        return [repo for repo in repos if repo.external_id not in identifiers_to_exclude]

    def has_repo_access(self, repo: RpcRepository) -> bool:
        client = self.get_client()
        try:
            # since we don't actually use webhooks for azure devops commits,
            # just verify repo access
            client.get_repo(repo.config["name"], project=repo.config["project"])
        except (ApiError, IdentityNotValid):
            return False
        return True

    def source_url_matches(self, url: str) -> bool:
        return url.startswith(self.model.metadata["domain_name"])

    def format_source_url(self, repo: Repository, filepath: str, branch: str | None) -> str:
        filepath = filepath.lstrip("/")
        project = quote(repo.config["project"])
        repo_id = quote(repo.config["name"])
        query_string = urlencode(
            {
                "path": f"/{filepath}",
                "version": f"GB{branch}",
            }
        )
        return f"{self.instance}{project}/_git/{repo_id}?{query_string}"

    def extract_branch_from_source_url(self, repo: Repository, url: str) -> str:
        parsed_url = urlparse(url)
        qs = parse_qs(parsed_url.query)
        if "version" in qs and len(qs["version"]) == 1 and qs["version"][0].startswith("GB"):
            return qs["version"][0][2:]
        return ""

    def extract_source_path_from_source_url(self, repo: Repository, url: str) -> str:
        parsed_url = urlparse(url)
        qs = parse_qs(parsed_url.query)
        if "path" in qs and len(qs["path"]) == 1:
            return qs["path"][0].lstrip("/")
        return ""

    # Azure DevOps only methods

    def _check_domain_name(self, default_identity: RpcIdentity) -> None:
        if re.match("^https://.+/$", self.model.metadata["domain_name"]):
            return

        base_url = AzureDevOpsIntegrationProvider.get_base_url(
            default_identity.data["access_token"], int(self.model.external_id)
        )
        metadata = self.model.metadata
        metadata["domain_name"] = base_url

        integration_service.update_integration(integration_id=self.model.id, metadata=metadata)

    @property
    def instance(self) -> str:
        return self.model.metadata["domain_name"]

    @property
    def default_project(self) -> str | None:
        try:
            return self.model.metadata["default_project"]
        except KeyError:
            return None


class AzureDevOpsIntegrationProvider(IntegrationProvider):
    key = "azure_devops"
    name = "Azure DevOps (Entra)"
    metadata = metadata
    api_version = "4.1"
    oauth_redirect_url = "/extensions/azure_devops/setup/"
    needs_default_identity = True
    integration_cls = AzureDevOpsIntegration

    features = frozenset(
        [
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.ISSUE_BASIC,
            IntegrationFeatures.ISSUE_SYNC,
            IntegrationFeatures.STACKTRACE_LINK,
            IntegrationFeatures.TICKET_RULES,
        ]
    )

    setup_dialog_config = {"width": 600, "height": 800}

    AZURE_DEVOPS_ACCOUNT_LOOKUP_URL = "https://app.vssps.visualstudio.com/_apis/resourceareas/79134C72-4A58-4B42-976C-04E7115F32BF?hostId=%s&api-preview=5.0-preview.1"

    def post_install(
        self,
        integration: IntegrationModel,
        organization: RpcOrganizationSummary,
        extra: Mapping[str, Any] | None = None,
    ) -> None:
        # TODO
        pass

    def get_scopes(self) -> Sequence[str]:
        return ("vso.code", "vso.graph", "vso.serviceendpoint_manage", "vso.work_write")

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        # TODO
        return []

    def build_integration(self, state: Mapping[str, Any]) -> Mapping[str, Any]:
        data = state["identity"]["data"]
        oauth_data = self.get_oauth_data(data)
        account = state["account"]
        user = get_user_info(data["access_token"])
        scopes = sorted(self.get_scopes())
        base_url = self.get_base_url(data["access_token"], account["accountId"])

        integration: MutableMapping[str, Any] = {
            "name": account["accountName"],
            "external_id": account["accountId"],
            "metadata": {"domain_name": base_url, "scopes": scopes},
            "user_identity": {
                "type": "azure_devops",
                "external_id": user["id"],
                "scopes": scopes,
                "data": oauth_data,
            },
        }

        try:
            integration_model = IntegrationModel.objects.get(
                provider="azure_devops",
                external_id=account["accountId"],
                status=ObjectStatus.ACTIVE,
            )
            # preserve previously created subscription information
            integration["metadata"]["subscription"] = integration_model.metadata["subscription"]

            org_id = self.pipeline.organization.id if self.pipeline.organization else None

            logger.info(
                "azure_devops.build_integration",
                extra={
                    "organization_id": org_id,
                    "user_id": user["id"],
                    "account": account,
                },
            )
            assert org_id, "Organization for Azure DevOps integration is not set"
            assert OrganizationIntegration.objects.filter(
                organization_id=org_id,
                integration_id=integration_model.id,
                status=ObjectStatus.ACTIVE,
            ).exists()

        except (IntegrationModel.DoesNotExist, AssertionError, KeyError):
            subscription_id, subscription_secret = self.create_subscription(
                base_url=base_url, oauth_data=oauth_data
            )
            integration["metadata"]["subscription"] = {
                "id": subscription_id,
                "secret": subscription_secret,
            }

        return integration

    def create_subscription(self, base_url: str, oauth_data: Mapping[str, Any]) -> tuple[int, str]:
        client = VstsSetupApiClient(
            base_url=base_url,
            oauth_redirect_url=self.oauth_redirect_url,
            access_token=oauth_data["access_token"],
        )
        shared_secret = generate_token()
        try:
            subscription = client.create_subscription(shared_secret=shared_secret)
        except ApiError as e:
            auth_codes = (400, 401, 403)
            permission_error = "permission" in str(e) or "not authorized" in str(e)
            if e.code in auth_codes or permission_error:
                logger.info(
                    "azure_devops.create_subscription_permission_error",
                    extra={
                        "organization_id": (
                            self.pipeline.organization.id if self.pipeline.organization else None
                        ),
                        "error_message": str(e),
                        "error_code": e.code,
                    },
                )
                raise IntegrationProviderError(
                    "Sentry cannot communicate with this Azure DevOps organization.\n"
                    "Please ensure third-party app access via OAuth is enabled \n"
                    "in the organization's security policy."
                )
            raise

        subscription_id = int(subscription["id"])
        return subscription_id, shared_secret

    def get_oauth_data(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        data = {"access_token": payload["access_token"]}

        if "expires_in" in payload:
            data["expires"] = int(time()) + int(payload["expires_in"])
        if "refresh_token" in payload:
            data["refresh_token"] = payload["refresh_token"]
        if "token_type" in payload:
            data["token_type"] = payload["token_type"]

        return data

    @classmethod
    def get_base_url(cls, access_token: str, account_id: int) -> str:
        url = AzureDevOpsIntegrationProvider.AZURE_DEVOPS_ACCOUNT_LOOKUP_URL % account_id
        with http.build_session() as session:
            response = session.get(
                url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {access_token}",
                },
            )
        if response.status_code == 200:
            return response.json()["locationUrl"]

        logger.info("azure_devops.get_base_url", extra={"responseCode": response.status_code})
        raise IntegrationProviderError("Could not find Azure DevOps account")

    def setup(self) -> None:
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider",
            AzureDevOpsRepositoryProvider,
            id="integrations:azure_devops",
        )
