from collections import OrderedDict
from typing import TYPE_CHECKING, Any, Mapping, MutableMapping, Optional, Sequence, Set, Tuple

from django.urls import reverse
from django.utils.translation import ugettext as _
from mistune import markdown
from rest_framework.response import Response

from sentry.integrations.mixins import IssueSyncMixin, ResolveSyncAction
from sentry.models import Activity, IntegrationExternalProject, OrganizationIntegration, User
from sentry.shared_integrations.exceptions import ApiError, ApiUnauthorized

if TYPE_CHECKING:
    from sentry.models import ExternalIssue, Group


class VstsIssueSync(IssueSyncMixin):  # type: ignore
    description = "Integrate Azure DevOps work items by linking a project."
    slug = "vsts"
    conf_key = slug

    issue_fields = frozenset(["id", "title", "url"])
    done_categories = frozenset(["Resolved", "Completed", "Closed"])

    def get_persisted_default_config_fields(self) -> Sequence[str]:
        return ["project", "work_item_type"]

    def create_default_repo_choice(self, default_repo: str) -> Tuple[str, str]:
        # default_repo should be the project_id
        project = self.get_client().get_project(self.instance, default_repo)
        print("create_default_repo_choice: ", project)
        return (project["id"], project["name"])

    def get_project_choices(
        self, group: Optional["Group"] = None, **kwargs: Any
    ) -> Tuple[Optional[str], Sequence[Tuple[str, str]]]:
        client = self.get_client()
        try:
            projects = client.get_projects(self.instance)
            print("fetch_projects: ", projects)
        except (ApiError, ApiUnauthorized, KeyError) as e:
            raise self.raise_error(e)

        project_choices = [(project["id"], project["name"]) for project in projects]

        params = kwargs.get("params", {})
        project = kwargs.get("project")
        if group:
            default_project_id = group.project_id
        elif project:
            default_project_id = project.id
        else:
            default_project_id = projects[0]["id"]
        defaults = self.get_project_defaults(default_project_id)
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
            print("project_choices: ", project_choices)
            print("default_project: ", default_project)
            next(True for r in project_choices if r[0] == default_project)
        except StopIteration:
            try:
                project_choices.insert(0, self.create_default_repo_choice(default_project))
            except (ApiError, ApiUnauthorized):
                return None, project_choices

        return default_project, project_choices

    def get_work_item_choices(
        self, project: str, group: Optional["Group"] = None, **kwargs: Any
    ) -> Tuple[Optional[str], Sequence[Tuple[str, str]]]:
        client = self.get_client()

        params = kwargs.get("params", {})

        try:
            item_categories = client.get_work_item_categories(self.instance, project)["value"]
        except (ApiError, ApiUnauthorized, KeyError) as e:
            raise self.raise_error(e)

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
        defaults = {}
        if group:
            defaults = self.get_project_defaults(group.project_id)
        try:
            default_item_type = params.get(
                "work_item_type", defaults.get("work_item_type") or item_tuples[0][0]
            )

        except IndexError:
            return None, item_tuples

        return default_item_type, item_tuples

    def get_work_item_custom_fields(
        self, project: str, type
    ) -> Tuple[Optional[str], Sequence[Tuple[str, str]]]:
        client = self.get_client()
        custom_fields = []
        try:
            item_fields = client.get_work_item_fields(self.instance, project, type)["fields"]
        except (ApiError, ApiUnauthorized, KeyError) as e:
            raise self.raise_error(e)

        for field in item_fields:
            if field.get("referenceName", "").startswith("Custom."):
                custom_fields.append(
                    {
                        "name": field.get("referenceName"),
                        "required": field.get("alwaysRequired", False),
                        "type": "text",
                        "label": _(field.get("name") or field.get("referenceName")),
                    }
                )
        return custom_fields

    def get_create_issue_config_no_group(self, project: str) -> Sequence[Mapping[str, Any]]:
        return self.get_create_issue_config(None, None, project=project)

    def get_create_issue_config(
        self, group: Optional["Group"], user: Optional[User], **kwargs: Any
    ) -> Sequence[Mapping[str, Any]]:
        kwargs["link_referrer"] = "vsts_integration"
        fields = []
        if group:
            fields = super().get_create_issue_config(group, user, **kwargs)
            # Azure/VSTS has BOTH projects and repositories. A project can have many repositories.
            # Workitems (issues) are associated with the project not the repository.
        default_project, project_choices = self.get_project_choices(group, **kwargs)

        work_item_choices: Sequence[Tuple[str, str]] = []
        default_work_item: Optional[str] = None
        if default_project:
            default_work_item, work_item_choices = self.get_work_item_choices(
                default_project, group, **kwargs
            )

        print(default_work_item)
        if default_work_item:
            custom_fields = self.get_work_item_custom_fields(default_project, default_work_item)

        return [
            {
                "name": "project",
                "required": True,
                "type": "choice",
                "choices": project_choices,
                "default": default_project,
                "label": _("Project"),
                "placeholder": default_project or _("MyProject"),
                "updatesForm": True,
            },
            {
                "name": "work_item_type",
                "required": True,
                "type": "choice",
                "choices": work_item_choices,
                "default": default_work_item,
                "label": _("Work Item Type"),
                "placeholder": _("Bug"),
                "updatesForm": True,
            },
            *fields,
            *custom_fields,
        ]

    def get_link_issue_config(self, group: "Group", **kwargs: Any) -> Sequence[Mapping[str, str]]:
        fields: Sequence[MutableMapping[str, str]] = super().get_link_issue_config(group, **kwargs)
        org = group.organization
        autocomplete_url = reverse("sentry-extensions-vsts-search", args=[org.slug, self.model.id])
        for field in fields:
            if field["name"] == "externalIssue":
                field["url"] = autocomplete_url
                field["type"] = "select"
        return fields

    def get_issue_url(self, key: str, **kwargs: Any) -> str:
        return f"{self.instance}_workitems/edit/{key}"

    def create_issue(self, data: Mapping[str, str], **kwargs: Any) -> Mapping[str, Any]:
        print("create_issue: ", data)
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
            raise self.raise_error(e)

        project_name = created_item["fields"]["System.AreaPath"]
        return {
            "key": str(created_item["id"]),
            "title": title,
            "description": description,
            "metadata": {"display_name": "{}#{}".format(project_name, created_item["id"])},
        }

    def get_issue(self, issue_id: str, **kwargs: Any) -> Mapping[str, Any]:
        client = self.get_client()
        work_item = client.get_work_item(self.instance, issue_id)
        return {
            "key": str(work_item["id"]),
            "title": work_item["fields"]["System.Title"],
            "description": work_item["fields"].get("System.Description"),
            "metadata": {
                "display_name": "{}#{}".format(
                    work_item["fields"]["System.AreaPath"], work_item["id"]
                )
            },
        }

    def sync_assignee_outbound(
        self,
        external_issue: "ExternalIssue",
        user: Optional["User"],
        assign: bool = True,
        **kwargs: Any,
    ) -> None:
        client = self.get_client()
        assignee = None

        if user and assign is True:
            sentry_emails = [email.email.lower() for email in user.get_verified_emails()]
            continuation_token = None
            while True:
                vsts_users = client.get_users(self.model.name, continuation_token)
                continuation_token = vsts_users.headers.get("X-MS-ContinuationToken")
                for vsts_user in vsts_users["value"]:
                    vsts_email = vsts_user.get("mailAddress")
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
                    "user_id": user.id if user else None,
                    "issue_key": external_issue.key,
                },
            )

    def sync_status_outbound(
        self, external_issue: "ExternalIssue", is_resolved: bool, project_id: int, **kwargs: Any
    ) -> None:
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

    def get_resolve_sync_action(self, data: Mapping[str, Any]) -> ResolveSyncAction:
        done_states = self._get_done_statuses(data["project"])
        return ResolveSyncAction.from_resolve_unresolve(
            should_resolve=(
                not data["old_state"] in done_states and data["new_state"] in done_states
            ),
            should_unresolve=(not data["new_state"] in done_states or data["old_state"] is None),
        )

    def _get_done_statuses(self, project: str) -> Set[str]:
        client = self.get_client()
        try:
            all_states = client.get_work_item_states(self.instance, project)["value"]
        except ApiError as err:
            self.logger.info(
                "vsts.get-done-states.failed",
                extra={"integration_id": self.model.id, "exception": err},
            )
            return set()
        return {state["name"] for state in all_states if state["category"] in self.done_categories}

    def get_issue_display_name(self, external_issue: "ExternalIssue") -> str:
        return (external_issue.metadata or {}).get("display_name", "")

    def create_comment(self, issue_id: str, user_id: int, group_note: Activity) -> Response:
        comment = group_note.data["text"]
        quoted_comment = self.create_comment_attribution(user_id, comment)
        return self.get_client().update_work_item(self.instance, issue_id, comment=quoted_comment)

    def create_comment_attribution(self, user_id: int, comment_text: str) -> str:
        # VSTS uses markdown or xml
        # https://docs.microsoft.com/en-us/microsoftteams/platform/concepts/bots/bots-text-formats
        user = User.objects.get(id=user_id)
        attribution = f"{user.name} wrote:\n\n"
        quoted_comment = f"{attribution}<blockquote>{comment_text}</blockquote>"
        return quoted_comment

    def update_comment(self, issue_id: int, user_id: int, group_note: str) -> None:
        # Azure does not support updating comments.
        pass


a = {
    "name": "Bug",
    "referenceName": "Microsoft.VSTS.WorkItemTypes.Bug",
    "description": "Describes a divergence between required and actual behavior, and tracks the work done to correct the defect and verify the correction.",
    "color": "CC293D",
    "icon": {
        "id": "icon_insect",
        "url": "https://tfsprodcus7.visualstudio.com/_apis/wit/workItemIcons/icon_insect?color=CC293D&v=2",
    },
    "isDisabled": False,
    "xmlForm": '<FORM><Layout HideReadOnlyEmptyFields="true" HideControlBorders="true"><Group Margin="(10,0,0,0)"><Column PercentWidth="94"><Control Label="" LabelPosition="Top" FieldName="System.Title" Type="FieldControl" EmptyText="Enter title here" ControlFontSize="large" /></Column><Column PercentWidth="6"><Control Label="" LabelPosition="Top" FieldName="System.Id" Type="FieldControl" ControlFontSize="large" /></Column></Group><Group Margin="(10,10,0,0)"><Column PercentWidth="30"><Control Label="Assi&amp;gned To" LabelPosition="Left" FieldName="System.AssignedTo" Type="FieldControl" EmptyText="Unassigned" /><Control Label="Stat&amp;e" LabelPosition="Left" FieldName="System.State" Type="FieldControl" /><Control Label="Reason" LabelPosition="Left" FieldName="System.Reason" Type="FieldControl" /></Column><Column PercentWidth="40"><Control Label="" LabelPosition="Top" Type="LabelControl" /><Control Label="&amp;Area" LabelPosition="Left" FieldName="System.AreaPath" Type="WorkItemClassificationControl" /><Control Label="Ite&amp;ration" LabelPosition="Left" FieldName="System.IterationPath" Type="WorkItemClassificationControl" /></Column><Column PercentWidth="30"><Control Label="" LabelPosition="Top" Name="2" Type="LabelControl" /><Control Label="" LabelPosition="Top" Name="3" Type="LabelControl" /><Control Label="Last Updated Date" LabelPosition="Left" FieldName="System.ChangedDate" Type="DateTimeControl" ReadOnly="True" /></Column></Group><TabGroup Margin="(0,10,0,0)"><Tab Label="Details"><Group><Column PercentWidth="50"><Group><Column PercentWidth="100"><Group Label="Repro Steps"><Column PercentWidth="100"><Control Label="" LabelPosition="Top" FieldName="Microsoft.VSTS.TCM.ReproSteps" Type="HtmlFieldControl" Margin="(0,0,0,10)" /></Column></Group><Group Label="System Info"><Column PercentWidth="100"><Control Label="" LabelPosition="Top" FieldName="Microsoft.VSTS.TCM.SystemInfo" Type="HtmlFieldControl" Margin="(0,0,0,10)" /></Column></Group></Column></Group></Column><Column PercentWidth="50"><Group Margin="(20,0,0,0)"><Column PercentWidth="25"><Group><Column PercentWidth="100"><Group Label="Planning"><Column PercentWidth="100"><Control Label="Resolved Reason" LabelPosition="Top" FieldName="Microsoft.VSTS.Common.ResolvedReason" Type="FieldControl" Margin="(0,0,0,10)" /><Control Label="Story Points" LabelPosition="Top" FieldName="Microsoft.VSTS.Scheduling.StoryPoints" Type="FieldControl" Margin="(0,0,0,10)" /><Control Label="Priority" LabelPosition="Top" FieldName="Microsoft.VSTS.Common.Priority" Type="FieldControl" Margin="(0,0,0,10)" /><Control Label="Severity" LabelPosition="Top" FieldName="Microsoft.VSTS.Common.Severity" Type="FieldControl" Margin="(0,0,0,10)" /><Control Label="Activity" LabelPosition="Top" FieldName="Microsoft.VSTS.Common.Activity" Type="FieldControl" Margin="(0,0,0,10)" /></Column></Group><Group Label="Effort (Hours)"><Column PercentWidth="100"><Control Label="Original Estimate" LabelPosition="Top" FieldName="Microsoft.VSTS.Scheduling.OriginalEstimate" Type="FieldControl" Margin="(0,0,0,10)" /><Control Label="Remaining" LabelPosition="Top" FieldName="Microsoft.VSTS.Scheduling.RemainingWork" Type="FieldControl" Margin="(0,0,0,10)" /><Control Label="Completed" LabelPosition="Top" FieldName="Microsoft.VSTS.Scheduling.CompletedWork" Type="FieldControl" Margin="(0,0,0,10)" /><Control Label="Environment" LabelPosition="Top" FieldName="Custom.Environment" Type="FieldControl" Margin="(0,0,0,10)" /></Column></Group></Column></Group></Column><Column PercentWidth="25"><Group><Column PercentWidth="100"><Group Label="Deployment"><Column PercentWidth="100"><Control Label="" LabelPosition="Top" FieldName="Deployments" Type="DeploymentsControl" Margin="(0,0,0,10)" /></Column></Group><Group Label="Development"><Column PercentWidth="100"><Control Label="" LabelPosition="Top" FieldName="Development" Type="LinksControl" Margin="(0,0,0,10)"><LinksControlOptions><WorkItemLinkFilters FilterType="excludeAll" /><ExternalLinkFilters FilterType="include"><Filter LinkType="Build" /><Filter LinkType="Integrated in build" /><Filter LinkType="Pull Request" /><Filter LinkType="Branch" /><Filter LinkType="Fixed in Commit" /><Filter LinkType="Fixed in Changeset" /><Filter LinkType="Source Code File" /><Filter LinkType="Found in build" /><Filter LinkType="GitHub Pull Request" /><Filter LinkType="GitHub Commit" /></ExternalLinkFilters><LinkColumns><LinkColumn RefName="System.Id" /><LinkColumn RefName="System.Title" /><LinkColumn LinkAttribute="System.Links.Comment" /></LinkColumns></LinksControlOptions></Control></Column></Group><Group Label="Related Work"><Column PercentWidth="100"><Control Label="" LabelPosition="Top" FieldName="Related Work" Type="LinksControl" Margin="(0,0,0,10)"><LinksControlOptions><WorkItemLinkFilters FilterType="include"><Filter LinkType="System.LinkTypes.Duplicate" /><Filter LinkType="System.LinkTypes.Hierarchy" /><Filter LinkType="Microsoft.VSTS.Common.TestedBy" /><Filter LinkType="System.LinkTypes.Dependency" /><Filter LinkType="System.LinkTypes.Related" /></WorkItemLinkFilters><ExternalLinkFilters FilterType="include"><Filter LinkType="GitHub Issue" /></ExternalLinkFilters><LinkColumns><LinkColumn RefName="System.Id" /><LinkColumn RefName="System.Title" /><LinkColumn RefName="System.AssignedTo" /><LinkColumn RefName="System.WorkItemType" /><LinkColumn RefName="System.State" /><LinkColumn RefName="System.ChangedDate" /><LinkColumn LinkAttribute="System.Links.Comment" /></LinkColumns></LinksControlOptions></Control></Column></Group><Group Label="System Info"><Column PercentWidth="100"><Control Label="Found in Build" LabelPosition="Top" FieldName="Microsoft.VSTS.Build.FoundIn" Type="FieldControl" Margin="(0,0,0,10)" /><Control Label="Integrated in Build" LabelPosition="Top" FieldName="Microsoft.VSTS.Build.IntegrationBuild" Type="FieldControl" Margin="(0,0,0,10)" /></Column></Group></Column></Group></Column></Group></Column></Group></Tab><Tab Label="History"><Group><Column PercentWidth="100"><Group><Column PercentWidth="100"><Group><Column PercentWidth="100"><Control Label="" LabelPosition="Top" FieldName="System.History" Type="WorkItemLogControl" Margin="(0,0,0,10)" /></Column></Group></Column></Group></Column></Group></Tab><Tab Label="Links"><Group><Column PercentWidth="100"><Group><Column PercentWidth="100"><Group><Column PercentWidth="100"><Control Label="" LabelPosition="Top" Type="LinksControl" Margin="(0,0,0,10)"><LinksControlOptions><LinkColumns><LinkColumn RefName="System.Id" /><LinkColumn RefName="System.Title" /><LinkColumn RefName="System.AssignedTo" /><LinkColumn RefName="System.WorkItemType" /><LinkColumn RefName="System.State" /><LinkColumn RefName="System.ChangedDate" /><LinkColumn LinkAttribute="System.Links.Comment" /></LinkColumns></LinksControlOptions></Control></Column></Group></Column></Group></Column></Group></Tab><Tab Label="Attachments"><Group><Column PercentWidth="100"><Group><Column PercentWidth="100"><Group><Column PercentWidth="100"><Control Label="Attachments" LabelPosition="Top" Type="AttachmentsControl" Margin="(0,0,0,10)" /></Column></Group></Column></Group></Column></Group></Tab></TabGroup></Layout></FORM>',
    "fields": [
        {
            "defaultValue": None,
            "helpText": "The iteration within which this bug will be fixed",
            "alwaysRequired": False,
            "referenceName": "System.IterationPath",
            "name": "Iteration Path",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationPath",
        },
        {
            "defaultValue": None,
            "alwaysRequired": True,
            "referenceName": "System.IterationId",
            "name": "Iteration ID",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationId",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.ExternalLinkCount",
            "name": "External Link Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.ExternalLinkCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel7",
            "name": "Iteration Level 7",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel7",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel6",
            "name": "Iteration Level 6",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel6",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel5",
            "name": "Iteration Level 5",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel5",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel4",
            "name": "Iteration Level 4",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel4",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel3",
            "name": "Iteration Level 3",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel3",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel2",
            "name": "Iteration Level 2",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel2",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel1",
            "name": "Iteration Level 1",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel1",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel7",
            "name": "Area Level 7",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel7",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel6",
            "name": "Area Level 6",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel6",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel5",
            "name": "Area Level 5",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel5",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel4",
            "name": "Area Level 4",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel4",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel3",
            "name": "Area Level 3",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel3",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel2",
            "name": "Area Level 2",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel2",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel1",
            "name": "Area Level 1",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel1",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.TeamProject",
            "name": "Team Project",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.TeamProject",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Parent",
            "name": "Parent",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Parent",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.RemoteLinkCount",
            "name": "Remote Link Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.RemoteLinkCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.CommentCount",
            "name": "Comment Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.CommentCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.HyperLinkCount",
            "name": "Hyperlink Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.HyperLinkCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AttachedFileCount",
            "name": "Attached File Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AttachedFileCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.NodeName",
            "name": "Node Name",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.NodeName",
        },
        {
            "defaultValue": None,
            "helpText": "The area of the product with which this bug is associated",
            "alwaysRequired": False,
            "referenceName": "System.AreaPath",
            "name": "Area Path",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaPath",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.RevisedDate",
            "name": "Revised Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.RevisedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.ChangedDate",
            "name": "Changed Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.ChangedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Id",
            "name": "ID",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Id",
        },
        {
            "defaultValue": None,
            "alwaysRequired": True,
            "referenceName": "System.AreaId",
            "name": "Area ID",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaId",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AuthorizedAs",
            "name": "Authorized As",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AuthorizedAs",
        },
        {
            "defaultValue": None,
            "helpText": "Stories affected and how",
            "alwaysRequired": True,
            "referenceName": "System.Title",
            "name": "Title",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Title",
        },
        {
            "defaultValue": "New",
            "helpText": "New = for triage; Active = not yet fixed; Resolved = fixed not yet verified; Closed = fix verified.",
            "alwaysRequired": True,
            "referenceName": "System.State",
            "name": "State",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.State",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AuthorizedDate",
            "name": "Authorized Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AuthorizedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Watermark",
            "name": "Watermark",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Watermark",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Rev",
            "name": "Rev",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Rev",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.ChangedBy",
            "name": "Changed By",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.ChangedBy",
        },
        {
            "defaultValue": None,
            "helpText": "The reason why the bug is in the current state",
            "alwaysRequired": False,
            "referenceName": "System.Reason",
            "name": "Reason",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Reason",
        },
        {
            "defaultValue": None,
            "helpText": "The person currently working on this bug",
            "alwaysRequired": False,
            "referenceName": "System.AssignedTo",
            "name": "Assigned To",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AssignedTo",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.WorkItemType",
            "name": "Work Item Type",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.WorkItemType",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.CreatedDate",
            "name": "Created Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.CreatedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.CreatedBy",
            "name": "Created By",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.CreatedBy",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Description",
            "name": "Description",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Description",
        },
        {
            "defaultValue": None,
            "helpText": "Discussion thread plus automatic record of changes",
            "alwaysRequired": False,
            "referenceName": "System.History",
            "name": "History",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.History",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.RelatedLinkCount",
            "name": "Related Link Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.RelatedLinkCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Tags",
            "name": "Tags",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Tags",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.BoardColumn",
            "name": "Board Column",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.BoardColumn",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.BoardColumnDone",
            "name": "Board Column Done",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.BoardColumnDone",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.BoardLane",
            "name": "Board Lane",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.BoardLane",
        },
        {
            "defaultValue": None,
            "helpText": "The size of work estimated for fixing the bug",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Scheduling.StoryPoints",
            "name": "Story Points",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Scheduling.StoryPoints",
        },
        {
            "defaultValue": None,
            "helpText": "An estimate of the number of units of work remaining to complete this bug",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Scheduling.RemainingWork",
            "name": "Remaining Work",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Scheduling.RemainingWork",
        },
        {
            "defaultValue": None,
            "helpText": "Initial value for Remaining Work - set once, when work begins",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Scheduling.OriginalEstimate",
            "name": "Original Estimate",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Scheduling.OriginalEstimate",
        },
        {
            "defaultValue": None,
            "helpText": "The number of units of work that have been spent on this bug",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Scheduling.CompletedWork",
            "name": "Completed Work",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Scheduling.CompletedWork",
        },
        {
            "defaultValue": None,
            "helpText": "Type of work involved",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.Activity",
            "name": "Activity",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.Activity",
        },
        {
            "defaultValue": None,
            "helpText": "Test context, provided automatically by test infrastructure",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.TCM.SystemInfo",
            "name": "System Info",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.TCM.SystemInfo",
        },
        {
            "defaultValue": None,
            "helpText": "How to see the bug. End by contrasting expected with actual behavior.",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.TCM.ReproSteps",
            "name": "Repro Steps",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.TCM.ReproSteps",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.StateChangeDate",
            "name": "State Change Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.StateChangeDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ActivatedDate",
            "name": "Activated Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ActivatedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ActivatedBy",
            "name": "Activated By",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ActivatedBy",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ResolvedDate",
            "name": "Resolved Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ResolvedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ResolvedBy",
            "name": "Resolved By",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ResolvedBy",
        },
        {
            "defaultValue": None,
            "helpText": "The reason why the bug was resolved",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ResolvedReason",
            "name": "Resolved Reason",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ResolvedReason",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ClosedDate",
            "name": "Closed Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ClosedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ClosedBy",
            "name": "Closed By",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ClosedBy",
        },
        {
            "defaultValue": "2",
            "helpText": "Business importance. 1=must fix; 4=unimportant.",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.Priority",
            "name": "Priority",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.Priority",
        },
        {
            "defaultValue": "3 - Medium",
            "helpText": "Assessment of the effect of the bug on the project.",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.Severity",
            "name": "Severity",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.Severity",
        },
        {
            "defaultValue": None,
            "helpText": "Work first on items with lower-valued stack rank. Set in triage.",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.StackRank",
            "name": "Stack Rank",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.StackRank",
        },
        {
            "defaultValue": "Business",
            "helpText": "The type should be set to Business primarily to represent customer-facing issues. Work to change the architecture should be added as a Requirement",
            "alwaysRequired": True,
            "referenceName": "Microsoft.VSTS.Common.ValueArea",
            "name": "Value Area",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ValueArea",
        },
        {
            "defaultValue": None,
            "helpText": "The build in which the bug was fixed",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Build.IntegrationBuild",
            "name": "Integration Build",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Build.IntegrationBuild",
        },
        {
            "defaultValue": None,
            "helpText": "The build in which the bug was found",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Build.FoundIn",
            "name": "Found In",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Build.FoundIn",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Custom.Environment",
            "name": "Environment",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Custom.Environment",
        },
    ],
    "fieldInstances": [
        {
            "defaultValue": None,
            "helpText": "The iteration within which this bug will be fixed",
            "alwaysRequired": False,
            "referenceName": "System.IterationPath",
            "name": "Iteration Path",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationPath",
        },
        {
            "defaultValue": None,
            "alwaysRequired": True,
            "referenceName": "System.IterationId",
            "name": "Iteration ID",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationId",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.ExternalLinkCount",
            "name": "External Link Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.ExternalLinkCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel7",
            "name": "Iteration Level 7",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel7",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel6",
            "name": "Iteration Level 6",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel6",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel5",
            "name": "Iteration Level 5",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel5",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel4",
            "name": "Iteration Level 4",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel4",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel3",
            "name": "Iteration Level 3",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel3",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel2",
            "name": "Iteration Level 2",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel2",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.IterationLevel1",
            "name": "Iteration Level 1",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.IterationLevel1",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel7",
            "name": "Area Level 7",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel7",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel6",
            "name": "Area Level 6",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel6",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel5",
            "name": "Area Level 5",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel5",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel4",
            "name": "Area Level 4",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel4",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel3",
            "name": "Area Level 3",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel3",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel2",
            "name": "Area Level 2",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel2",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AreaLevel1",
            "name": "Area Level 1",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaLevel1",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.TeamProject",
            "name": "Team Project",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.TeamProject",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Parent",
            "name": "Parent",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Parent",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.RemoteLinkCount",
            "name": "Remote Link Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.RemoteLinkCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.CommentCount",
            "name": "Comment Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.CommentCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.HyperLinkCount",
            "name": "Hyperlink Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.HyperLinkCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AttachedFileCount",
            "name": "Attached File Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AttachedFileCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.NodeName",
            "name": "Node Name",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.NodeName",
        },
        {
            "defaultValue": None,
            "helpText": "The area of the product with which this bug is associated",
            "alwaysRequired": False,
            "referenceName": "System.AreaPath",
            "name": "Area Path",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaPath",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.RevisedDate",
            "name": "Revised Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.RevisedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.ChangedDate",
            "name": "Changed Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.ChangedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Id",
            "name": "ID",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Id",
        },
        {
            "defaultValue": None,
            "alwaysRequired": True,
            "referenceName": "System.AreaId",
            "name": "Area ID",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AreaId",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AuthorizedAs",
            "name": "Authorized As",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AuthorizedAs",
        },
        {
            "defaultValue": None,
            "helpText": "Stories affected and how",
            "alwaysRequired": True,
            "referenceName": "System.Title",
            "name": "Title",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Title",
        },
        {
            "defaultValue": "New",
            "helpText": "New = for triage; Active = not yet fixed; Resolved = fixed not yet verified; Closed = fix verified.",
            "alwaysRequired": True,
            "referenceName": "System.State",
            "name": "State",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.State",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.AuthorizedDate",
            "name": "Authorized Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AuthorizedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Watermark",
            "name": "Watermark",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Watermark",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Rev",
            "name": "Rev",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Rev",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.ChangedBy",
            "name": "Changed By",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.ChangedBy",
        },
        {
            "defaultValue": None,
            "helpText": "The reason why the bug is in the current state",
            "alwaysRequired": False,
            "referenceName": "System.Reason",
            "name": "Reason",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Reason",
        },
        {
            "defaultValue": None,
            "helpText": "The person currently working on this bug",
            "alwaysRequired": False,
            "referenceName": "System.AssignedTo",
            "name": "Assigned To",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.AssignedTo",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.WorkItemType",
            "name": "Work Item Type",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.WorkItemType",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.CreatedDate",
            "name": "Created Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.CreatedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.CreatedBy",
            "name": "Created By",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.CreatedBy",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Description",
            "name": "Description",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Description",
        },
        {
            "defaultValue": None,
            "helpText": "Discussion thread plus automatic record of changes",
            "alwaysRequired": False,
            "referenceName": "System.History",
            "name": "History",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.History",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.RelatedLinkCount",
            "name": "Related Link Count",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.RelatedLinkCount",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.Tags",
            "name": "Tags",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.Tags",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.BoardColumn",
            "name": "Board Column",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.BoardColumn",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.BoardColumnDone",
            "name": "Board Column Done",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.BoardColumnDone",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "System.BoardLane",
            "name": "Board Lane",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/System.BoardLane",
        },
        {
            "defaultValue": None,
            "helpText": "The size of work estimated for fixing the bug",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Scheduling.StoryPoints",
            "name": "Story Points",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Scheduling.StoryPoints",
        },
        {
            "defaultValue": None,
            "helpText": "An estimate of the number of units of work remaining to complete this bug",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Scheduling.RemainingWork",
            "name": "Remaining Work",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Scheduling.RemainingWork",
        },
        {
            "defaultValue": None,
            "helpText": "Initial value for Remaining Work - set once, when work begins",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Scheduling.OriginalEstimate",
            "name": "Original Estimate",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Scheduling.OriginalEstimate",
        },
        {
            "defaultValue": None,
            "helpText": "The number of units of work that have been spent on this bug",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Scheduling.CompletedWork",
            "name": "Completed Work",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Scheduling.CompletedWork",
        },
        {
            "defaultValue": None,
            "helpText": "Type of work involved",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.Activity",
            "name": "Activity",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.Activity",
        },
        {
            "defaultValue": None,
            "helpText": "Test context, provided automatically by test infrastructure",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.TCM.SystemInfo",
            "name": "System Info",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.TCM.SystemInfo",
        },
        {
            "defaultValue": None,
            "helpText": "How to see the bug. End by contrasting expected with actual behavior.",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.TCM.ReproSteps",
            "name": "Repro Steps",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.TCM.ReproSteps",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.StateChangeDate",
            "name": "State Change Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.StateChangeDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ActivatedDate",
            "name": "Activated Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ActivatedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ActivatedBy",
            "name": "Activated By",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ActivatedBy",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ResolvedDate",
            "name": "Resolved Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ResolvedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ResolvedBy",
            "name": "Resolved By",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ResolvedBy",
        },
        {
            "defaultValue": None,
            "helpText": "The reason why the bug was resolved",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ResolvedReason",
            "name": "Resolved Reason",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ResolvedReason",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ClosedDate",
            "name": "Closed Date",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ClosedDate",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.ClosedBy",
            "name": "Closed By",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ClosedBy",
        },
        {
            "defaultValue": "2",
            "helpText": "Business importance. 1=must fix; 4=unimportant.",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.Priority",
            "name": "Priority",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.Priority",
        },
        {
            "defaultValue": "3 - Medium",
            "helpText": "Assessment of the effect of the bug on the project.",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.Severity",
            "name": "Severity",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.Severity",
        },
        {
            "defaultValue": None,
            "helpText": "Work first on items with lower-valued stack rank. Set in triage.",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Common.StackRank",
            "name": "Stack Rank",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.StackRank",
        },
        {
            "defaultValue": "Business",
            "helpText": "The type should be set to Business primarily to represent customer-facing issues. Work to change the architecture should be added as a Requirement",
            "alwaysRequired": True,
            "referenceName": "Microsoft.VSTS.Common.ValueArea",
            "name": "Value Area",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Common.ValueArea",
        },
        {
            "defaultValue": None,
            "helpText": "The build in which the bug was fixed",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Build.IntegrationBuild",
            "name": "Integration Build",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Build.IntegrationBuild",
        },
        {
            "defaultValue": None,
            "helpText": "The build in which the bug was found",
            "alwaysRequired": False,
            "referenceName": "Microsoft.VSTS.Build.FoundIn",
            "name": "Found In",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Microsoft.VSTS.Build.FoundIn",
        },
        {
            "defaultValue": None,
            "alwaysRequired": False,
            "referenceName": "Custom.Environment",
            "name": "Environment",
            "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/fields/Custom.Environment",
        },
    ],
    "transitions": {
        "Active": [
            {"to": "Active", "actions": None},
            {"to": "Closed", "actions": None},
            {"to": "Resolved", "actions": ["Microsoft.VSTS.Actions.Checkin"]},
            {"to": "New", "actions": ["Microsoft.VSTS.Actions.StopWork"]},
        ],
        "Closed": [
            {"to": "Closed", "actions": None},
            {"to": "Resolved", "actions": None},
            {"to": "Active", "actions": None},
            {"to": "New", "actions": None},
        ],
        "New": [
            {"to": "New", "actions": None},
            {"to": "Closed", "actions": None},
            {"to": "Resolved", "actions": ["Microsoft.VSTS.Actions.Checkin"]},
            {"to": "Active", "actions": ["Microsoft.VSTS.Actions.StartWork"]},
        ],
        "Resolved": [
            {"to": "Resolved", "actions": None},
            {"to": "Closed", "actions": None},
            {"to": "Active", "actions": None},
            {"to": "New", "actions": None},
        ],
        "": [{"to": "New", "actions": None}],
    },
    "states": [
        {"name": "New", "color": "b2b2b2", "category": "Proposed"},
        {"name": "Active", "color": "007acc", "category": "InProgress"},
        {"name": "Resolved", "color": "ff9d00", "category": "Resolved"},
        {"name": "Closed", "color": "339933", "category": "Completed"},
    ],
    "_links": {
        "self": {
            "href": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/workItemTypes/Bug"
        }
    },
    "url": "https://dev.azure.com/santry1/b642045a-0d24-4d5a-bf44-126a171bea26/_apis/wit/workItemTypes/Bug",
}
