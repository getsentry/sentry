from __future__ import annotations

import logging
import re
from collections.abc import Mapping, Sequence
from operator import attrgetter
from typing import Any

import sentry_sdk
from django.conf import settings
from django.urls import reverse
from django.utils.functional import classproperty
from django.utils.translation import gettext as _

from sentry import features
from sentry.eventstore.models import GroupEvent
from sentry.integrations.base import (
    FeatureDescription,
    IntegrationFeatures,
    IntegrationMetadata,
    IntegrationProvider,
)
from sentry.integrations.jira.models.create_issue_metadata import JiraIssueTypeMetadata
from sentry.integrations.jira.tasks import migrate_issues
from sentry.integrations.mixins.issues import MAX_CHAR, IssueSyncIntegration, ResolveSyncAction
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration_external_project import IntegrationExternalProject
from sentry.integrations.services.integration import integration_service
from sentry.issues.grouptype import GroupCategory
from sentry.models.group import Group
from sentry.organizations.services.organization.service import organization_service
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiHostError,
    ApiRateLimitedError,
    ApiUnauthorized,
    IntegrationError,
    IntegrationFormError,
    IntegrationInstallationConfigurationError,
)
from sentry.silo.base import all_silo_function
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service
from sentry.utils.strings import truncatechars

from .client import JiraCloudClient
from .models.create_issue_metadata import JIRA_CUSTOM_FIELD_TYPES
from .utils import build_user_choice
from .utils.create_issue_schema_transformers import transform_fields

logger = logging.getLogger("sentry.integrations.jira")

DESCRIPTION = """
Connect your Sentry organization into one or more of your Jira cloud instances.
Get started streamlining your bug squashing workflow by unifying your Sentry and
Jira instances together.
"""

FEATURE_DESCRIPTIONS = [
    FeatureDescription(
        """
        Create and link Sentry issue groups directly to a Jira ticket in any of your
        projects, providing a quick way to jump from a Sentry bug to tracked ticket!
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

INSTALL_NOTICE_TEXT = """
Visit the Jira Marketplace to install this integration. After installing the
Sentry add-on, access the settings panel in your Jira instance to enable the
integration for this Organization.
"""

external_install = {
    "url": "https://marketplace.atlassian.com/apps/1219432/sentry-for-jira",
    "buttonText": _("Jira Marketplace"),
    "noticeText": _(INSTALL_NOTICE_TEXT.strip()),
}

metadata = IntegrationMetadata(
    description=_(DESCRIPTION.strip()),
    features=FEATURE_DESCRIPTIONS,
    author="The Sentry Team",
    noun=_("Instance"),
    issue_url="https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Jira%20Integration%20Problem",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/jira",
    aspects={"externalInstall": external_install},
)

# Some Jira errors for invalid field values don't actually provide the field
# ID in an easily mappable way, so we have to manually map known error types
# here to make it explicit to the user what failed.
CUSTOM_ERROR_MESSAGE_MATCHERS = [(re.compile("Team with id '.*' not found.$"), "Team Field")]

# Hide linked issues fields because we don't have the necessary UI for fully specifying
# a valid link (e.g. "is blocked by ISSUE-1").
HIDDEN_ISSUE_FIELDS = ["issuelinks"]


class JiraIntegration(IssueSyncIntegration):
    comment_key = "sync_comments"
    outbound_status_key = "sync_status_forward"
    inbound_status_key = "sync_status_reverse"
    outbound_assignee_key = "sync_forward_assignment"
    inbound_assignee_key = "sync_reverse_assignment"
    issues_ignored_fields_key = "issues_ignored_fields"
    resolution_strategy_key = "resolution_strategy"

    @classproperty
    def use_email_scope(cls):
        return settings.JIRA_USE_EMAIL_SCOPE

    def get_organization_config(self) -> list[dict[str, Any]]:
        configuration: list[dict[str, Any]] = self._get_organization_config_default_values()

        client = self.get_client()

        try:
            # Query the project mappings configured for this Jira integration installation.
            project_mappings = IntegrationExternalProject.objects.filter(
                organization_integration_id=self.org_integration.id
            )
            configured_projects = [
                {"value": p.external_id, "label": p.name} for p in project_mappings
            ]
            self._set_status_choices_in_organization_config(configuration, configured_projects)
            projects = [{"value": p["id"], "label": p["name"]} for p in client.get_projects_list()]
            configuration[0]["addDropdown"]["items"] = projects
        except ApiError:
            configuration[0]["disabled"] = True
            configuration[0]["disabledReason"] = _(
                "Unable to communicate with the Jira instance. You may need to reinstall the addon."
            )

        context = organization_service.get_organization_by_id(
            id=self.organization_id, include_projects=False, include_teams=False
        )
        organization = context.organization

        has_issue_sync = features.has("organizations:integrations-issue-sync", organization)
        if not has_issue_sync:
            for field in configuration:
                field["disabled"] = True
                field["disabledReason"] = _(
                    "Your organization does not have access to this feature"
                )

        return configuration

    def _set_status_choices_in_organization_config(
        self, configuration: dict[str, Any], projects: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Set the status choices in the provided organization config.
        This will mutate the provided config object and replace the existing
        mappedSelectors field with the status choices.

        Optionally, if the organization has the feature flag
        organizations:jira-per-project-statuses enabled, we will set the status
        choices per-project for the organization.
        """
        client = self.get_client()

        if features.has("organizations:jira-per-project-statuses", self.organization):
            try:
                for project in projects:
                    project_id = project["value"]
                    project_statuses = client.get_project_statuses(project_id).get("values", [])
                    logger.info(
                        "jira.get-project-statuses.success",
                        extra={
                            "org_id": self.organization_id,
                            "project_id": project_id,
                            "project_statuses": project_statuses,
                        },
                    )
                    statuses = [(c["id"], c["name"]) for c in project_statuses]
                    configuration[0]["mappedSelectors"][project_id] = {
                        "on_resolve": {"choices": statuses},
                        "on_unresolve": {"choices": statuses},
                    }

                configuration[0]["perItemMapping"] = True

                return configuration
            except ApiError as e:
                if isinstance(e, ApiRateLimitedError):
                    logger.info(
                        "jira.get-project-statuses.rate-limited",
                        extra={"org_id": self.organization_id},
                    )
                else:
                    raise

        # Fallback logic to the global statuses per project. This may occur if
        # there are too many projects we need to fetch.
        statuses = [(c["id"], c["name"]) for c in client.get_valid_statuses()]
        configuration[0]["mappedSelectors"]["on_resolve"]["choices"] = statuses
        configuration[0]["mappedSelectors"]["on_unresolve"]["choices"] = statuses

        return configuration

    def _get_organization_config_default_values(self) -> list[dict[str, Any]]:
        return [
            {
                "name": self.outbound_status_key,
                "type": "choice_mapper",
                "label": _("Sync Sentry Status to Jira"),
                "help": _(
                    "When a Sentry issue changes status, change the status of the linked ticket in Jira."
                ),
                "addButtonText": _("Add Jira Project"),
                "addDropdown": {
                    "emptyMessage": _("All projects configured"),
                    "noResultsMessage": _("Could not find Jira project"),
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
                "mappedColumnLabel": _("Jira Project"),
                "formatMessageValue": False,
            },
            {
                "name": self.outbound_assignee_key,
                "type": "boolean",
                "label": _("Sync Sentry Assignment to Jira"),
                "help": _(
                    "When an issue is assigned in Sentry, assign its linked Jira ticket to the same user."
                ),
            },
            {
                "name": self.comment_key,
                "type": "boolean",
                "label": _("Sync Sentry Comments to Jira"),
                "help": _("Post comments from Sentry issues to linked Jira tickets"),
            },
            {
                "name": self.inbound_status_key,
                "type": "boolean",
                "label": _("Sync Jira Status to Sentry"),
                "help": _(
                    "When a Jira ticket is marked done, resolve its linked issue in Sentry. "
                    "When a Jira ticket is removed from being done, unresolve its linked Sentry issue."
                ),
            },
            {
                "name": self.inbound_assignee_key,
                "type": "boolean",
                "label": _("Sync Jira Assignment to Sentry"),
                "help": _(
                    "When a ticket is assigned in Jira, assign its linked Sentry issue to the same user."
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
        self.org_integration = integration_service.update_organization_integration(
            org_integration_id=self.org_integration.id,
            config=config,
        )

    def get_config_data(self):
        config = self.org_integration.config
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
        config[self.issues_ignored_fields_key] = ", ".join(
            config.get(self.issues_ignored_fields_key, "")
        )
        return config

    def sync_metadata(self):
        client = self.get_client()

        server_info = {}
        projects = []
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

        self.model.save()

    def get_link_issue_config(self, group, **kwargs):
        fields = super().get_link_issue_config(group, **kwargs)
        org = group.organization
        autocomplete_url = reverse("sentry-extensions-jira-search", args=[org.slug, self.model.id])
        for field in fields:
            if field["name"] == "externalIssue":
                field["url"] = autocomplete_url
                field["type"] = "select"
        return fields

    def get_issue_url(self, key: str) -> str:
        return "{}/browse/{}".format(self.model.metadata["base_url"], key)

    def get_persisted_default_config_fields(self) -> Sequence[str]:
        return ["project", "issuetype", "priority", "labels"]

    def get_persisted_user_default_config_fields(self):
        return ["reporter"]

    def get_persisted_ignored_fields(self):
        return self.org_integration.config.get(self.issues_ignored_fields_key, [])

    def get_feedback_issue_body(self, event):
        messages = [
            evidence for evidence in event.occurrence.evidence_display if evidence.name == "message"
        ]
        others = [
            evidence for evidence in event.occurrence.evidence_display if evidence.name != "message"
        ]

        body = ""
        for message in messages:
            body += message.value
            body += "\n\n"

        for evidence in sorted(others, key=attrgetter("important"), reverse=True):
            body += f"| *{evidence.name}* | {evidence.value} |\n"

        return body.rstrip("\n")  # remove the last new line

    def get_generic_issue_body(self, event):
        body = ""
        important = event.occurrence.important_evidence_display
        if important:
            body = f"| *{important.name}* | {truncatechars(important.value, MAX_CHAR)} |\n"
        for evidence in event.occurrence.evidence_display:
            if evidence.important is False:
                body += f"| *{evidence.name}* | {truncatechars(evidence.value, MAX_CHAR)} |\n"
        return body[:-2]  # chop off final newline

    def get_group_description(self, group, event, **kwargs):
        output = []
        if group.issue_category == GroupCategory.FEEDBACK:
            output = [
                "Sentry Feedback: [{}|{}]\n".format(
                    group.qualified_short_id,
                    group.get_absolute_url(params={"referrer": "jira_integration"}),
                )
            ]
        else:
            output = [
                "Sentry Issue: [{}|{}]".format(
                    group.qualified_short_id,
                    group.get_absolute_url(params={"referrer": "jira_integration"}),
                )
            ]

        if isinstance(event, GroupEvent) and event.occurrence is not None:
            body = ""
            if group.issue_category == GroupCategory.FEEDBACK:
                body = self.get_feedback_issue_body(event)
            else:
                body = self.get_generic_issue_body(event)
            output.extend([body])
        else:
            body = self.get_group_body(group, event)
            if body:
                output.extend(["", "{code}", body, "{code}"])
        return "\n".join(output)

    def get_client(self):
        logging_context = {"org_id": self.organization_id}

        if self.organization_id is not None:
            logging_context["integration_id"] = attrgetter("org_integration.integration_id")(self)
            logging_context["org_integration_id"] = attrgetter("org_integration.id")(self)

        return JiraCloudClient(
            integration=self.model,
            verify_ssl=True,
            logging_context=logging_context,
        )

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

    def create_comment_attribution(self, user_id, comment_text):
        user = user_service.get_user(user_id=user_id)
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
        error_messages = data.get("errorMessages")

        if not errors and not error_messages:
            return None

        error_data = {}
        if error_messages:
            # These may or may not contain field specific errors, so we manually
            # map them
            for message in error_messages:
                for error_regex, key in CUSTOM_ERROR_MESSAGE_MATCHERS:
                    if error_regex.match(message):
                        error_data[key] = [message]

        if errors:
            for key, error in data.get("errors").items():
                error_data[key] = [error]

        if not error_data:
            return None

        return error_data

    def search_url(self, org_slug):
        """
        Hook method that varies in Jira Server
        """
        return reverse("sentry-extensions-jira-search", args=[org_slug, self.model.id])

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
            and (
                schema.get("items") == "user"
                or schema["type"] == "user"
                or schema["type"] == "team"
                or schema.get("items") == "team"
            )
            # Sprint and "Epic Link" fields
            or schema.get("custom")
            in (JIRA_CUSTOM_FIELD_TYPES["sprint"], JIRA_CUSTOM_FIELD_TYPES["epic"])
            # Parent field
            or schema["type"] == "issuelink"
        ):
            fieldtype = "select"
            organization = (
                group.organization
                if group
                else organization_service.get_organization_by_id(
                    id=self.organization_id, include_projects=False, include_teams=False
                ).organization
            )
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

    def get_issue_type_meta(self, issue_type, meta):
        self.parse_jira_issue_metadata(meta)
        issue_types = meta["issuetypes"]
        issue_type_meta = None
        if issue_type:
            matching_type = [t for t in issue_types if t["id"] == issue_type]
            issue_type_meta = matching_type[0] if len(matching_type) > 0 else None

        # still no issue type? just use the first one.
        if not issue_type_meta:
            issue_type_meta = issue_types[0]

        return issue_type_meta

    def get_issue_create_meta(self, client, project_id, jira_projects):
        meta = None
        if project_id:
            meta = self.fetch_issue_create_meta(client, project_id)
        if meta is not None:
            return meta

        # If we don't have a jira projectid (or we couldn't fetch the metadata from the given project_id),
        # iterate all projects and find the first project that has metadata.
        # We only want one project as getting all project metadata is expensive and wasteful.
        # In the first run experience, the user won't have a 'last used' project id
        # so we need to iterate available projects until we find one that we can get metadata for.
        attempts = 0
        if len(jira_projects):
            for fallback in jira_projects:
                attempts += 1
                meta = self.fetch_issue_create_meta(client, fallback["id"])
                if meta:
                    logger.info(
                        "jira.get-issue-create-meta.attempts",
                        extra={"organization_id": self.organization_id, "attempts": attempts},
                    )
                    return meta

        jira_project_ids = "no projects"
        if len(jira_projects):
            jira_project_ids = ",".join(project["key"] for project in jira_projects)

        logger.info(
            "jira.get-issue-create-meta.no-metadata",
            extra={
                "organization_id": self.organization_id,
                "attempts": attempts,
                "jira_projects": jira_project_ids,
            },
        )
        raise IntegrationError(
            "Could not get issue create metadata for any Jira projects. "
            "Ensure that your project permissions are correct."
        )

    def fetch_issue_create_meta(self, client, project_id):
        try:
            meta = client.get_create_meta_for_project(project_id)
        except ApiUnauthorized:
            logger.info(
                "jira.fetch-issue-create-meta.unauthorized",
                extra={"organization_id": self.organization_id, "jira_project": project_id},
            )
            raise IntegrationError(
                "Jira returned: Unauthorized. " "Please check your configuration settings."
            )
        except ApiError as e:
            logger.info(
                "jira.fetch-issue-create-meta.error",
                extra={
                    "integration_id": self.model.id,
                    "organization_id": self.organization_id,
                    "jira_project": project_id,
                    "error": str(e),
                },
            )
            raise IntegrationError(
                "There was an error communicating with the Jira API. "
                "Please try again or contact support."
            )
        return meta

    @all_silo_function
    def get_create_issue_config(self, group: Group | None, user: RpcUser, **kwargs):
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
        kwargs["link_referrer"] = "jira_integration"
        params = kwargs.get("params", {})
        fields = []
        defaults = {}
        if group:
            fields = super().get_create_issue_config(group, user, **kwargs)
            defaults = self.get_defaults(group.project, user)

        project_id = params.get("project", defaults.get("project"))
        client = self.get_client()
        try:
            jira_projects = client.get_projects_list()
        except ApiError as e:
            logger.info(
                "jira.get-create-issue-config.no-projects",
                extra={
                    "integration_id": self.model.id,
                    "organization_id": self.organization_id,
                    "error": str(e),
                },
            )
            raise IntegrationError(
                "Could not fetch project list from Jira. Ensure that Jira is"
                " available and your account is still active."
            )

        meta = self.get_issue_create_meta(client, project_id, jira_projects)
        if not meta:
            raise IntegrationError(
                "Could not fetch issue create metadata from Jira. Ensure that"
                " the integration user has access to the requested project."
            )

        # check if the issuetype was passed as a parameter
        issue_type = params.get("issuetype", defaults.get("issuetype"))
        issue_type_meta = self.get_issue_type_meta(issue_type, meta)
        issue_type_choices = self.make_choices(meta["issuetypes"])

        # make sure default issue type is actually
        # one that is allowed for project
        if issue_type:
            if not any(c for c in issue_type_choices if c[0] == issue_type):
                issue_type = issue_type_meta["id"]

        fields = [
            {
                "name": "project",
                "label": "Jira Project",
                "choices": [(p["id"], p["key"]) for p in jira_projects],
                "default": meta["id"],
                "type": "select",
                "updatesForm": True,
            },
            *fields,
            {
                "name": "issuetype",
                "label": "Issue Type",
                "default": issue_type or issue_type_meta["id"],
                "type": "select",
                "choices": issue_type_choices,
                "updatesForm": True,
                "required": bool(issue_type_choices),  # required if we have any type choices
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

        dynamic_fields = list(issue_type_meta["fields"].keys())
        # Sort based on priority, then field name
        dynamic_fields.sort(key=lambda f: anti_gravity.get(f, (0, f)))

        # Build up some dynamic fields based on what is required.
        for field in dynamic_fields:
            if field in standard_fields or field in [x.strip() for x in ignored_fields]:
                # don't overwrite the fixed fields for the form.
                continue

            mb_field = self.build_dynamic_field(issue_type_meta["fields"][field], group)
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
                field["choices"] = self.make_choices(client.get_versions(meta["key"]))
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
                        "jira.get-create-issue-config.no-matching-reporter",
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

    def _clean_and_transform_issue_data(
        self, issue_metadata: JiraIssueTypeMetadata, data: dict[str, Any]
    ) -> Any:
        client = self.get_client()
        transformed_data = transform_fields(
            client.user_id_field(), issue_metadata.fields.values(), **data
        )
        return transformed_data

    def create_issue(self, data, **kwargs):
        client = self.get_client()
        # protect against mis-configured integration submitting a form without an
        # issuetype assigned.
        if not data.get("issuetype"):
            raise IntegrationFormError({"issuetype": ["Issue type is required."]})

        jira_project = data.get("project")
        if not jira_project:
            raise IntegrationFormError({"project": ["Jira project is required"]})

        meta = client.get_create_meta_for_project(jira_project)
        if not meta:
            raise IntegrationInstallationConfigurationError(
                "Could not fetch issue create configuration from Jira."
            )

        issue_type_meta = self.get_issue_type_meta(data["issuetype"], meta)
        cleaned_data = self._clean_and_transform_issue_data(
            JiraIssueTypeMetadata.from_dict(issue_type_meta), data
        )

        try:
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
        jira_user = None
        if user and assign:
            for ue in user.emails:
                try:
                    possible_users = client.search_users_for_issue(external_issue.key, ue)
                except (ApiUnauthorized, ApiError):
                    continue
                for possible_user in possible_users:
                    email = possible_user.get("emailAddress")
                    # pull email from API if we can use it
                    if not email and self.use_email_scope:
                        account_id = possible_user.get("accountId")
                        email = client.get_email(account_id)
                    # match on lowercase email
                    if email and email.lower() == ue.lower():
                        jira_user = possible_user
                        break
            if jira_user is None:
                # TODO(jess): do we want to email people about these types of failures?
                logger.info(
                    "jira.assignee-not-found",
                    extra={
                        "integration_id": external_issue.integration_id,
                        "user_id": user.id,
                        "issue_key": external_issue.key,
                    },
                )
                return
        try:
            id_field = client.user_id_field()
            client.assign_issue(external_issue.key, jira_user and jira_user.get(id_field))
        except (ApiUnauthorized, ApiError):
            # TODO(jess): do we want to email people about these types of failures?
            logger.info(
                "jira.failed-to-assign",
                extra={
                    "organization_id": external_issue.organization_id,
                    "integration_id": external_issue.integration_id,
                    "user_id": user.id if user else None,
                    "issue_key": external_issue.key,
                },
            )

    def sync_status_outbound(self, external_issue, is_resolved, project_id, **kwargs):
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
        log_context = {
            "integration_id": external_issue.integration_id,
            "is_resolved": is_resolved,
            "issue_key": external_issue.key,
        }
        if not external_project:
            logger.info("jira.external-project-not-found", extra=log_context)
            return

        jira_status = (
            external_project.resolved_status if is_resolved else external_project.unresolved_status
        )

        # don't bother updating if it's already the status we'd change it to
        if jira_issue["fields"]["status"]["id"] == jira_status:
            logger.info("jira.sync_status_outbound.unchanged", extra=log_context)
            return
        try:
            transitions = client.get_transitions(external_issue.key)
        except ApiHostError:
            raise IntegrationError("Could not reach host to get transitions.")

        try:
            transition = [t for t in transitions if t.get("to", {}).get("id") == jira_status][0]
        except IndexError:
            # TODO(jess): Email for failure
            logger.warning("jira.status-sync-fail", extra=log_context)
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

    def migrate_issues(self):
        migrate_issues.apply_async(
            kwargs={
                "integration_id": self.model.id,
                "organization_id": self.organization_id,
            }
        )

    def parse_jira_issue_metadata(
        self, meta: dict[str, Any]
    ) -> dict[str, JiraIssueTypeMetadata] | None:
        try:
            return JiraIssueTypeMetadata.from_jira_meta_config(meta)
        except Exception as e:
            sentry_sdk.capture_exception(e)
            return None


class JiraIntegrationProvider(IntegrationProvider):
    key = "jira"
    name = "Jira"
    metadata = metadata
    integration_cls = JiraIntegration

    # Jira is region-restricted because the JiraSentryIssueDetailsView view does not currently
    # contain organization-identifying information aside from the ExternalIssue. Multiple regions
    # may contain a matching ExternalIssue and we could leak data across the organizations.
    is_region_restricted = True

    features = frozenset(
        [
            IntegrationFeatures.ISSUE_BASIC,
            IntegrationFeatures.ISSUE_SYNC,
            IntegrationFeatures.TICKET_RULES,
        ]
    )

    can_add = False

    def get_pipeline_views(self):
        return []

    def build_integration(self, state):
        # Most information is not available during integration installation,
        # since the integration won't have been fully configured on JIRA's side
        # yet, we can't make API calls for more details like the server name or
        # Icon.
        # two ways build_integration can be called
        if state.get("jira"):
            metadata = state["jira"]["metadata"]
            external_id = state["jira"]["external_id"]
        else:
            external_id = state["clientKey"]
            metadata = {
                "oauth_client_id": state["oauthClientId"],
                # public key is possibly deprecated, so we can maybe remove this
                "public_key": state["publicKey"],
                "shared_secret": state["sharedSecret"],
                "base_url": state["baseUrl"],
                "domain_name": state["baseUrl"].replace("https://", ""),
            }
        return {
            "external_id": external_id,
            "provider": "jira",
            "name": "JIRA",
            "metadata": metadata,
        }
