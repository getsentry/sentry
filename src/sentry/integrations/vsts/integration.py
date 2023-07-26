from __future__ import annotations

import logging
import re
from time import time
from typing import Any, Collection, Mapping, MutableMapping, Sequence

from django import forms
from django.http import HttpResponse
from django.utils.translation import gettext as _
from rest_framework.request import Request

from sentry import features, http
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.vsts.provider import get_user_info
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.mixins import RepositoryMixin
from sentry.integrations.vsts.issues import VstsIssueSync
from sentry.models import Integration as IntegrationModel
from sentry.models import (
    IntegrationExternalProject,
    Organization,
    OrganizationIntegration,
    generate_token,
)
from sentry.pipeline import NestedPipelineView, Pipeline, PipelineView
from sentry.services.hybrid_cloud.identity.model import RpcIdentity
from sentry.services.hybrid_cloud.integration import RpcOrganizationIntegration, integration_service
from sentry.services.hybrid_cloud.organization import RpcOrganizationSummary
from sentry.services.hybrid_cloud.repository import RpcRepository, repository_service
from sentry.shared_integrations.exceptions import (
    ApiError,
    IntegrationError,
    IntegrationProviderError,
)
from sentry.silo import SiloMode
from sentry.tasks.integrations import migrate_repo
from sentry.utils.http import absolute_uri
from sentry.utils.json import JSONData
from sentry.web.helpers import render_to_response

from .client import VstsApiClient, VstsSetupApiClient
from .repository import VstsRepositoryProvider

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
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vsts",
    aspects={},
)

logger = logging.getLogger("sentry.integrations")


class VstsIntegration(IntegrationInstallation, RepositoryMixin, VstsIssueSync):
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

    def reinstall(self) -> None:
        self.reinstall_repositories()

    def all_repos_migrated(self) -> bool:
        return not self.get_unmigratable_repositories()

    def get_repositories(self, query: str | None = None) -> Sequence[Mapping[str, str]]:
        try:
            repos = self.get_client(base_url=self.instance).get_repos()
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

    def get_unmigratable_repositories(self) -> Collection[RpcRepository]:
        repos = repository_service.get_repositories(
            organization_id=self.organization_id, providers=["visualstudio"]
        )
        identifiers_to_exclude = {r["identifier"] for r in self.get_repositories()}
        return [repo for repo in repos if repo.external_id not in identifiers_to_exclude]

    def has_repo_access(self, repo: RpcRepository) -> bool:
        client = self.get_client(base_url=self.instance)
        try:
            # since we don't actually use webhooks for vsts commits,
            # just verify repo access
            client.get_repo(repo.config["name"], project=repo.config["project"])
        except (ApiError, IdentityNotValid):
            return False
        return True

    def get_client(self, base_url: str | None = None) -> VstsApiClient:
        if base_url is None:
            base_url = self.instance
        if SiloMode.get_current_mode() != SiloMode.REGION:
            if self.default_identity is None:
                self.default_identity = self.get_default_identity()
            self.check_domain_name(self.default_identity)

        if self.org_integration is None:
            raise Exception("self.org_integration is not defined")
        if self.org_integration.default_auth_id is None:
            raise Exception("self.org_integration.default_auth_id is not defined")
        return VstsApiClient(
            base_url=base_url,
            oauth_redirect_url=VstsIntegrationProvider.oauth_redirect_url,
            org_integration_id=self.org_integration.id,
            identity_id=self.org_integration.default_auth_id,
        )

    def check_domain_name(self, default_identity: RpcIdentity) -> None:
        if re.match("^https://.+/$", self.model.metadata["domain_name"]):
            return

        base_url = VstsIntegrationProvider.get_base_url(
            default_identity.data["access_token"], self.model.external_id
        )
        self.model.metadata["domain_name"] = base_url
        self.model.save()

    def get_organization_config(self) -> Sequence[Mapping[str, Any]]:
        instance = self.model.metadata["domain_name"]
        client = self.get_client(base_url=instance)

        project_selector = []
        all_states_set = set()
        try:
            projects = client.get_projects()
            for idx, project in enumerate(projects):
                project_selector.append({"value": project["id"], "label": project["name"]})
                # only request states for the first 5 projects to limit number
                # of requests
                if idx <= 5:
                    project_states = client.get_work_item_states(project["id"])["value"]
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

        organization = Organization.objects.get(id=self.organization_id)
        has_issue_sync = features.has("organizations:integrations-issue-sync", organization)
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

    @property
    def instance(self) -> str:
        return self.model.metadata["domain_name"]

    @property
    def default_project(self) -> str | None:
        try:
            return self.model.metadata["default_project"]
        except KeyError:
            return None


class VstsIntegrationProvider(IntegrationProvider):
    key = "vsts"
    name = "Azure DevOps"
    metadata = metadata
    api_version = "4.1"
    oauth_redirect_url = "/extensions/vsts/setup/"
    needs_default_identity = True
    integration_cls = VstsIntegration

    features = frozenset(
        [
            IntegrationFeatures.COMMITS,
            IntegrationFeatures.ISSUE_BASIC,
            IntegrationFeatures.ISSUE_SYNC,
            IntegrationFeatures.TICKET_RULES,
        ]
    )

    setup_dialog_config = {"width": 600, "height": 800}

    VSTS_ACCOUNT_LOOKUP_URL = "https://app.vssps.visualstudio.com/_apis/resourceareas/79134C72-4A58-4B42-976C-04E7115F32BF?hostId=%s&api-preview=5.0-preview.1"

    def post_install(
        self,
        integration: IntegrationModel,
        organization: RpcOrganizationSummary,
        extra: Mapping[str, Any] | None = None,
    ) -> None:
        repos = repository_service.get_repositories(
            organization_id=organization.id,
            providers=["visualstudio", "integrations:vsts"],
            has_integration=False,
        )

        for repo in repos:
            migrate_repo.apply_async(
                kwargs={
                    "repo_id": repo.id,
                    "integration_id": integration.id,
                    "organization_id": organization.id,
                }
            )

    def get_scopes(self) -> Sequence[str]:
        return ("vso.code", "vso.graph", "vso.serviceendpoint_manage", "vso.work_write")

    def get_pipeline_views(self) -> Sequence[PipelineView]:
        identity_pipeline_config = {
            "redirect_url": absolute_uri(self.oauth_redirect_url),
            "oauth_scopes": self.get_scopes(),
        }

        identity_pipeline_view = NestedPipelineView(
            bind_key="identity",
            provider_key=self.key,
            pipeline_cls=IdentityProviderPipeline,
            config=identity_pipeline_config,
        )

        return [identity_pipeline_view, AccountConfigView()]

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
                "type": "vsts",
                "external_id": user["id"],
                "scopes": scopes,
                "data": oauth_data,
            },
        }

        try:
            integration_model = IntegrationModel.objects.get(
                provider="vsts", external_id=account["accountId"], status=ObjectStatus.ACTIVE
            )
            # preserve previously created subscription information
            integration["metadata"]["subscription"] = integration_model.metadata["subscription"]

            logger.info(
                "vsts.build_integration",
                extra={
                    "organization_id": self.pipeline.organization.id,
                    "user_id": user["id"],
                    "account": account,
                },
            )
            assert OrganizationIntegration.objects.filter(
                organization_id=self.pipeline.organization.id,
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

    def create_subscription(
        self, base_url: str | None, oauth_data: Mapping[str, Any]
    ) -> tuple[int, str]:
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
                    "vsts.create_subscription_permission_error",
                    extra={
                        "organization_id": self.pipeline.organization.id,
                        "error_message": str(e),
                        "error_code": e.code,
                    },
                )
                raise IntegrationProviderError(
                    "Sentry cannot communicate with this Azure DevOps organization.\n"
                    "Please ensure third-party app access via OAuth is enabled \n"
                    "in the organization's security policy."
                )
            raise e

        subscription_id = subscription["id"]
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
    def get_base_url(cls, access_token: str, account_id: int) -> str | None:
        """TODO(mgaeta): This should not be allowed to return None."""
        url = VstsIntegrationProvider.VSTS_ACCOUNT_LOOKUP_URL % account_id
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

        logger.info("vsts.get_base_url", extra={"responseCode": response.status_code})
        return None

    def setup(self) -> None:
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider", VstsRepositoryProvider, id="integrations:vsts"
        )


class AccountConfigView(PipelineView):
    def dispatch(self, request: Request, pipeline: Pipeline) -> HttpResponse:
        account_id = request.POST.get("account")
        if account_id is not None:
            state_accounts: Sequence[Mapping[str, Any]] | None = pipeline.fetch_state(
                key="accounts"
            )
            account = self.get_account_from_id(account_id, state_accounts or [])
            if account is not None:
                pipeline.bind_state("account", account)
                return pipeline.next_step()

        state: Mapping[str, Any] | None = pipeline.fetch_state(key="identity")
        access_token = (state or {}).get("data", {}).get("access_token")
        user = get_user_info(access_token)

        accounts = self.get_accounts(access_token, user["uuid"])
        logger.info(
            "vsts.get_accounts",
            extra={
                "organization_id": pipeline.organization.id if pipeline.organization else None,
                "user_id": request.user.id,
                "accounts": accounts,
            },
        )
        if not accounts or not accounts.get("value"):
            return render_to_response(
                template="sentry/integrations/vsts-config.html",
                context={"no_accounts": True},
                request=request,
            )
        accounts = accounts["value"]
        pipeline.bind_state("accounts", accounts)
        account_form = AccountForm(accounts)
        return render_to_response(
            template="sentry/integrations/vsts-config.html",
            context={"form": account_form, "no_accounts": False},
            request=request,
        )

    def get_account_from_id(
        self, account_id: int, accounts: Sequence[Mapping[str, Any]]
    ) -> Mapping[str, Any] | None:
        for account in accounts:
            if account["accountId"] == account_id:
                return account
        return None

    def get_accounts(self, access_token: str, user_id: int) -> JSONData | None:
        url = (
            f"https://app.vssps.visualstudio.com/_apis/accounts?memberId={user_id}&api-version=4.1"
        )
        with http.build_session() as session:
            response = session.get(
                url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {access_token}",
                },
            )
        if response.status_code == 200:
            return response.json()
        return None


class AccountForm(forms.Form):
    def __init__(self, accounts: Sequence[Mapping[str, str]], *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields["account"] = forms.ChoiceField(
            choices=[(acct["accountId"], acct["accountName"]) for acct in accounts],
            label="Account",
            help_text="Azure DevOps organization.",
        )
