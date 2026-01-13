from __future__ import annotations

from abc import ABC
from collections.abc import Mapping, MutableMapping, Sequence
from typing import TYPE_CHECKING, Any, NoReturn

from django.urls import reverse
from django.utils.translation import gettext as _
from mistune import markdown
from rest_framework.response import Response

from sentry.constants import ObjectStatus
from sentry.integrations.mixins import ResolveSyncAction
from sentry.integrations.mixins.issues import IntegrationSyncTargetNotFound, IssueSyncIntegration
from sentry.integrations.services.integration import integration_service
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.integrations.types import IntegrationProviderSlug
from sentry.models.activity import Activity
from sentry.shared_integrations.exceptions import (
    ApiError,
    ApiUnauthorized,
    IntegrationConfigurationError,
    IntegrationError,
    IntegrationFormError,
)
from sentry.silo.base import all_silo_function
from sentry.users.models.identity import Identity
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user.service import user_service

if TYPE_CHECKING:
    from sentry.integrations.models.external_issue import ExternalIssue
    from sentry.models.group import Group

# Specific substring to identify Azure Entra ID "identity deleted" errors
# Example: According to Microsoft Entra, your Identity xxx is currently Deleted within the following Microsoft Entra tenant: xxx Please contact your Microsoft Entra administrator to resolve this.
VSTS_IDENTITY_DELETED_ERROR_SUBSTRING = [
    "is currently Deleted within the following Microsoft Entra tenant"
]

VSTS_ISSUE_TITLE_MAX_LENGTH = 128

# Represents error codes caused by misconfiguration when creating a ticket
# Example: Error Communicating with Azure DevOps (HTTP 400): TF401320: Rule Error for field xxx. Error code: Required, HasValues, LimitedToValues, AllowsOldValue, InvalidEmpty.
VSTS_INTEGRATION_FORM_ERROR_CODES_SUBSTRINGS = ["TF401320"]


class VstsIssuesSpec(IssueSyncIntegration, SourceCodeIssueIntegration, ABC):
    description = "Integrate Azure DevOps work items by linking a project."
    slug = IntegrationProviderSlug.AZURE_DEVOPS.value
    conf_key = slug

    issue_fields = frozenset(["id", "title", "url"])
    done_categories = frozenset(["Resolved", "Completed", "Closed"])

    @property
    def instance(self) -> str:
        raise NotImplementedError

    def get_persisted_default_config_fields(self) -> Sequence[str]:
        return ["project", "work_item_type"]

    def create_default_repo_choice(self, default_repo: str) -> tuple[str, str]:
        # default_repo should be the project_id
        project = self.get_client().get_project(default_repo)
        return (project["id"], project["name"])

    def raise_error(self, exc: Exception, identity: Identity | None = None) -> NoReturn:
        # Reraise Azure Specific Errors correctly
        if isinstance(exc, ApiError) and any(
            substring in str(exc) for substring in VSTS_IDENTITY_DELETED_ERROR_SUBSTRING
        ):
            raise ApiUnauthorized(text=str(exc))
        elif isinstance(exc, ApiError) and any(
            substring in str(exc) for substring in VSTS_INTEGRATION_FORM_ERROR_CODES_SUBSTRINGS
        ):
            # Parse the field name from the error message
            # Example: TF401320: Rule Error for field Empowered Team. Error code: Required, HasValues, LimitedToValues, AllowsOldValue, InvalidEmpty.
            try:
                field_name = str(exc).split("Error for field ")[1].split(".")[0]
                raise IntegrationFormError(field_errors={field_name: f"{field_name} is required."})
            except IndexError:
                raise IntegrationFormError()
        raise super().raise_error(exc, identity)

    def get_project_choices(
        self, group: Group | None = None, **kwargs: Any
    ) -> tuple[str | None, Sequence[tuple[str, str]]]:
        client = self.get_client()
        try:
            projects = client.get_projects()
        except (ApiError, ApiUnauthorized, KeyError) as e:
            self.raise_error(e)

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
            next(True for r in project_choices if r[0] == default_project)
        except StopIteration:
            try:
                project_choices.insert(0, self.create_default_repo_choice(default_project))
            except (ApiError, ApiUnauthorized):
                return None, project_choices

        return default_project, project_choices

    def get_work_item_choices(
        self, project: str, group: Group | None = None
    ) -> tuple[str | None, Sequence[tuple[str, str]]]:
        client = self.get_client()
        try:
            item_categories = client.get_work_item_categories(project)["value"]
        except (ApiError, ApiUnauthorized, KeyError) as e:
            self.raise_error(e)

        item_type_map = {}
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
            default_item_type = defaults.get("work_item_type") or item_tuples[0][0]
        except IndexError:
            return None, item_tuples

        return default_item_type, item_tuples

    @all_silo_function
    def get_create_issue_config(
        self, group: Group | None, user: RpcUser | User, **kwargs: Any
    ) -> list[dict[str, Any]]:
        kwargs["link_referrer"] = "vsts_integration"
        fields = []
        if group:
            fields = super().get_create_issue_config(group, user, **kwargs)
            # Azure/VSTS has BOTH projects and repositories. A project can have many repositories.
            # Workitems (issues) are associated with the project not the repository.
        default_project, project_choices = self.get_project_choices(group, **kwargs)

        work_item_choices: Sequence[tuple[str, str]] = []
        default_work_item: str | None = None
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
            *fields,
        ]

    def get_link_issue_config(self, group: Group, **kwargs: Any) -> Sequence[Mapping[str, str]]:
        fields: Sequence[MutableMapping[str, str]] = super().get_link_issue_config(group, **kwargs)
        org = group.organization
        autocomplete_url = reverse("sentry-extensions-vsts-search", args=[org.slug, self.model.id])
        for field in fields:
            if field["name"] == "externalIssue":
                field["url"] = autocomplete_url
                field["type"] = "select"
        return fields

    def get_issue_url(self, key: str) -> str:
        return f"{self.instance}_workitems/edit/{key}"

    def create_issue(self, data: Mapping[str, str], **kwargs: Any) -> Mapping[str, Any]:
        """
        Creates the issue on the remote service and returns an issue ID.
        """
        project_id = data.get("project")
        if project_id is None:
            raise IntegrationFormError({"project": "Project is required."})

        client = self.get_client()

        title = data["title"]
        description = data["description"]
        item_type = data["work_item_type"]

        if len(title) > VSTS_ISSUE_TITLE_MAX_LENGTH:
            title = title[: VSTS_ISSUE_TITLE_MAX_LENGTH - 3] + "..."

        try:
            created_item = client.create_work_item(
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
            "key": str(created_item["id"]),
            "title": title,
            "description": description,
            "metadata": {"display_name": "{}#{}".format(project_name, created_item["id"])},
        }

    def get_issue(self, issue_id: int, **kwargs: Any) -> Mapping[str, Any]:
        client = self.get_client()
        work_item = client.get_work_item(issue_id)
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
        external_issue: ExternalIssue,
        user: RpcUser | None,
        assign: bool = True,
        **kwargs: Any,
    ) -> None:
        client = self.get_client()
        assignee = None

        if user and assign is True:
            sentry_emails = [email.lower() for email in user.emails]
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
                raise IntegrationSyncTargetNotFound("No matching VSTS user found.")

        try:
            client.update_work_item(external_issue.key, assigned_to=assignee)
        except (ApiUnauthorized, ApiError) as e:
            self.logger.info(
                "vsts.failed-to-assign",
                extra={
                    "integration_id": external_issue.integration_id,
                    "user_id": user.id if user else None,
                    "issue_key": external_issue.key,
                },
            )
            if isinstance(e, ApiUnauthorized):
                raise IntegrationConfigurationError(
                    "Insufficient permissions to assign user to the VSTS issue."
                ) from e
            raise IntegrationError("There was an error assigning the issue.") from e
        except Exception as e:
            self.raise_error(e)

    def sync_status_outbound(
        self, external_issue: ExternalIssue, is_resolved: bool, project_id: int
    ) -> None:
        client = self.get_client()
        try:
            work_item = client.get_work_item(external_issue.key)
        except Exception as e:
            self.raise_error(e)

        # For some reason, vsts doesn't include the project id
        # in the work item response.
        # TODO(jess): figure out if there's a better way to do this
        vsts_project_name = work_item["fields"]["System.TeamProject"]
        work_item_type = work_item["fields"]["System.WorkItemType"]

        vsts_projects = client.get_projects()

        vsts_project_id = None
        for p in vsts_projects:
            if p["name"] == vsts_project_name:
                vsts_project_id = p["id"]
                break

        integration_external_project = integration_service.get_integration_external_project(
            organization_id=external_issue.organization_id,
            integration_id=external_issue.integration_id,
            external_id=vsts_project_id,
        )
        if integration_external_project is None:
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
            integration_external_project.resolved_status
            if is_resolved
            else integration_external_project.unresolved_status
        )

        try:
            client.update_work_item(external_issue.key, state=status)
        except ApiUnauthorized as error:
            self.logger.info(
                "vsts.failed-to-change-status",
                extra={
                    "integration_id": external_issue.integration_id,
                    "is_resolved": is_resolved,
                    "issue_key": external_issue.key,
                    "exception": error,
                },
            )
            raise
        except ApiError as error:
            # Check if this is an invalid state error
            error_message = str(error)
            if "not in the list of supported values" in error_message and "State" in error_message:
                self.logger.info(
                    "vsts.invalid-state-attempting-fallback",
                    extra={
                        "integration_id": external_issue.integration_id,
                        "is_resolved": is_resolved,
                        "issue_key": external_issue.key,
                        "configured_status": status,
                        "work_item_type": work_item_type,
                        "exception": error,
                    },
                )
                # Try to find a valid fallback state
                fallback_status = self._find_fallback_state(
                    client, vsts_project_id, work_item_type, is_resolved
                )
                if fallback_status:
                    self.logger.info(
                        "vsts.using-fallback-state",
                        extra={
                            "integration_id": external_issue.integration_id,
                            "is_resolved": is_resolved,
                            "issue_key": external_issue.key,
                            "configured_status": status,
                            "fallback_status": fallback_status,
                            "work_item_type": work_item_type,
                        },
                    )
                    try:
                        client.update_work_item(external_issue.key, state=fallback_status)
                        return
                    except Exception as fallback_error:
                        self.logger.warning(
                            "vsts.fallback-state-failed",
                            extra={
                                "integration_id": external_issue.integration_id,
                                "is_resolved": is_resolved,
                                "issue_key": external_issue.key,
                                "fallback_status": fallback_status,
                                "exception": fallback_error,
                            },
                        )
                # If we couldn't find or apply a fallback, log and skip the sync
                self.logger.warning(
                    "vsts.status-sync-skipped-invalid-state",
                    extra={
                        "integration_id": external_issue.integration_id,
                        "is_resolved": is_resolved,
                        "issue_key": external_issue.key,
                        "configured_status": status,
                        "work_item_type": work_item_type,
                    },
                )
                return
            # For other errors, use the standard error handling
            self.raise_error(error)
        except Exception as e:
            self.raise_error(e)

    def get_resolve_sync_action(self, data: Mapping[str, Any]) -> ResolveSyncAction:
        done_states = self._get_done_statuses(data["project"])
        return ResolveSyncAction.from_resolve_unresolve(
            should_resolve=(
                not data["old_state"] in done_states and data["new_state"] in done_states
            ),
            should_unresolve=(not data["new_state"] in done_states or data["old_state"] is None),
        )

    def _get_done_statuses(self, project: str) -> set[str]:
        client = self.get_client()
        try:
            all_states = client.get_work_item_states(project)["value"]
        except ApiError as err:
            self.logger.info(
                "vsts.get-done-states.failed",
                extra={"integration_id": self.model.id, "exception": err},
            )
            return set()
        return {state["name"] for state in all_states if state["category"] in self.done_categories}

    def _find_fallback_state(
        self, client, project_id: str, work_item_type: str, is_resolved: bool
    ) -> str | None:
        """
        Find a valid fallback state for a work item type when the configured state is invalid.
        
        For resolved states, looks for states in done categories (Resolved, Completed, Closed).
        For unresolved states, looks for active states (New, Active, etc.).
        """
        try:
            states_response = client.get_work_item_states_for_type(project_id, work_item_type)
            valid_states = states_response.get("value", [])
            
            if not valid_states:
                return None
            
            if is_resolved:
                # Look for states in done categories
                for state in valid_states:
                    if state.get("category") in self.done_categories:
                        return state["name"]
            else:
                # Look for active/new states (not in done categories)
                for state in valid_states:
                    if state.get("category") not in self.done_categories:
                        return state["name"]
            
            # If no category-appropriate state found, return the first valid state
            if valid_states:
                return valid_states[0]["name"]
                
        except Exception as err:
            self.logger.warning(
                "vsts.find-fallback-state-failed",
                extra={
                    "integration_id": self.model.id,
                    "work_item_type": work_item_type,
                    "exception": err,
                },
            )
        
        return None

    def get_issue_display_name(self, external_issue: ExternalIssue) -> str:
        return (external_issue.metadata or {}).get("display_name", "")

    def create_comment(self, issue_id: int, user_id: int, group_note: Activity) -> Response:
        comment = group_note.data["text"]
        quoted_comment = self.create_comment_attribution(user_id, comment)
        return self.get_client().update_work_item(issue_id, comment=quoted_comment)

    def create_comment_attribution(self, user_id: int, comment_text: str) -> str:
        # VSTS uses markdown or xml
        # https://docs.microsoft.com/en-us/microsoftteams/platform/concepts/bots/bots-text-formats
        user = user_service.get_user(user_id=user_id)
        if user is None:
            return comment_text
        attribution = f"{user.name} wrote:\n\n"
        quoted_comment = f"{attribution}<blockquote>{comment_text}</blockquote>"
        return quoted_comment

    def update_comment(self, issue_id: int, user_id: int, group_note: str) -> None:
        # Azure does not support updating comments.
        pass

    def search_issues(self, query: str | None, **kwargs) -> dict[str, Any]:
        client = self.get_client()

        integration = integration_service.get_integration(
            integration_id=self.org_integration.integration_id, status=ObjectStatus.ACTIVE
        )
        if not integration:
            raise IntegrationError("Azure DevOps integration not found")

        resp = client.search_issues(query=query, account_name=integration.name)
        assert isinstance(resp, dict)
        return resp
