from __future__ import absolute_import

import logging
import six
from operator import attrgetter
import re

from django.conf import settings
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext as _

from sentry import features
from sentry.integrations import (
    IntegrationInstallation,
    IntegrationFeatures,
    IntegrationProvider,
    IntegrationMetadata,
    FeatureDescription,
)
from sentry.shared_integrations.exceptions import (
    ApiUnauthorized,
    ApiError,
    IntegrationError,
    IntegrationFormError,
)
from sentry.integrations.issues import IssueSyncMixin
from sentry.models import IntegrationExternalProject, Organization, OrganizationIntegration, User
from sentry.utils.compat import filter
from sentry.utils.http import absolute_uri
from sentry.utils.decorators import classproperty

from .client import JiraApiClient, JiraCloud

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
    issue_url="https://github.com/getsentry/sentry/issues/new?title=Jira%20Integration:%20&labels=Component%3A%20Integrations",
    source_url="https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/jira",
    aspects={"externalInstall": external_install},
)

# hide sprint, epic link, parent and linked issues fields because they don't work
# since sprint and epic link are "custom" we need to search for them by name
HIDDEN_ISSUE_FIELDS = {"keys": ["parent", "issuelinks"], "names": ["Sprint", "Epic Link"]}

# A list of common builtin custom field types for Jira for easy reference.
JIRA_CUSTOM_FIELD_TYPES = {
    "select": "com.atlassian.jira.plugin.system.customfieldtypes:select",
    "textarea": "com.atlassian.jira.plugin.system.customfieldtypes:textarea",
    "multiuserpicker": "com.atlassian.jira.plugin.system.customfieldtypes:multiuserpicker",
    "tempo_account": "com.tempoplugin.tempo-accounts:accounts.customfield",
}


class JiraIntegration(IntegrationInstallation, IssueSyncMixin):
    comment_key = "sync_comments"
    outbound_status_key = "sync_status_forward"
    inbound_status_key = "sync_status_reverse"
    outbound_assignee_key = "sync_forward_assignment"
    inbound_assignee_key = "sync_reverse_assignment"
    issues_ignored_fields_key = "issues_ignored_fields"

    @classproperty
    def use_email_scope(cls):
        return settings.JIRA_USE_EMAIL_SCOPE

    def get_organization_config(self):
        configuration = [
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
                "name": self.issues_ignored_fields_key,
                "label": "Ignored Fields",
                "type": "textarea",
                "placeholder": _('e.g. "components, security, customfield_10006"'),
                "help": _(
                    "Comma-separated list of Jira fields that you don't want to show in issue creation form"
                ),
            },
        ]

        client = self.get_client()

        try:
            statuses = [(c["id"], c["name"]) for c in client.get_valid_statuses()]
            configuration[0]["mappedSelectors"]["on_resolve"]["choices"] = statuses
            configuration[0]["mappedSelectors"]["on_unresolve"]["choices"] = statuses

            projects = [{"value": p["id"], "label": p["name"]} for p in client.get_projects_list()]
            configuration[0]["addDropdown"]["items"] = projects
        except ApiError:
            configuration[0]["disabled"] = True
            configuration[0]["disabledReason"] = _(
                "Unable to communicate with the Jira instance. You may need to reinstall the addon."
            )

        organization = Organization.objects.get(id=self.organization_id)
        has_issue_sync = features.has("organizations:integrations-issue-sync", organization)
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
            ignored_fields_list = filter(
                None, [field.strip() for field in re.split(r"[,\n\r]+", ignored_fields_text)]
            )
            data[self.issues_ignored_fields_key] = ignored_fields_list

        config.update(data)
        self.org_integration.update(config=config)

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
            avatar = (projects[0]["avatarUrls"]["48x48"],)
            self.model.metadata.update({"icon": avatar})

        self.model.save()

    def get_link_issue_config(self, group, **kwargs):
        fields = super(JiraIntegration, self).get_link_issue_config(group, **kwargs)
        org = group.organization
        autocomplete_url = reverse("sentry-extensions-jira-search", args=[org.slug, self.model.id])
        for field in fields:
            if field["name"] == "externalIssue":
                field["url"] = autocomplete_url
                field["type"] = "select"
        return fields

    def get_issue_url(self, key, **kwargs):
        return "%s/browse/%s" % (self.model.metadata["base_url"], key)

    def get_persisted_default_config_fields(self):
        return ["project", "issuetype", "priority", "labels"]

    def get_persisted_user_default_config_fields(self):
        return ["reporter"]

    def get_persisted_ignored_fields(self):
        return self.org_integration.config.get(self.issues_ignored_fields_key, [])

    def get_group_description(self, group, event, **kwargs):
        output = [
            u"Sentry Issue: [{}|{}]".format(
                group.qualified_short_id,
                absolute_uri(group.get_absolute_url(params={"referrer": "jira_integration"})),
            )
        ]
        body = self.get_group_body(group, event)
        if body:
            output.extend(["", "{code}", body, "{code}"])
        return "\n".join(output)

    def get_client(self):
        return JiraApiClient(
            self.model.metadata["base_url"],
            JiraCloud(self.model.metadata["shared_secret"]),
            verify_ssl=True,
            logging_context={
                "org_id": self.organization_id,
                "integration_id": attrgetter("org_integration.integration.id")(self),
                "org_integration_id": attrgetter("org_integration.id")(self),
            },
        )

    def get_issue(self, issue_id, **kwargs):
        client = self.get_client()
        issue = client.get_issue(issue_id)
        return {
            "key": issue_id,
            "title": issue["fields"]["summary"],
            "description": issue["fields"].get("description"),
        }

    def create_comment(self, issue_id, user_id, group_note):
        # https://jira.atlassian.com/secure/WikiRendererHelpAction.jspa?section=texteffects
        comment = group_note.data["text"]
        quoted_comment = self.create_comment_attribution(user_id, comment)
        return self.get_client().create_comment(issue_id, quoted_comment)

    def create_comment_attribution(self, user_id, comment_text):
        user = User.objects.get(id=user_id)
        attribution = "%s wrote:\n\n" % user.name
        return "%s{quote}%s{quote}" % (attribution, comment_text)

    def update_comment(self, issue_id, user_id, group_note):
        quoted_comment = self.create_comment_attribution(user_id, group_note.data["text"])
        return self.get_client().update_comment(
            issue_id, group_note.data["external_id"], quoted_comment
        )

    def search_issues(self, query):
        try:
            return self.get_client().search_issues(query)
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
            message += " ".join(["%s: %s" % (k, v) for k, v in data.get("errors").items()])
        return message

    def error_fields_from_json(self, data):
        errors = data.get("errors")
        if not errors:
            return None

        return {key: [error] for key, error in data.get("errors").items()}

    def search_url(self, org_slug):
        """
        Hook method that varies in Jira Server
        """
        return reverse("sentry-extensions-jira-search", args=[org_slug, self.model.id])

    def build_dynamic_field(self, group, field_meta):
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
        elif field_meta.get("autoCompleteUrl") and (
            schema.get("items") == "user" or schema["type"] == "user"
        ):
            fieldtype = "select"
            fkwargs["url"] = self.search_url(group.organization.slug)
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
        if project_id:
            return self.fetch_issue_create_meta(client, project_id)

        # If we don't have a jira projectid, iterate all projects and find
        # the first project that has metadata. We only want one project as getting
        # all project metadata is expensive and wasteful. In the first run experience,
        # the user won't have a 'last used' project id so we need to iterate available
        # projects until we find one that we can get metadata for.
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
            jira_project_ids = ",".join([project["key"] for project in jira_projects])

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
                    "error": six.text_type(e),
                },
            )
            raise IntegrationError(
                "There was an error communicating with the Jira API. "
                "Please try again or contact support."
            )
        return meta

    def get_create_issue_config(self, group, user, **kwargs):
        kwargs["link_referrer"] = "jira_integration"
        fields = super(JiraIntegration, self).get_create_issue_config(group, user, **kwargs)
        params = kwargs.get("params", {})

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
                    "error": six.text_type(e),
                },
            )
            raise IntegrationError(
                "Could not fetch project list from Jira"
                "Ensure that jira is available and your account is still active."
            )

        meta = self.get_issue_create_meta(client, project_id, jira_projects)
        if not meta:
            raise IntegrationError(
                "Could not fetch issue create metadata from Jira. "
                "Ensure that the integration user has access to the requested project."
            )

        # check if the issuetype was passed as a parameter
        issue_type = params.get("issuetype", defaults.get("issuetype"))
        issue_type_meta = self.get_issue_type_meta(issue_type, meta)
        issue_type_choices = self.make_choices(meta["issuetypes"])

        # make sure default issue type is actually
        # one that is allowed for project
        if issue_type:
            if not any((c for c in issue_type_choices if c[0] == issue_type)):
                issue_type = issue_type_meta["id"]

        fields = (
            [
                {
                    "name": "project",
                    "label": "Jira Project",
                    "choices": [(p["id"], p["key"]) for p in jira_projects],
                    "default": meta["id"],
                    "type": "select",
                    "updatesForm": True,
                }
            ]
            + fields
            + [
                {
                    "name": "issuetype",
                    "label": "Issue Type",
                    "default": issue_type or issue_type_meta["id"],
                    "type": "select",
                    "choices": issue_type_choices,
                    "updatesForm": True,
                    "required": bool(issue_type_choices),  # required if we have any type choices
                }
            ]
        )

        # title is renamed to summary before sending to Jira
        standard_fields = [f["name"] for f in fields] + ["summary"]
        ignored_fields = set(
            k
            for k, v in six.iteritems(issue_type_meta["fields"])
            if v["name"] in HIDDEN_ISSUE_FIELDS["names"]
        )
        ignored_fields.update(HIDDEN_ISSUE_FIELDS["keys"])
        ignored_fields.update(self.get_persisted_ignored_fields())

        # apply ordering to fields based on some known built-in Jira fields.
        # otherwise weird ordering occurs.
        anti_gravity = {"priority": -150, "fixVersions": -125, "components": -100, "security": -50}

        dynamic_fields = list(issue_type_meta["fields"].keys())
        dynamic_fields.sort(key=lambda f: anti_gravity.get(f) or 0)

        # build up some dynamic fields based on required shit.
        for field in dynamic_fields:
            if field in standard_fields or field in [x.strip() for x in ignored_fields]:
                # don't overwrite the fixed fields for the form.
                continue
            mb_field = self.build_dynamic_field(group, issue_type_meta["fields"][field])
            if mb_field:
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
                except ApiError as exc:
                    self.get_logger().exception(six.text_type(exc))
                    continue
                reporter_tuple = client.format_user(reporter_info)
                if not reporter_tuple:
                    continue
                reporter_id, reporter_label = reporter_tuple
                field["default"] = reporter_id
                field["choices"] = [(reporter_id, reporter_label)]

        return fields

    def create_issue(self, data, **kwargs):
        client = self.get_client()
        cleaned_data = {}
        # protect against mis-configured integration submitting a form without an
        # issuetype assigned.
        if not data.get("issuetype"):
            raise IntegrationFormError({"issuetype": ["Issue type is required."]})

        jira_project = data.get("project")
        if not jira_project:
            raise IntegrationFormError({"project": ["Jira project is required"]})

        meta = client.get_create_meta_for_project(jira_project)
        if not meta:
            raise IntegrationError("Could not fetch issue create configuration from Jira.")

        issue_type_meta = self.get_issue_type_meta(data["issuetype"], meta)
        user_id_field = client.user_id_field()

        fs = issue_type_meta["fields"]
        for field in fs.keys():
            f = fs[field]
            if field == "description":
                cleaned_data[field] = data[field]
                continue
            elif field == "summary":
                cleaned_data["summary"] = data["title"]
                continue
            elif field == "labels" and "labels" in data:
                labels = [label.strip() for label in data["labels"].split(",") if label.strip()]
                cleaned_data["labels"] = labels
                continue
            if field in data.keys():
                v = data.get(field)
                if not v:
                    continue

                schema = f.get("schema")
                if schema:
                    if schema.get("type") == "string" and not schema.get("custom"):
                        cleaned_data[field] = v
                        continue
                    if schema["type"] == "user" or schema.get("items") == "user":
                        v = {user_id_field: v}
                    elif schema.get("custom") == JIRA_CUSTOM_FIELD_TYPES.get("multiuserpicker"):
                        # custom multi-picker
                        v = [{user_id_field: v}]
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
                cleaned_data[field] = v

        if not (isinstance(cleaned_data["issuetype"], dict) and "id" in cleaned_data["issuetype"]):
            # something fishy is going on with this field, working on some Jira
            # instances, and some not.
            # testing against 5.1.5 and 5.1.4 does not convert (perhaps is no longer included
            # in the projectmeta API call, and would normally be converted in the
            # above clean method.)
            cleaned_data["issuetype"] = {"id": cleaned_data["issuetype"]}

        try:
            response = client.create_issue(cleaned_data)
        except Exception as e:
            self.raise_error(e)

        issue_key = response.get("key")
        if not issue_key:
            raise IntegrationError("There was an error creating the issue.")

        issue = client.get_issue(issue_key)

        return {
            "title": issue["fields"]["summary"],
            "description": issue["fields"]["description"],
            "key": issue_key,
        }

    def sync_assignee_outbound(self, external_issue, user, assign=True, **kwargs):
        """
        Propagate a sentry issue's assignee to a jira issue's assignee
        """
        client = self.get_client()

        jira_user = None
        if assign:
            for ue in user.emails.filter(is_verified=True):
                try:
                    possible_users = client.search_users_for_issue(external_issue.key, ue.email)
                except (ApiUnauthorized, ApiError):
                    continue
                for possible_user in possible_users:
                    email = possible_user.get("emailAddress")
                    # pull email from API if we can use it
                    if not email and self.use_email_scope:
                        account_id = possible_user.get("accountId")
                        email = client.get_email(account_id)
                    # match on lowercase email
                    # TODO(steve): add check against display name when JIRA_USE_EMAIL_SCOPE is false
                    if email and email.lower() == ue.email.lower():
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
                    "user_id": user.id,
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

        try:
            external_project = IntegrationExternalProject.objects.get(
                external_id=jira_project["id"],
                organization_integration_id__in=OrganizationIntegration.objects.filter(
                    organization_id=external_issue.organization_id,
                    integration_id=external_issue.integration_id,
                ),
            )
        except IntegrationExternalProject.DoesNotExist:
            return

        jira_status = (
            external_project.resolved_status if is_resolved else external_project.unresolved_status
        )

        # don't bother updating if it's already the status we'd change it to
        if jira_issue["fields"]["status"]["id"] == jira_status:
            return

        transitions = client.get_transitions(external_issue.key)

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
                },
            )
            return

        client.transition_issue(external_issue.key, transition["id"])

    def _get_done_statuses(self):
        client = self.get_client()
        statuses = client.get_valid_statuses()
        return {s["id"] for s in statuses if s["statusCategory"]["key"] == "done"}

    def should_unresolve(self, data):
        done_statuses = self._get_done_statuses()
        c_from = data["changelog"]["from"]
        c_to = data["changelog"]["to"]
        return c_from in done_statuses and c_to not in done_statuses

    def should_resolve(self, data):
        done_statuses = self._get_done_statuses()
        c_from = data["changelog"]["from"]
        c_to = data["changelog"]["to"]
        return c_to in done_statuses and c_from not in done_statuses


class JiraIntegrationProvider(IntegrationProvider):
    key = "jira"
    name = "Jira"
    metadata = metadata
    integration_cls = JiraIntegration

    features = frozenset([IntegrationFeatures.ISSUE_BASIC, IntegrationFeatures.ISSUE_SYNC])

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
