from __future__ import absolute_import

import six
from mistune import markdown

from collections import OrderedDict
from django.core.urlresolvers import reverse
from django.utils.translation import ugettext as _

from sentry.models import IntegrationExternalProject, OrganizationIntegration, User
from sentry.integrations.issues import IssueSyncMixin
from sentry.shared_integrations.exceptions import ApiUnauthorized, ApiError


class VstsIssueSync(IssueSyncMixin):
    description = "Integrate Azure DevOps work items by linking a project."
    slug = "vsts"
    conf_key = slug

    issue_fields = frozenset(["id", "title", "url"])
    done_categories = frozenset(["Resolved", "Completed"])

    def get_persisted_default_config_fields(self):
        return ["project", "work_item_type"]

    def create_default_repo_choice(self, default_repo):
        # default_repo should be the project_id
        project = self.get_client().get_project(self.instance, default_repo)
        return (project["id"], project["name"])

    def get_project_choices(self, group, **kwargs):
        client = self.get_client()
        try:
            projects = client.get_projects(self.instance)
        except (ApiError, ApiUnauthorized, KeyError) as e:
            self.raise_error(e)

        project_choices = [(project["id"], project["name"]) for project in projects]

        params = kwargs.get("params", {})
        defaults = self.get_project_defaults(group.project_id)
        try:
            default_project = params.get(
                "project", defaults.get("project") or project_choices[0][0]
            )
        except IndexError:
            return None, project_choices

        # If a project has been selected outside of the default list of
        # projects, stick it onto the front of the list so that it can be
        # selected.
        try:
            next(True for r in project_choices if r[0] == default_project)
        except StopIteration:
            try:
                project_choices.insert(0, self.create_default_repo_choice(default_project))
            except (ApiError, ApiUnauthorized):
                return None, project_choices

        return default_project, project_choices

    def get_work_item_choices(self, project, group):
        client = self.get_client()
        try:
            item_categories = client.get_work_item_categories(self.instance, project)["value"]
        except (ApiError, ApiUnauthorized, KeyError) as e:
            self.raise_error(e)

        # we want to maintain ordering of the items
        item_type_map = OrderedDict()
        for item in item_categories:
            for item_type_object in item["workItemTypes"]:
                # the type is the last part of the url
                item_type = item_type_object["url"].split("/")[-1]
                # we can have duplicates so need to dedupe
                if item_type not in item_type_map:
                    item_type_map[item_type] = item_type_object["name"]

        item_tuples = list(item_type_map.items())

        # try to get the default from either the last value used or from the first item on the list
        defaults = self.get_project_defaults(group.project_id)
        try:
            default_item_type = defaults.get("work_item_type") or item_tuples[0][0]
        except IndexError:
            return None, item_tuples

        return default_item_type, item_tuples

    def get_create_issue_config(self, group, **kwargs):
        kwargs["link_referrer"] = "vsts_integration"
        fields = super(VstsIssueSync, self).get_create_issue_config(group, **kwargs)
        # Azure/VSTS has BOTH projects and repositories. A project can have many repositories.
        # Workitems (issues) are associated with the project not the repository.
        default_project, project_choices = self.get_project_choices(group, **kwargs)

        work_item_choices = []
        default_work_item = None
        if default_project:
            default_work_item, work_item_choices = self.get_work_item_choices(
                default_project, group
            )

        return [
            {
                "name": "project",
                "required": True,
                "type": "choice",
                "choices": project_choices,
                "defaultValue": default_project,
                "label": _("Project"),
                "placeholder": default_project or _("MyProject"),
                "updatesForm": True,
            },
            {
                "name": "work_item_type",
                "required": True,
                "type": "choice",
                "choices": work_item_choices,
                "defaultValue": default_work_item,
                "label": _("Work Item Type"),
                "placeholder": _("Bug"),
            },
        ] + fields

    def get_link_issue_config(self, group, **kwargs):
        fields = super(VstsIssueSync, self).get_link_issue_config(group, **kwargs)
        org = group.organization
        autocomplete_url = reverse("sentry-extensions-vsts-search", args=[org.slug, self.model.id])
        for field in fields:
            if field["name"] == "externalIssue":
                field["url"] = autocomplete_url
                field["type"] = "select"
        return fields

    def get_issue_url(self, key, **kwargs):
        return "%s_workitems/edit/%s" % (self.instance, six.text_type(key))

    def create_issue(self, data, **kwargs):
        """
        Creates the issue on the remote service and returns an issue ID.
        """
        project_id = data.get("project")
        if project_id is None:
            raise ValueError("Azure DevOps expects project")

        client = self.get_client()

        title = data["title"]
        description = data["description"]
        item_type = data["work_item_type"]

        try:
            created_item = client.create_work_item(
                instance=self.instance,
                project=project_id,
                item_type=item_type,
                title=title,
                # Descriptions cannot easily be seen. So, a comment will be added as well.
                description=markdown(description),
                comment=markdown(description),
            )
        except Exception as e:
            self.raise_error(e)

        project_name = created_item["fields"]["System.AreaPath"]
        return {
            "key": six.text_type(created_item["id"]),
            "title": title,
            "description": description,
            "metadata": {"display_name": "%s#%s" % (project_name, created_item["id"])},
        }

    def get_issue(self, issue_id, **kwargs):
        client = self.get_client()
        work_item = client.get_work_item(self.instance, issue_id)
        return {
            "key": six.text_type(work_item["id"]),
            "title": work_item["fields"]["System.Title"],
            "description": work_item["fields"].get("System.Description"),
            "metadata": {
                "display_name": "%s#%s" % (work_item["fields"]["System.AreaPath"], work_item["id"])
            },
        }

    def sync_assignee_outbound(self, external_issue, user, assign=True, **kwargs):
        client = self.get_client()
        assignee = None

        if assign is True:
            sentry_emails = [email.email.lower() for email in user.get_verified_emails()]
            continuation_token = None
            while True:
                vsts_users = client.get_users(self.model.name, continuation_token)
                continuation_token = vsts_users.headers.get("X-MS-ContinuationToken")
                for vsts_user in vsts_users["value"]:
                    vsts_email = vsts_user.get(u"mailAddress")
                    if vsts_email and vsts_email.lower() in sentry_emails:
                        assignee = vsts_user["mailAddress"]
                        break

                if not continuation_token:
                    break

            if assignee is None:
                # TODO(lb): Email people when this happens
                self.logger.info(
                    "vsts.assignee-not-found",
                    extra={
                        "integration_id": external_issue.integration_id,
                        "user_id": user.id,
                        "issue_key": external_issue.key,
                    },
                )
                return

        try:
            client.update_work_item(self.instance, external_issue.key, assigned_to=assignee)
        except (ApiUnauthorized, ApiError):
            self.logger.info(
                "vsts.failed-to-assign",
                extra={
                    "integration_id": external_issue.integration_id,
                    "user_id": user.id,
                    "issue_key": external_issue.key,
                },
            )

    def sync_status_outbound(self, external_issue, is_resolved, project_id, **kwargs):
        client = self.get_client()
        work_item = client.get_work_item(self.instance, external_issue.key)

        # For some reason, vsts doesn't include the project id
        # in the work item response.
        # TODO(jess): figure out if there's a better way to do this
        vsts_project_name = work_item["fields"]["System.TeamProject"]

        vsts_projects = client.get_projects(self.instance)

        vsts_project_id = None
        for p in vsts_projects:
            if p["name"] == vsts_project_name:
                vsts_project_id = p["id"]
                break

        try:
            external_project = IntegrationExternalProject.objects.get(
                external_id=vsts_project_id,
                organization_integration_id__in=OrganizationIntegration.objects.filter(
                    organization_id=external_issue.organization_id,
                    integration_id=external_issue.integration_id,
                ),
            )
        except IntegrationExternalProject.DoesNotExist:
            self.logger.info(
                "vsts.external-project-not-found",
                extra={
                    "integration_id": external_issue.integration_id,
                    "is_resolved": is_resolved,
                    "issue_key": external_issue.key,
                },
            )
            return

        status = (
            external_project.resolved_status if is_resolved else external_project.unresolved_status
        )

        try:
            client.update_work_item(self.instance, external_issue.key, state=status)
        except (ApiUnauthorized, ApiError) as error:
            self.logger.info(
                "vsts.failed-to-change-status",
                extra={
                    "integration_id": external_issue.integration_id,
                    "is_resolved": is_resolved,
                    "issue_key": external_issue.key,
                    "exception": error,
                },
            )

    def should_unresolve(self, data):
        done_states = self.get_done_states(data["project"])
        return (
            data["old_state"] in done_states
            or data["old_state"] is None
            and not data["new_state"] in done_states
        )

    def should_resolve(self, data):
        done_states = self.get_done_states(data["project"])
        return not data["old_state"] in done_states and data["new_state"] in done_states

    def get_done_states(self, project):
        client = self.get_client()
        try:
            all_states = client.get_work_item_states(self.instance, project)["value"]
        except ApiError as err:
            self.logger.info(
                "vsts.get-done-states.failed",
                extra={"integration_id": self.model.id, "exception": err},
            )
            return []

        done_states = [
            state["name"] for state in all_states if state["category"] in self.done_categories
        ]
        return done_states

    def get_issue_display_name(self, external_issue):
        if external_issue.metadata is None:
            return ""
        return external_issue.metadata["display_name"]

    def create_comment(self, issue_id, user_id, group_note):
        comment = group_note.data["text"]
        quoted_comment = self.create_comment_attribution(user_id, comment)
        self.get_client().update_work_item(self.instance, issue_id, comment=quoted_comment)

    def create_comment_attribution(self, user_id, comment_text):
        # VSTS uses markdown or xml
        # https://docs.microsoft.com/en-us/microsoftteams/platform/concepts/bots/bots-text-formats
        user = User.objects.get(id=user_id)
        attribution = "%s wrote:\n\n" % user.name
        quoted_comment = "%s<blockquote>%s</blockquote>" % (attribution, comment_text)
        return quoted_comment

    def update_comment(self, issue_id, user_id, external_comment_id, comment_text):
        # Azure does not support updating comments
        pass
