from __future__ import annotations

import logging
import re
from time import time
from typing import Any, Mapping, MutableMapping, Sequence

from django import forms
from django.db.models import QuerySet
from django.utils.translation import ugettext as _
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, http
from sentry.auth.exceptions import IdentityNotValid
from sentry.constants import ObjectStatus
from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.identity.vsts import get_user_info
from sentry.integrations import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationInstallation,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.mixins import RepositoryMixin
from sentry.integrations.vsts.issues import VstsIssueSync
from sentry.models import Identity
from sentry.models import Integration as IntegrationModel
from sentry.models import (
    IntegrationExternalProject,
    Organization,
    OrganizationIntegration,
    Repository,
    generate_token,
)
from sentry.pipeline import NestedPipelineView, Pipeline, PipelineView
from sentry.shared_integrations.exceptions import (
    ApiError,
    IntegrationError,
    IntegrationProviderError,
)
from sentry.tasks.integrations import migrate_repo
from sentry.utils.http import absolute_uri
from sentry.utils.json import JSONData
from sentry.web.helpers import render_to_response

from .client import VstsApiClient
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


class VstsIntegration(IntegrationInstallation, RepositoryMixin, VstsIssueSync):  # type: ignore
    logger = logger
    comment_key = "sync_comments"
    outbound_status_key = "sync_status_forward"
    inbound_status_key = "sync_status_reverse"
    outbound_assignee_key = "sync_forward_assignment"
    inbound_assignee_key = "sync_reverse_assignment"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.default_identity: Identity | None = None

    def reinstall(self) -> None:
        self.reinstall_repositories()

    def all_repos_migrated(self) -> bool:
        return not self.get_unmigratable_repositories()

    def get_repositories(self, query: str | None = None) -> Sequence[Mapping[str, str]]:
        try:
            repos = self.get_client().get_repos(self.instance)
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

    def get_unmigratable_repositories(self) -> QuerySet:
        return Repository.objects.filter(
            organization_id=self.organization_id, provider="visualstudio"
        ).exclude(external_id__in=[r["identifier"] for r in self.get_repositories()])

    def has_repo_access(self, repo: Repository) -> bool:
        client = self.get_client()
        try:
            # since we don't actually use webhooks for vsts commits,
            # just verify repo access
            client.get_repo(self.instance, repo.config["name"], project=repo.config["project"])
        except (ApiError, IdentityNotValid):
            return False
        return True

    def get_client(self) -> VstsApiClient:
        if self.default_identity is None:
            self.default_identity = self.get_default_identity()

        self.check_domain_name(self.default_identity)
        return VstsApiClient(self.default_identity, VstsIntegrationProvider.oauth_redirect_url)

    def check_domain_name(self, default_identity: Identity) -> None:
        if re.match("^https://.+/$", self.model.metadata["domain_name"]):
            return

        base_url = VstsIntegrationProvider.get_base_url(
            default_identity.data["access_token"], self.model.external_id
        )
        self.model.metadata["domain_name"] = base_url
        self.model.save()

    def get_organization_config(self) -> Sequence[Mapping[str, Any]]:
        client = self.get_client()
        instance = self.model.metadata["domain_name"]

        project_selector = []
        all_states_set = set()
        try:
            projects = client.get_projects(instance)
            for idx, project in enumerate(projects):
                project_selector.append({"value": project["id"], "label": project["name"]})
                # only request states for the first 5 projects to limit number
                # of requests
                if idx <= 5:
                    project_states = client.get_work_item_states(instance, project["id"])["value"]
                    for state in project_states:
                        all_states_set.add(state["name"])

            all_states = [(state, state) for state in all_states_set]
            disabled = False
        except (ApiError, IdentityNotValid):
            all_states = []
            disabled = True

        fields = [
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
        self.org_integration.update(config=config)

    def get_config_data(self) -> Mapping[str, Any]:
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
        # Explicitly typing to satisfy mypy.
        instance_: str = self.model.metadata["domain_name"]
        return instance_

    @property
    def default_project(self) -> str | None:
        try:
            # Explicitly typing to satisfy mypy.
            default_project_: str = self.model.metadata["default_project"]
        except KeyError:
            return None
        return default_project_


class VstsIntegrationProvider(IntegrationProvider):  # type: ignore
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
        organization: Organization,
        extra: Mapping[str, Any] | None = None,
    ) -> None:
        repo_ids = Repository.objects.filter(
            organization_id=organization.id,
            provider__in=["visualstudio", "integrations:vsts"],
            integration_id__isnull=True,
        ).values_list("id", flat=True)

        for repo_id in repo_ids:
            migrate_repo.apply_async(
                kwargs={
                    "repo_id": repo_id,
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
                provider="vsts", external_id=account["accountId"], status=ObjectStatus.VISIBLE
            )
            # preserve previously created subscription information
            integration["metadata"]["subscription"] = integration_model.metadata["subscription"]

            assert OrganizationIntegration.objects.filter(
                organization_id=self.pipeline.organization.id,
                integration_id=integration_model.id,
                status=ObjectStatus.VISIBLE,
            ).exists()

        except (IntegrationModel.DoesNotExist, AssertionError, KeyError):
            subscription_id, subscription_secret = self.create_subscription(base_url, oauth_data)
            integration["metadata"]["subscription"] = {
                "id": subscription_id,
                "secret": subscription_secret,
            }

        return integration

    def create_subscription(
        self, instance: str | None, oauth_data: Mapping[str, Any]
    ) -> tuple[int, str]:
        client = VstsApiClient(Identity(data=oauth_data), self.oauth_redirect_url)
        shared_secret = generate_token()
        try:
            subscription = client.create_subscription(instance, shared_secret)
        except ApiError as e:
            auth_codes = (400, 401, 403)
            permission_error = "permission" in str(e) or "not authorized" in str(e)
            if e.code in auth_codes or permission_error:
                raise IntegrationProviderError(
                    "You do not have sufficient account access to create webhooks\n"
                    "on the selected Azure DevOps organization.\n"
                    "Please check with the owner of this Azure DevOps account."
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
            # Explicitly typing to satisfy mypy.
            location_url: str | None = response.json()["locationUrl"]
            return location_url
        return None

    def setup(self) -> None:
        from sentry.plugins.base import bindings

        bindings.add(
            "integration-repository.provider", VstsRepositoryProvider, id="integrations:vsts"
        )


class AccountConfigView(PipelineView):  # type: ignore
    def dispatch(self, request: Request, pipeline: Pipeline) -> Response:
        if "account" in request.POST:
            account_id = request.POST.get("account")
            accounts = pipeline.fetch_state(key="accounts")
            account = self.get_account_from_id(account_id, accounts)
            if account is not None:
                state = pipeline.fetch_state(key="identity")
                access_token = state["data"]["access_token"]
                pipeline.bind_state("account", account)
                return pipeline.next_step()

        state = pipeline.fetch_state(key="identity")
        access_token = state["data"]["access_token"]
        user = get_user_info(access_token)

        accounts = self.get_accounts(access_token, user["uuid"])
        logger.info(
            "vsts.get_accounts",
            extra={
                "organization_id": pipeline.organization.id,
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


class AccountForm(forms.Form):  # type: ignore
    def __init__(self, accounts: Sequence[Mapping[str, str]], *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.fields["account"] = forms.ChoiceField(
            choices=[(acct["accountId"], acct["accountName"]) for acct in accounts],
            label="Account",
            help_text="Azure DevOps organization.",
        )
