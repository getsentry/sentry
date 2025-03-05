from __future__ import annotations

import logging
import re
from collections.abc import Mapping, Sequence
from typing import Any, NotRequired, TypedDict
from urllib.parse import urlparse

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.serialization import load_pem_private_key
from django import forms
from django.core.validators import URLValidator
from django.http import HttpResponseRedirect
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.utils.translation import gettext as _
from django.views.decorators.csrf import csrf_exempt

from sentry import features
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.jira.tasks import migrate_issues
from sentry.integrations.jira_server.utils.choice import build_user_choice
from sentry.integrations.mixins import ResolveSyncAction
from sentry.integrations.mixins.issues import IssueSyncIntegration
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.services.integration import integration_service
from sentry.models.group import Group
from sentry.organizations.services.organization.service import organization_service
from sentry.pipeline import Pipeline, PipelineView
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiHostError,
    ApiUnauthorized,
    IntegrationError,
    IntegrationFormError,
    IntegrationInstallationConfigurationError,
)
from sentry.silo.base import all_silo_function
from sentry.users.models.identity import Identity
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.hashlib import sha1_text
from sentry.utils.http import absolute_uri
from sentry.web.helpers import render_to_response

from .client import JiraServerClient, JiraServerSetupClient

logger = logging.getLogger("sentry.integrations.jira_server")


DESCRIPTION = """
Connect your Sentry organization into one or more of your Jira Server instances.
Get started streamlining your bug squashing workflow by unifying your Sentry and
Jira instances together.
"""

FEATURE_DESCRIPTIONS = [
    FeatureDescription(
        """
        Create and link Sentry issue groups directly to a Jira ticket in any of your
        projects, providing a quick way to jump from Sentry bug to tracked ticket!
        """,
        IntegrationFeatures.ISSUE_BASIC,
    ),
    FeatureDescription(
        """
        Automatically synchronize assignees to and from Jira. Don't get confused
        who's fixing what, let us handle ensuring your issues and tickets match up
        to your Sentry and Jira assignees.
        """,
        IntegrationFeatures.ISSUE_SYNC,
    ),
    FeatureDescription(
        """
        Synchronize Comments on Sentry Issues directly to the linked Jira ticket.
        """,
        IntegrationFeatures.ISSUE_SYNC,
    ),
    FeatureDescription(
        """
        Automatically create Jira tickets based on Issue Alert conditions.
        """,
        IntegrationFeatures.TICKET_RULES,
    ),
]

setup_alert = {
    "type": "warning",
    "icon": "icon-warning-sm",
    "text": "Your Jira instance must be able to communicate with Sentry."
    " Sentry makes outbound requests from a [static set of IP"
    " addresses](https://docs.sentry.io/ip-ranges/) that you may wish"
    " to allow in your firewall to support this integration.",
}


metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURE_DESCRIPTIONS,
    author="The Sentry Team",
    noun=_("Installation"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Jira%20Server%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/jira_server",
    aspects={"alerts": [setup_alert]},
)


class _Project(TypedDict):
    value: str
    label: str


class _AddDropDown(TypedDict):
    emptyMessage: str
    noResultsMessage: str
    items: list[_Project]


class _Choices(TypedDict):
    choices: list[tuple[str, str]]
    placeholder: str


class _MappedSelectors(TypedDict):
    on_resolve: _Choices
    on_unresolve: _Choices


class _ColumnLabels(TypedDict):
    on_resolve: str
    on_unresolve: str


class _Config(TypedDict):
    name: str
    type: str
    label: str
    help: str | str
    placeholder: NotRequired[str]
    choices: NotRequired[list[tuple[str, str]]]
    addButtonText: NotRequired[str]
    addDropdown: NotRequired[_AddDropDown]
    mappedSelectors: NotRequired[_MappedSelectors]
    columnLabels: NotRequired[_ColumnLabels]
    mappedColumnLabel: NotRequired[str]
    formatMessageValue: NotRequired[bool]
    disabled: NotRequired[bool]
    disabledReason: NotRequired[str]


class InstallationForm(forms.Form):
    url = forms.CharField(
        label=_("Jira URL"),
        help_text=_("The base URL for your Jira Server instance, including the host and protocol."),
        widget=forms.TextInput(attrs={"placeholder": "https://jira.example.com"}),
        validators=[URLValidator()],
    )
    verify_ssl = forms.BooleanField(
        label=_("Verify SSL"),
        help_text=_(
            "By default, we verify SSL certificates " "when making requests to your Jira instance."
        ),
        widget=forms.CheckboxInput(),
        required=False,
        initial=True,
    )
    consumer_key = forms.CharField(
        label=_("Jira Consumer Key"),
        widget=forms.TextInput(attrs={"placeholder": "sentry-consumer-key"}),
    )
    private_key = forms.CharField(
        label=_("Jira Consumer Private Key"),
        widget=forms.Textarea(
            attrs={
                "placeholder": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
            }
        ),
    )

    def clean_url(self):
        """Strip off trailing / as they cause invalid URLs downstream"""
        return self.cleaned_data["url"].rstrip("/")

    def clean_private_key(self):
        data = self.cleaned_data["private_key"]

        try:
            load_pem_private_key(data.encode("utf-8"), None, default_backend())
        except Exception:
            raise forms.ValidationError(
                "Private key must be a valid SSH private key encoded in a PEM format."
            )
        return data

    def clean_consumer_key(self):
        data = self.cleaned_data["consumer_key"]
        if len(data) > 200:
            raise forms.ValidationError("Consumer key is limited to 200 characters.")
        return data


class InstallationConfigView(PipelineView):
    """
    Collect the OAuth client credentials from the user.
    """

    def dispatch(self, request: HttpRequest, pipeline: Pipeline) -> HttpResponseBase:
        if request.method == "POST":
            form = InstallationForm(request.POST)
            if form.is_valid():
                form_data = form.cleaned_data

                pipeline.bind_state("installation_data", form_data)
                return pipeline.next_step()
        else:
            form = InstallationForm()

        return render_to_response(
            template="sentry/integrations/jira-server-config.html",
            context={"form": form},
            request=request,
        )


class OAuthLoginView(PipelineView):
    """
    Start the OAuth dance by creating a request token
    and redirecting the user to approve it.
    """

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, pipeline: Pipeline) -> HttpResponseBase:
        if "oauth_token" in request.GET:
            return pipeline.next_step()

        config = pipeline.fetch_state("installation_data")
        if config is None:
            return pipeline.error("Missing installation_data")

        client = JiraServerSetupClient(
            config.get("url"),
            config.get("consumer_key"),
            config.get("private_key"),
            config.get("verify_ssl"),
        )
        try:
            request_token = client.get_request_token()
        except ApiError as error:
            logger.info(
                "identity.jira-server.request-token",
                extra={"url": config.get("url"), "error": error},
            )
            return pipeline.error(f"Could not fetch a request token from Jira. {error}")

        pipeline.bind_state("request_token", request_token)
        if not request_token.get("oauth_token"):
            logger.info(
                "identity.jira-server.oauth-token",
                extra={"url": config.get("url")},
            )
            return pipeline.error("Missing oauth_token")

        authorize_url = client.get_authorize_url(request_token)

        return HttpResponseRedirect(authorize_url)


class OAuthCallbackView(PipelineView):
    """
    Complete the OAuth dance by exchanging our request token
    into an access token.
    """

    @method_decorator(csrf_exempt)
    def dispatch(self, request: HttpRequest, pipeline: Pipeline) -> HttpResponseBase:
        config = pipeline.fetch_state("installation_data")
        if config is None:
            return pipeline.error("Missing installation_data")

        client = JiraServerSetupClient(
            config.get("url"),
            config.get("consumer_key"),
            config.get("private_key"),
            config.get("verify_ssl"),
        )

        try:
            access_token = client.get_access_token(
                pipeline.fetch_state("request_token"), request.GET["oauth_token"]
            )
            pipeline.bind_state("access_token", access_token)

            return pipeline.next_step()
        except ApiError as error:
            logger.info("identity.jira-server.access-token", extra={"error": error})
            return pipeline.error("Could not fetch an access token from Jira")


# Hide linked issues fields because we don't have the necessary UI for fully specifying
# a valid link (e.g. "is blocked by ISSUE-1").
HIDDEN_ISSUE_FIELDS = ["issuelinks"]

# A list of common builtin custom field types for Jira for easy reference.
JIRA_CUSTOM_FIELD_TYPES = {
    "select": "com.atlassian.jira.plugin.system.customfieldtypes:select",
    "textarea": "com.atlassian.jira.plugin.system.customfieldtypes:textarea",
    "multiuserpicker": "com.atlassian.jira.plugin.system.customfieldtypes:multiuserpicker",
    "tempo_account": "com.tempoplugin.tempo-accounts:accounts.customfield",
    "sprint": "com.pyxis.greenhopper.jira:gh-sprint",
    "epic": "com.pyxis.greenhopper.jira:gh-epic-link",
}


class JiraServerIntegration(IssueSyncIntegration):
    """
    IntegrationInstallation implementation for Jira-Server
    """

    comment_key = "sync_comments"
    outbound_status_key = "sync_status_forward"
    inbound_status_key = "sync_status_reverse"
    outbound_assignee_key = "sync_forward_assignment"
    inbound_assignee_key = "sync_reverse_assignment"
    issues_ignored_fields_key = "issues_ignored_fields"
    resolution_strategy_key = "resolution_strategy"

    default_identity = None

    def get_client(self):
        try:
            self.default_identity = self.get_default_identity()
        except Identity.DoesNotExist:
            raise IntegrationError("Identity not found.")

        return JiraServerClient(
            integration=self.model,
            identity=self.default_identity,
        )

    def get_organization_config(self):
        configuration: list[_Config] = [
            {
                "name": self.outbound_status_key,
                "type": "choice_mapper",
                "label": _("Sync Sentry Status to Jira Server"),
                "help": _(
                    "When a Sentry issue changes status, change the status of the linked ticket in Jira Server."
                ),
                "addButtonText": _("Add Jira Server Project"),
                "addDropdown": {
                    "emptyMessage": _("All projects configured"),
                    "noResultsMessage": _("Could not find Jira Server project"),
                    "items": [],  # Populated with projects
                },
                "mappedSelectors": {
                    "on_resolve": {"choices": [], "placeholder": _("Select a status")},
                    "on_unresolve": {"choices": [], "placeholder": _("Select a status")},
                },
                "columnLabels": {
                    "on_resolve": _("When resolved"),
                    "on_unresolve": _("When unresolved"),
                },
                "mappedColumnLabel": _("Jira Server Project"),
                "formatMessageValue": False,
            },
            {
                "name": self.outbound_assignee_key,
                "type": "boolean",
                "label": _("Sync Sentry Assignment to Jira Server"),
                "help": _(
                    "When an issue is assigned in Sentry, assign its linked Jira Server ticket to the same user."
                ),
            },
            {
                "name": self.comment_key,
                "type": "boolean",
                "label": _("Sync Sentry Comments to Jira Server"),
                "help": _("Post comments from Sentry issues to linked Jira Server tickets"),
            },
            {
                "name": self.inbound_status_key,
                "type": "boolean",
                "label": _("Sync Jira Server Status to Sentry"),
                "help": _(
                    "When a Jira Server ticket is marked done, resolve its linked issue in Sentry. "
                    "When a Jira Server ticket is removed from being done, unresolve its linked Sentry issue."
                ),
            },
            {
                "name": self.inbound_assignee_key,
                "type": "boolean",
                "label": _("Sync Jira Server Assignment to Sentry"),
                "help": _(
                    "When a ticket is assigned in Jira Server, assign its linked Sentry issue to the same user."
                ),
            },
            {
                "name": self.resolution_strategy_key,
                "label": "Resolve",
                "type": "select",
                "placeholder": "Resolve",
                "choices": [
                    ("resolve", "Resolve"),
                    ("resolve_current_release", "Resolve in Current Release"),
                    ("resolve_next_release", "Resolve in Next Release"),
                ],
                "help": _(
                    "Select what action to take on Sentry Issue when Jira ticket is marked Done."
                ),
            },
            {
                "name": self.issues_ignored_fields_key,
                "label": "Ignored Fields",
                "type": "textarea",
                "placeholder": _("components, security, customfield_10006"),
                "help": _("Comma-separated Jira field IDs that you want to hide."),
            },
        ]

        client = self.get_client()

        try:
            statuses = [(c["id"], c["name"]) for c in client.get_valid_statuses()]
            configuration[0]["mappedSelectors"]["on_resolve"]["choices"] = statuses
            configuration[0]["mappedSelectors"]["on_unresolve"]["choices"] = statuses

            projects: list[_Project] = [
                {"value": p["id"], "label": p["name"]} for p in client.get_projects_list()
            ]
            configuration[0]["addDropdown"]["items"] = projects
        except ApiError:
            configuration[0]["disabled"] = True
            configuration[0]["disabledReason"] = _(
                "Unable to communicate with the Jira instance. You may need to reinstall the addon."
            )

        context = organization_service.get_organization_by_id(
            id=self.organization_id, include_teams=False, include_projects=False
        )
        if context is not None:
            organization = context.organization
            has_issue_sync = features.has("organizations:integrations-issue-sync", organization)
        else:
            has_issue_sync = False

        if not has_issue_sync:
            for field in configuration:
                field["disabled"] = True
                field["disabledReason"] = _(
                    "Your organization does not have access to this feature"
                )

        return configuration

    def update_organization_config(self, data):
        """
        Update the configuration field for an organization integration.
        """
        config = self.org_integration.config

        if "sync_status_forward" in data:
            project_mappings = data.pop("sync_status_forward")

            if any(
                not mapping["on_unresolve"] or not mapping["on_resolve"]
                for mapping in project_mappings.values()
            ):
                raise IntegrationError("Resolve and unresolve status are required.")

            data["sync_status_forward"] = bool(project_mappings)

            IntegrationExternalProject.objects.filter(
                organization_integration_id=self.org_integration.id
            ).delete()

            for project_id, statuses in project_mappings.items():
                IntegrationExternalProject.objects.create(
                    organization_integration_id=self.org_integration.id,
                    external_id=project_id,
                    resolved_status=statuses["on_resolve"],
                    unresolved_status=statuses["on_unresolve"],
                )

        if self.issues_ignored_fields_key in data:
            ignored_fields_text = data.pop(self.issues_ignored_fields_key)
            # While we describe the config as a "comma-separated list", users are likely to
            # accidentally use newlines, so we explicitly handle that case. On page
            # refresh, they will see how it got interpreted as `get_config_data` will
            # re-serialize the config as a comma-separated list.
            ignored_fields_list = list(
                filter(
                    None, [field.strip() for field in re.split(r"[,\n\r]+", ignored_fields_text)]
                )
            )
            data[self.issues_ignored_fields_key] = ignored_fields_list

        config.update(data)
        org_integration = integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id,
            config=config,
        )
        if org_integration is not None:
            self.org_integration = org_integration

    def get_config_data(self):
        config = self.org_integration.config
        project_mappings = integration_service.get_integration_external_projects(
            organization_id=self.org_integration.organization_id,
            integration_id=self.org_integration.integration_id,
        )
        sync_status_forward = {}
        for pm in project_mappings:
            sync_status_forward[pm.external_id] = {
                "on_unresolve": pm.unresolved_status,
                "on_resolve": pm.resolved_status,
            }
        config["sync_status_forward"] = sync_status_forward
        config[self.issues_ignored_fields_key] = ", ".join(
            config.get(self.issues_ignored_fields_key, "")
        )
        return config

    def sync_metadata(self) -> None:
        client = self.get_client()

        try:
            server_info = client.get_server_info()
            projects = client.get_projects_list()
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        self.model.name = server_info["serverTitle"]

        # There is no Jira instance icon (there is a favicon, but it doesn't seem
        # possible to query that with the API). So instead we just use the first
        # project Icon.
        if len(projects) > 0:
            avatar = projects[0]["avatarUrls"]["48x48"]
            self.model.metadata.update({"icon": avatar})

        integration_service.update_integration(
            integration_id=self.model.id,
            name=self.model.name,
            metadata=self.model.metadata,
        )

    def get_link_issue_config(self, group, **kwargs):
        fields = super().get_link_issue_config(group, **kwargs)
        org = group.organization
        autocomplete_url = reverse(
            "sentry-extensions-jiraserver-search", args=[org.slug, self.model.id]
        )
        for field in fields:
            if field["name"] == "externalIssue":
                field["url"] = autocomplete_url
                field["type"] = "select"

        default_comment = "Linked Sentry Issue: [{}|{}]".format(
            group.qualified_short_id,
            absolute_uri(group.get_absolute_url(params={"referrer": "jira_server"})),
        )
        fields.append(
            {
                "name": "comment",
                "label": "Comment",
                "default": default_comment,
                "type": "textarea",
                "autosize": True,
                "maxRows": 10,
            }
        )

        return fields

    def get_issue_url(self, key: str) -> str:
        return "{}/browse/{}".format(self.model.metadata["base_url"], key)

    def get_persisted_default_config_fields(self) -> Sequence[str]:
        return ["project", "issuetype", "priority", "labels"]

    def get_persisted_user_default_config_fields(self):
        return ["reporter"]

    def get_persisted_ignored_fields(self):
        return self.org_integration.config.get(self.issues_ignored_fields_key, [])

    def get_group_description(self, group, event, **kwargs):
        output = [
            "Sentry Issue: [{}|{}]".format(
                group.qualified_short_id,
                absolute_uri(group.get_absolute_url(params={"referrer": "jira_integration"})),
            )
        ]
        body = self.get_group_body(group, event)
        if body:
            output.extend(["", "{code}", body, "{code}"])
        return "\n".join(output)

    def get_issue(self, issue_id, **kwargs):
        """
        Jira installation's implementation of IssueSyncIntegration's `get_issue`.
        """
        client = self.get_client()
        issue = client.get_issue(issue_id)
        fields = issue.get("fields", {})
        return {
            "key": issue_id,
            "title": fields.get("summary"),
            "description": fields.get("description"),
        }

    def create_comment(self, issue_id, user_id, group_note):
        # https://jira.atlassian.com/secure/WikiRendererHelpAction.jspa?section=texteffects
        comment = group_note.data["text"]
        quoted_comment = self.create_comment_attribution(user_id, comment)
        return self.get_client().create_comment(issue_id, quoted_comment)

    def create_comment_attribution(self, user_id: int, comment_text: str) -> str:
        user = user_service.get_user(user_id=user_id)
        assert user is not None
        attribution = f"{user.name} wrote:\n\n"
        return f"{attribution}{{quote}}{comment_text}{{quote}}"

    def update_comment(self, issue_id, user_id, group_note):
        quoted_comment = self.create_comment_attribution(user_id, group_note.data["text"])
        return self.get_client().update_comment(
            issue_id, group_note.data["external_id"], quoted_comment
        )

    def search_issues(self, query: str | None, **kwargs) -> dict[str, Any]:
        try:
            resp = self.get_client().search_issues(query)
            assert isinstance(resp, dict)
            return resp
        except ApiError as e:
            self.raise_error(e)

    def make_choices(self, values):
        if not values:
            return []
        results = []
        for item in values:
            key = item.get("id", None)
            if "name" in item:
                value = item["name"]
            elif "value" in item:
                # Value based options prefer the value on submit.
                key = item["value"]
                value = item["value"]
            elif "label" in item:
                # Label based options prefer the value on submit.
                key = item["label"]
                value = item["label"]
            else:
                continue
            results.append((key, value))
        return results

    def error_message_from_json(self, data):
        message = ""
        if data.get("errorMessages"):
            message = " ".join(data["errorMessages"])
        if data.get("errors"):
            if message:
                message += " "
            message += " ".join(f"{k}: {v}" for k, v in data.get("errors").items())
        return message

    def error_fields_from_json(self, data):
        errors = data.get("errors")
        if not errors:
            return None

        return {key: [error] for key, error in data.get("errors").items()}

    def search_url(self, org_slug):
        return reverse("sentry-extensions-jiraserver-search", args=[org_slug, self.model.id])

    def build_dynamic_field(self, field_meta, group=None):
        """
        Builds a field based on Jira's meta field information
        """
        schema = field_meta["schema"]

        # set up some defaults for form fields
        fieldtype = "text"
        fkwargs = {"label": field_meta["name"], "required": field_meta["required"]}
        # override defaults based on field configuration
        if (
            schema["type"] in ["securitylevel", "priority"]
            or schema.get("custom") == JIRA_CUSTOM_FIELD_TYPES["select"]
        ):
            fieldtype = "select"
            fkwargs["choices"] = self.make_choices(field_meta.get("allowedValues"))
        elif (
            # Assignee and reporter fields
            field_meta.get("autoCompleteUrl")
            and (schema.get("items") == "user" or schema["type"] == "user")
            # Sprint and "Epic Link" fields
            or schema.get("custom")
            in (JIRA_CUSTOM_FIELD_TYPES["sprint"], JIRA_CUSTOM_FIELD_TYPES["epic"])
            # Parent field
            or schema["type"] == "issuelink"
        ):
            fieldtype = "select"
            if group is not None:
                organization = group.organization
            else:
                ctx = organization_service.get_organization_by_id(
                    id=self.organization_id, include_teams=False, include_projects=False
                )
                assert ctx is not None
                organization = ctx.organization

            fkwargs["url"] = self.search_url(organization.slug)
            fkwargs["choices"] = []
        elif schema["type"] in ["timetracking"]:
            # TODO: Implement timetracking (currently unsupported altogether)
            return None
        elif schema.get("items") in ["worklog", "attachment"]:
            # TODO: Implement worklogs and attachments someday
            return None
        elif schema["type"] == "array" and schema["items"] != "string":
            fieldtype = "select"
            fkwargs.update(
                {
                    "multiple": True,
                    "choices": self.make_choices(field_meta.get("allowedValues")),
                    "default": "",
                }
            )
        elif schema["type"] == "option" and len(field_meta.get("allowedValues", [])):
            fieldtype = "select"
            fkwargs.update(
                {"choices": self.make_choices(field_meta.get("allowedValues")), "default": ""}
            )

        # break this out, since multiple field types could additionally
        # be configured to use a custom property instead of a default.
        if schema.get("custom"):
            if schema["custom"] == JIRA_CUSTOM_FIELD_TYPES["textarea"]:
                fieldtype = "textarea"

        fkwargs["type"] = fieldtype
        return fkwargs

    def get_projects(self, cached=True):
        client = self.get_client()
        no_projects_error_message = "Could not fetch project list from Jira Server. Ensure that Jira Server is available and your account is still active."
        try:
            jira_projects = client.get_projects_list(cached)
        except ApiError as e:
            logger.info(
                "jira_server.get_projects.error",
                extra={
                    "integration_id": self.model.id,
                    "organization_id": self.organization_id,
                    "error": str(e),
                },
            )
            raise IntegrationError(no_projects_error_message)
        if len(jira_projects) == 0:
            logger.info(
                "jira_server.get_projects.no_projects",
                extra={
                    "integration_id": self.model.id,
                    "organization_id": self.organization_id,
                },
            )
            raise IntegrationError(no_projects_error_message)
        return jira_projects

    @all_silo_function
    def get_create_issue_config(self, group: Group | None, user: User, **kwargs):
        """
        We use the `group` to get three things: organization_slug, project
        defaults, and default title and description. In the case where we're
        getting `createIssueConfig` from Jira for Ticket Rules, we don't know
        the issue group beforehand.

        :param group: (Optional) Group model.
        :param user: User model. TODO Make this the first parameter.
        :param kwargs: (Optional) Object
            * params: (Optional) Object
            * params.project: (Optional) Sentry Project object
            * params.issuetype: (Optional) String. The Jira issue type. For
                example: "Bug", "Epic", "Story".
        :return:
        """

        kwargs = kwargs or {}
        kwargs["link_referrer"] = "jira_server_integration"
        params = kwargs.get("params", {})
        fields = []
        defaults = {}
        if group:
            fields = super().get_create_issue_config(group, user, **kwargs)
            defaults = self.get_defaults(group.project, user)

        project_id = params.get("project", defaults.get("project"))
        jira_projects = self.get_projects()

        if not project_id:
            project_id = jira_projects[0]["id"]

        logger.info(
            "get_create_issue_config.start",
            extra={
                "organization_id": self.organization_id,
                "integration_id": self.model.id,
                "num_jira_projects": len(jira_projects),
                "project_id": project_id,
            },
        )

        client = self.get_client()

        project_field = {
            "name": "project",
            "label": "Jira Project",
            "choices": [(p["id"], p["key"]) for p in jira_projects],
            "default": project_id,
            "type": "select",
            "updatesForm": True,
        }

        try:
            issue_type_choices = client.get_issue_types(project_id)
        except ApiError as e:
            logger.info(
                "get_create_issue_config.get_issue_types.error",
                extra={
                    "organization_id": self.organization_id,
                    "integration_id": self.model.id,
                    "num_jira_projects": len(jira_projects),
                    "project_id": project_id,
                    "error_message": str(e),
                },
            )
            # return a form with just the project selector and a special form field to show the error
            return [
                project_field,
                {
                    "name": "error",
                    "type": "blank",
                    "help": "Could not fetch issue creation metadata from Jira Server. Ensure that"
                    " the integration user has access to the requested project.",
                },
            ]

        issue_type_choices_formatted = [
            (choice["id"], choice["name"]) for choice in issue_type_choices["values"]
        ]

        # check if the issuetype was passed as a parameter
        issue_type = params.get("issuetype", defaults.get("issuetype"))
        # make sure default issue type is actually one that is allowed for project
        valid_issue_type = any(
            choice for choice in issue_type_choices["values"] if choice["id"] == issue_type
        )

        if not issue_type or not valid_issue_type:
            # pick the first issue type in the list
            issue_type = issue_type_choices["values"][0]["id"]
        try:
            issue_type_meta = client.get_issue_fields(project_id, issue_type)
        except ApiUnauthorized:
            logger.info(
                "jira_server.get_create_issue_config.unauthorized",
                extra={"organization_id": self.organization_id, "jira_project": project_id},
            )
            raise IntegrationError(
                "Could not fetch issue creation metadata from Jira Server. Ensure that"
                " the integration user has access to the requested project."
            )

        fields = [
            project_field,
            *fields,
            {
                "name": "issuetype",
                "label": "Issue Type",
                "default": issue_type or issue_type_meta["id"],
                "type": "select",
                "choices": issue_type_choices_formatted,
                "updatesForm": True,
                "required": bool(
                    issue_type_choices_formatted
                ),  # required if we have any type choices
            },
        ]

        # title is renamed to summary before sending to Jira
        standard_fields = [f["name"] for f in fields] + ["summary"]
        ignored_fields = set()
        ignored_fields.update(HIDDEN_ISSUE_FIELDS)
        ignored_fields.update(self.get_persisted_ignored_fields())

        # apply ordering to fields based on some known built-in Jira fields.
        # otherwise weird ordering occurs.
        anti_gravity = {
            "priority": (-150, ""),
            "fixVersions": (-125, ""),
            "components": (-100, ""),
            "security": (-50, ""),
        }
        dynamic_fields = [val["fieldId"] for val in issue_type_meta["values"]]
        # Sort based on priority, then field name
        dynamic_fields.sort(key=lambda f: anti_gravity.get(f, (0, f)))

        # Build up some dynamic fields based on what is required.
        for field in dynamic_fields:
            if field in standard_fields or field in [x.strip() for x in ignored_fields]:
                # don't overwrite the fixed fields for the form.
                continue

            field_meta = [value for value in issue_type_meta["values"] if value["fieldId"] == field]
            if len(field_meta) > 0:
                mb_field = self.build_dynamic_field(field_meta[0], group)
                if mb_field:
                    if mb_field["label"] in params.get("ignored", []):
                        continue
                    mb_field["name"] = field
                    fields.append(mb_field)

        for field in fields:
            if field["name"] == "priority":
                # whenever priorities are available, put the available ones in the list.
                # allowedValues for some reason doesn't pass enough info.
                field["choices"] = self.make_choices(client.get_priorities())
                field["default"] = defaults.get("priority", "")
            elif field["name"] == "fixVersions":
                field["choices"] = self.make_choices(client.get_versions(project_id))
            elif field["name"] == "labels":
                field["default"] = defaults.get("labels", "")
            elif field["name"] == "reporter":
                reporter_id = defaults.get("reporter", "")
                if not reporter_id:
                    continue
                try:
                    reporter_info = client.get_user(reporter_id)
                except ApiError as e:
                    logger.info(
                        "jira_server.get_create_issue_config.no-matching-reporter",
                        extra={
                            "integration_id": self.model.id,
                            "organization_id": self.organization_id,
                            "persisted_reporter_id": reporter_id,
                            "error": str(e),
                        },
                    )
                    continue
                reporter_tuple = build_user_choice(reporter_info, client.user_id_field())
                if not reporter_tuple:
                    continue
                reporter_id, reporter_label = reporter_tuple
                field["default"] = reporter_id
                field["choices"] = [(reporter_id, reporter_label)]

        return fields

    def create_issue(self, data, **kwargs):
        """
        Get the (cached) "createmeta" from Jira to use as a "schema". Clean up
        the Jira issue by removing all fields that aren't enumerated by this
        schema. Send this cleaned data to Jira. Finally, make another API call
        to Jira to make sure the issue was created and return basic issue details.

        :param data: JiraServerCreateTicketAction object
        :param kwargs: not used
        :return: simple object with basic Jira issue details
        """
        client = self.get_client()
        cleaned_data = {}
        # protect against mis-configured integration submitting a form without an
        # issuetype assigned.
        issue_type = data.get("issuetype")
        if not issue_type:
            raise IntegrationFormError({"issuetype": ["Issue type is required."]})

        jira_project = data.get("project")
        if not jira_project:
            raise IntegrationFormError({"project": ["Jira project is required"]})

        issue_type_meta = client.get_issue_fields(jira_project, issue_type)
        if not issue_type_meta:
            raise IntegrationInstallationConfigurationError(
                "Could not fetch issue create configuration from Jira."
            )

        user_id_field = client.user_id_field()

        issue_type_fields = issue_type_meta["values"]

        for field in issue_type_fields:
            field_name = field["fieldId"]
            if field_name == "description":
                cleaned_data[field_name] = data[field_name]
                continue
            elif field_name == "summary":
                cleaned_data["summary"] = data["title"]
                continue
            elif field_name == "labels" and "labels" in data:
                labels = [label.strip() for label in data["labels"].split(",") if label.strip()]
                cleaned_data["labels"] = labels
                continue
            if field_name in data.keys():
                v = data.get(field_name)
                if not v:
                    continue

                schema = field.get("schema")
                if schema:
                    if schema.get("type") == "string" and not schema.get("custom"):
                        cleaned_data[field_name] = v
                        continue
                    if schema["type"] == "user" or schema.get("items") == "user":
                        if schema.get("custom") == JIRA_CUSTOM_FIELD_TYPES.get("multiuserpicker"):
                            # custom multi-picker
                            v = [{user_id_field: user_id} for user_id in v]
                        else:
                            v = {user_id_field: v}
                    elif schema["type"] == "issuelink":  # used by Parent field
                        v = {"key": v}
                    elif schema.get("custom") == JIRA_CUSTOM_FIELD_TYPES["epic"]:
                        v = v
                    elif schema.get("custom") == JIRA_CUSTOM_FIELD_TYPES["sprint"]:
                        try:
                            v = int(v)
                        except ValueError:
                            raise IntegrationError(f"Invalid sprint ({v}) specified")
                    elif schema["type"] == "array" and schema.get("items") == "option":
                        v = [{"value": vx} for vx in v]
                    elif schema["type"] == "array" and schema.get("items") == "string":
                        v = [v]
                    elif schema["type"] == "array" and schema.get("items") != "string":
                        v = [{"id": vx} for vx in v]
                    elif schema["type"] == "option":
                        v = {"value": v}
                    elif schema.get("custom") == JIRA_CUSTOM_FIELD_TYPES.get("textarea"):
                        v = v
                    elif (
                        schema["type"] == "number"
                        or schema.get("custom") == JIRA_CUSTOM_FIELD_TYPES["tempo_account"]
                    ):
                        try:
                            if "." in v:
                                v = float(v)
                            else:
                                v = int(v)
                        except ValueError:
                            pass
                    elif (
                        schema.get("type") != "string"
                        or (schema.get("items") and schema.get("items") != "string")
                        or schema.get("custom") == JIRA_CUSTOM_FIELD_TYPES.get("select")
                    ):
                        v = {"id": v}
                cleaned_data[field_name] = v

        if not (
            isinstance(cleaned_data.get("issuetype"), dict)
            and "id" in cleaned_data.get("issuetype", {})
        ):
            # something fishy is going on with this field, working on some Jira
            # instances, and some not.
            # testing against 5.1.5 and 5.1.4 does not convert (perhaps is no longer included
            # in the projectmeta API call, and would normally be converted in the
            # above clean method.)
            cleaned_data["issuetype"] = {"id": issue_type}

        # sometimes the project is missing as well and we need to add it
        if "project" not in cleaned_data:
            cleaned_data["project"] = {"id": jira_project}

        try:
            logger.info(
                "jira_server.create_issue",
                extra={
                    "organization_id": self.organization_id,
                    "integration_id": self.model.id,
                    "jira_project": jira_project,
                    "cleaned_data": cleaned_data,
                },
            )
            response = client.create_issue(cleaned_data)
        except Exception as e:
            self.raise_error(e)

        issue_key = response.get("key")
        if not issue_key:
            raise IntegrationError("There was an error creating the issue.")

        # Immediately fetch and return the created issue.
        return self.get_issue(issue_key)

    def sync_assignee_outbound(
        self,
        external_issue: ExternalIssue,
        user: RpcUser | None,
        assign: bool = True,
        **kwargs: Any,
    ) -> None:
        """
        Propagate a sentry issue's assignee to a jira issue's assignee
        """
        client = self.get_client()
        logging_context = {
            "integration_id": external_issue.integration_id,
            "issue_key": external_issue.key,
        }

        jira_user = None
        if user and assign:
            logging_context["user_id"] = user.id
            logging_context["user_email_count"] = len(user.emails)

            total_queried_jira_users = 0
            total_available_jira_emails = 0
            for ue in user.emails:
                assert ue, "Expected a valid user email, received falsy value"
                try:
                    possible_users = client.search_users_for_issue(external_issue.key, ue)
                except ApiUnauthorized:
                    logger.info(
                        "jira.user-search-unauthorized",
                        extra={
                            **logging_context,
                        },
                    )
                    continue
                except ApiError as e:
                    logger.info(
                        "jira.user-search-request-error",
                        extra={
                            **logging_context,
                            "error": str(e),
                        },
                    )
                    continue

                total_queried_jira_users += len(possible_users)

                if len(possible_users) == 1:
                    # Assume the only user returned is a full match for the email,
                    # as we search by username. This addresses visibility issues
                    # in some cases where Jira server does not populate `emailAddress`
                    # fields on user responses.
                    jira_user = possible_users[0]
                    break

                for possible_user in possible_users:
                    # Continue matching on email address, since we can't guarantee
                    # a clean match.
                    email = possible_user.get("emailAddress")

                    if not email:
                        continue

                    total_available_jira_emails += 1
                    # match on lowercase email
                    if email.lower() == ue.lower():
                        jira_user = possible_user
                        break

            if jira_user is None:
                # TODO(jess): do we want to email people about these types of failures?
                logger.info(
                    "jira.assignee-not-found",
                    extra={
                        **logging_context,
                        "jira_user_count_match": total_queried_jira_users,
                        "total_available_jira_emails": total_available_jira_emails,
                    },
                )
                raise IntegrationError("Failed to assign user to Jira Server issue")

        try:
            id_field = client.user_id_field()
            client.assign_issue(external_issue.key, jira_user and jira_user.get(id_field))
        except ApiUnauthorized:
            logger.info(
                "jira.user-assignment-unauthorized",
                extra={
                    **logging_context,
                },
            )
            raise IntegrationError("Insufficient permissions to assign user to Jira Server issue")
        except ApiError as e:
            logger.info(
                "jira.user-assignment-request-error",
                extra={
                    **logging_context,
                    "error": str(e),
                },
            )
            raise IntegrationError("Failed to assign user to Jira Server issue")

    def sync_status_outbound(
        self, external_issue: ExternalIssue, is_resolved: bool, project_id: int
    ) -> None:
        """
        Propagate a sentry issue's status to a linked issue's status.
        """
        client = self.get_client()
        jira_issue = client.get_issue(external_issue.key)
        jira_project = jira_issue["fields"]["project"]

        external_project = integration_service.get_integration_external_project(
            organization_id=external_issue.organization_id,
            integration_id=external_issue.integration_id,
            external_id=jira_project["id"],
        )
        if not external_project:
            return

        jira_status = (
            external_project.resolved_status if is_resolved else external_project.unresolved_status
        )

        # don't bother updating if it's already the status we'd change it to
        if jira_issue["fields"]["status"]["id"] == jira_status:
            return
        try:
            transitions = client.get_transitions(external_issue.key)
        except ApiHostError:
            raise IntegrationError("Could not reach host to get transitions.")

        try:
            transition = [t for t in transitions if t.get("to", {}).get("id") == jira_status][0]
        except IndexError:
            # TODO(jess): Email for failure
            logger.warning(
                "jira.status-sync-fail",
                extra={
                    "organization_id": external_issue.organization_id,
                    "integration_id": external_issue.integration_id,
                    "issue_key": external_issue.key,
                    "transitions": transitions,
                    "jira_status": jira_status,
                },
            )
            return

        client.transition_issue(external_issue.key, transition["id"])

    def _get_done_statuses(self):
        client = self.get_client()
        statuses = client.get_valid_statuses()
        return {s["id"] for s in statuses if s["statusCategory"]["key"] == "done"}

    def get_resolve_sync_action(self, data: Mapping[str, Any]) -> ResolveSyncAction:
        done_statuses = self._get_done_statuses()
        c_from = data["changelog"]["from"]
        c_to = data["changelog"]["to"]
        return ResolveSyncAction.from_resolve_unresolve(
            should_resolve=c_to in done_statuses and c_from not in done_statuses,
            should_unresolve=c_from in done_statuses and c_to not in done_statuses,
        )

    def after_link_issue(self, external_issue, data=None, **kwargs):
        super().after_link_issue(external_issue, **kwargs)

        if data:
            comment = data.get("comment")
            if comment:
                self.get_client().create_comment(external_issue.key, comment)

    def migrate_issues(self):
        migrate_issues.apply_async(
            kwargs={
                "integration_id": self.model.id,
                "organization_id": self.organization_id,
            }
        )


class JiraServerIntegrationProvider(IntegrationProvider):
    key = "jira_server"
    name = "Jira Server"
    metadata = metadata
    integration_cls = JiraServerIntegration

    needs_default_identity = True

    features = frozenset([IntegrationFeatures.ISSUE_BASIC, IntegrationFeatures.ISSUE_SYNC])

    setup_dialog_config = {"width": 1030, "height": 1000}

    def get_pipeline_views(self) -> list[PipelineView]:
        return [InstallationConfigView(), OAuthLoginView(), OAuthCallbackView()]

    def build_integration(self, state):
        install = state["installation_data"]
        access_token = state["access_token"]

        webhook_secret = sha1_text(install["private_key"]).hexdigest()

        hostname = urlparse(install["url"]).netloc
        external_id = "{}:{}".format(hostname, install["consumer_key"])[:64]

        credentials = {
            "consumer_key": install["consumer_key"],
            "private_key": install["private_key"],
            "access_token": access_token["oauth_token"],
            "access_token_secret": access_token["oauth_token_secret"],
        }
        # Create the webhook before the integration record exists
        # so that if it fails we don't persist a broken integration.
        self.create_webhook(external_id, webhook_secret, install, credentials)

        return {
            "name": install["consumer_key"],
            "provider": "jira_server",
            "external_id": external_id,
            "metadata": {
                "base_url": install["url"],
                "domain_name": hostname,
                "verify_ssl": install["verify_ssl"],
                "webhook_secret": webhook_secret,
            },
            "user_identity": {
                "type": "jira_server",
                "external_id": external_id,
                "scopes": [],
                "data": credentials,
            },
        }

    def create_webhook(self, external_id, webhook_secret, install, credentials):
        client = JiraServerSetupClient(
            install["url"], install["consumer_key"], install["private_key"], install["verify_ssl"]
        )
        try:
            client.create_issue_webhook(external_id, webhook_secret, credentials)
        except ApiError as err:
            logger.info(
                "jira-server.webhook.failed",
                extra={"error": str(err), "external_id": external_id},
            )
            if err.json is None:
                details = ""
            else:
                try:
                    details = next(x for x in err.json["messages"][0].values())
                except (KeyError, TypeError, StopIteration):
                    details = ""
            message = f"Could not create issue webhook in Jira. {details}"
            raise IntegrationError(message)
