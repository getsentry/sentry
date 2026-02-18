from __future__ import annotations

import enum
import logging
import re
from abc import ABC, abstractmethod
from collections import defaultdict
from collections.abc import Mapping, Sequence
from copy import deepcopy
from operator import attrgetter
from typing import TYPE_CHECKING, Any, ClassVar

from sentry import features
from sentry.integrations.base import IntegrationInstallation
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.models.integration import Integration
from sentry.integrations.services.assignment_source import AssignmentSource
from sentry.integrations.services.integration import integration_service
from sentry.integrations.tasks.sync_status_inbound import (
    sync_status_inbound as sync_status_inbound_task,
)
from sentry.issues.grouptype import GroupCategory
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.notifications.utils import get_notification_group_title
from sentry.services.eventstore.models import GroupEvent
from sentry.shared_integrations.exceptions import IntegrationError
from sentry.silo.base import all_silo_function, region_silo_function
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.users.services.user_option import get_option_from_list, user_option_service
from sentry.utils.http import absolute_uri
from sentry.utils.safe import safe_execute

if TYPE_CHECKING:
    from sentry.integrations.services.integration import RpcIntegration

logger = logging.getLogger("sentry.integrations.issues")
ENHANCED_DEFAULTS_FEATURE = "organizations:integrations-issue-defaults-enhanced"
MARKDOWN_TEXT_CLEANUP_RE = re.compile(r"[*`#]")
SQL_EVIDENCE_PREFIX_RE = re.compile(
    r"^(db|database)\s*-\s*(select|insert|update|delete|with)\b", re.I
)
FULL_EVIDENCE_NAME_PARTS = frozenset({"query", "offending spans"})
MAX_CHAR = 50
MAX_TITLE_LENGTH = 255
MAX_EVIDENCE_ITEMS = 8
MAX_EVIDENCE_VALUE_LENGTH = 140
MAX_EVENT_CONTEXT_LENGTH = 1200


class ResolveSyncAction(enum.Enum):
    """
    When an issue's state changes, we may have to sync the state based on the
    "done" states we get from the API. This enum encapsulates the three options
    we have: "resolve", "unresolve", or "do nothing".
    """

    NOOP = 0
    RESOLVE = 1
    UNRESOLVE = 2

    @classmethod
    def from_resolve_unresolve(
        cls, should_resolve: bool, should_unresolve: bool
    ) -> ResolveSyncAction:
        if should_resolve and should_unresolve:
            logger.warning("sync-config-conflict")
            return ResolveSyncAction.NOOP

        if should_resolve:
            return ResolveSyncAction.RESOLVE

        if should_unresolve:
            return ResolveSyncAction.UNRESOLVE

        return ResolveSyncAction.NOOP


class IssueBasicIntegration(IntegrationInstallation, ABC):
    def should_sync(self, attribute, sync_source: AssignmentSource | None = None) -> bool:
        return False

    def get_group_title(self, group, event, **kwargs):
        return get_notification_group_title(group, event, **kwargs)

    @abstractmethod
    def get_issue_url(self, key: str) -> str:
        """
        Given the key of the external_issue return the external issue link.
        """
        raise NotImplementedError

    def get_group_body(self, group, event, **kwargs):
        result = []
        for interface in event.interfaces.values():
            output = safe_execute(interface.to_string, event)
            if output:
                result.append(output)
        return "\n\n".join(result)

    def get_feedback_issue_body(self, occurrence: IssueOccurrence) -> str:
        messages = []
        others = []
        for evidence in occurrence.evidence_display:
            if evidence.name == "message":
                messages.append(evidence)
            else:
                others.append(evidence)

        body = ""
        for message in messages:
            body += message.value
            body += "\n\n"

        body += "|  |  |\n"
        body += "| ------------- | --------------- |\n"
        for evidence in sorted(others, key=attrgetter("important"), reverse=True):
            body += f"| **{evidence.name}** | {evidence.value} |\n"

        return body.rstrip("\n")  # remove the last new line

    def get_group_link(self, group, **kwargs):
        params = {}
        if kwargs.get("link_referrer"):
            params["referrer"] = kwargs.get("link_referrer")

        if group.issue_category == GroupCategory.FEEDBACK:
            return [
                f"Sentry Feedback: [{group.qualified_short_id}]({absolute_uri(group.get_absolute_url(params=params))})\n"
            ]

        return [
            f"Sentry Issue: [{group.qualified_short_id}]({absolute_uri(group.get_absolute_url(params=params))})"
        ]

    def get_group_description(self, group, event, **kwargs):
        output = self.get_group_link(group, **kwargs)
        if (
            event
            and isinstance(event, GroupEvent)
            and event.occurrence is not None
            and group.issue_category == GroupCategory.FEEDBACK
        ):
            body = ""
            body = self.get_feedback_issue_body(event.occurrence)
            output.extend([body])
        else:
            body = self.get_group_body(group, event)
            if body:
                output.extend(["", "```", body, "```"])
        return "\n".join(output)

    def _has_enhanced_defaults_flag(self, group: Group, user: User | RpcUser) -> bool:
        return features.has(
            ENHANCED_DEFAULTS_FEATURE,
            group.organization,
            actor=user,
        )

    def _clean_text(self, value: Any, max_length: int | None = None) -> str:
        if value is None:
            return ""

        text = MARKDOWN_TEXT_CLEANUP_RE.sub("", str(value))
        text = " ".join(text.split())
        if max_length and len(text) > max_length:
            return f"{text[: max_length - 3]}..."
        return text

    def _get_occurrence_detail_lines(self, evidence_data: Mapping[str, Any]) -> list[str]:
        lines: list[str] = []
        for key, value in evidence_data.items():
            if value is None:
                continue
            if isinstance(value, (str, int, float, bool)):
                lines.append(
                    f"- {key}: {self._clean_text(value, max_length=MAX_EVIDENCE_VALUE_LENGTH)}"
                )
            if len(lines) >= MAX_EVIDENCE_ITEMS:
                break
        return lines

    def _is_query_like_evidence(self, evidence_name: str, evidence_value: Any) -> bool:
        cleaned_name = self._clean_text(evidence_name).lower()
        if any(name_part in cleaned_name for name_part in FULL_EVIDENCE_NAME_PARTS):
            return True

        cleaned_value = self._clean_text(evidence_value)
        return bool(SQL_EVIDENCE_PREFIX_RE.search(cleaned_value))

    def _get_formatted_evidence_lines(self, evidence_name: str, evidence_value: Any) -> list[str]:
        cleaned_name = self._clean_text(evidence_name)
        if self._is_query_like_evidence(evidence_name, evidence_value):
            return [f"{cleaned_name}:", "```", self._clean_text(evidence_value), "```"]

        return [
            f"- {cleaned_name}: {self._clean_text(evidence_value, max_length=MAX_EVIDENCE_VALUE_LENGTH)}"
        ]

    def _get_plain_issue_link(self, group: Group, **kwargs: Any) -> str:
        params = {}
        if kwargs.get("link_referrer"):
            params["referrer"] = kwargs.get("link_referrer")
        issue_url = absolute_uri(group.get_absolute_url(params=params))

        if group.issue_category == GroupCategory.FEEDBACK:
            return f"Sentry Feedback: {group.qualified_short_id} ({issue_url})"

        return f"Sentry Issue: {group.qualified_short_id} ({issue_url})"

    def _get_enhanced_title_description(
        self, group: Group, event: GroupEvent, **kwargs: Any
    ) -> tuple[str, str]:
        title = self._clean_text(self.get_group_title(group, event, **kwargs), MAX_TITLE_LENGTH)
        output = [self._get_plain_issue_link(group, **kwargs)]

        if event.occurrence is not None:
            issue_title = self._clean_text(event.occurrence.issue_title)
            if issue_title:
                title = self._clean_text(issue_title, MAX_TITLE_LENGTH)
                output.extend(["", f"Issue Type: {issue_title}"])

            subtitle = self._clean_text(event.occurrence.subtitle, MAX_EVENT_CONTEXT_LENGTH)
            if subtitle:
                output.append(f"Summary: {subtitle}")

            important_evidence = event.occurrence.important_evidence_display
            if important_evidence:
                important_value = self._clean_text(
                    important_evidence.value, MAX_EVIDENCE_VALUE_LENGTH
                )
                title = self._clean_text(
                    f"{title}: {important_value}" if important_value else title,
                    MAX_TITLE_LENGTH,
                )

            evidence_items = sorted(
                event.occurrence.evidence_display, key=attrgetter("important"), reverse=True
            )[:MAX_EVIDENCE_ITEMS]
            if evidence_items:
                output.extend(["", "Evidence:"])
                for evidence in evidence_items:
                    output.extend(self._get_formatted_evidence_lines(evidence.name, evidence.value))
            else:
                detail_lines = self._get_occurrence_detail_lines(event.occurrence.evidence_data)
                if detail_lines:
                    output.extend(["", "Details:", *detail_lines])
        else:
            body = self.get_group_body(group, event)
            if body:
                output.extend(
                    [
                        "",
                        "Event Context:",
                        self._clean_text(body, max_length=MAX_EVENT_CONTEXT_LENGTH),
                    ]
                )

        return title, "\n".join(output)

    @all_silo_function
    def get_create_issue_config(
        self, group: Group | None, user: User | RpcUser, **kwargs
    ) -> list[dict[str, Any]]:
        """
        These fields are used to render a form for the user,
        and are then passed in the format of:

        >>>{'title': 'TypeError: Object [object Object] has no method "updateFrom"'}

        to `create_issue`, which handles creation of the issue
        in Jira, VSTS, GitHub, etc
        """
        if not group:
            return []

        event = group.get_latest_event()
        if event is None:
            return []

        if self._has_enhanced_defaults_flag(group, user):
            title, description = self._get_enhanced_title_description(group, event, **kwargs)
        else:
            title = self.get_group_title(group, event, **kwargs)
            description = self.get_group_description(group, event, **kwargs)

        return [
            {
                "name": "title",
                "label": "Title",
                "default": title,
                "type": "string",
                "required": True,
            },
            {
                "name": "description",
                "label": "Description",
                "default": description,
                "type": "textarea",
                "autosize": True,
                "maxRows": 10,
            },
        ]

    def get_link_issue_config(self, group, **kwargs):
        """
        Used by the `GroupIntegrationDetailsEndpoint` to create an
        `ExternalIssue` using title/description obtained from calling
        `get_issue` described below.
        """
        return [{"name": "externalIssue", "label": "Issue", "default": "", "type": "string"}]

    @abstractmethod
    def get_persisted_default_config_fields(self) -> Sequence[str]:
        """
        Returns a list of field names that should have their last used values
        persisted on a per-project basis.
        """
        return []

    def get_persisted_user_default_config_fields(self):
        """
        Returns a list of field names that should have their last used values
        persisted on a per-project, per-user basis.
        """
        return []

    def store_issue_last_defaults(self, project: Project, user: RpcUser | User, data):
        """
        Stores the last used field defaults on a per-project basis. This
        accepts a dict of values that will be filtered to keys returned by
        ``get_persisted_default_config_fields`` which will automatically be
        merged into the associated field config object as the default.

        >>> integ.store_issue_last_defaults(project, user, {'externalProject': 2})

        When the integration is serialized these values will automatically be
        merged into the field configuration objects.

        NOTE: These are currently stored for both link and create issue, no
              differentiation is made between the two field configs.
        """
        persisted_fields = self.get_persisted_default_config_fields()
        if persisted_fields and self.org_integration:
            project_defaults = {k: v for k, v in data.items() if k in persisted_fields}
            new_config = deepcopy(self.org_integration.config)
            new_config.setdefault("project_issue_defaults", {}).setdefault(
                str(project.id), {}
            ).update(project_defaults)
            org_integration = integration_service.update_organization_integration(
                org_integration_id=self.org_integration.id,
                config=new_config,
            )
            if org_integration is not None:
                self.org_integration = org_integration

        user_persisted_fields = self.get_persisted_user_default_config_fields()
        if user_persisted_fields:
            user_defaults = {k: v for k, v in data.items() if k in user_persisted_fields}
            user_option_key = dict(key="issue:defaults", project_id=project.id)
            options = user_option_service.get_many(
                filter={"user_ids": [user.id], **user_option_key}
            )
            new_user_defaults = get_option_from_list(options, default={}, key="issue:defaults")
            new_user_defaults.setdefault(self.model.provider, {}).update(user_defaults)
            if user_defaults != new_user_defaults:
                user_option_service.set_option(
                    user_id=user.id, value=new_user_defaults, **user_option_key
                )

    def get_defaults(self, project: Project, user: User | RpcUser):
        project_defaults = (
            {}
            if not self.org_integration
            else self.org_integration.config.get("project_issue_defaults", {}).get(
                str(project.id), {}
            )
        )

        user_option_value = get_option_from_list(
            user_option_service.get_many(
                filter={"user_ids": [user.id], "keys": ["issue:defaults"], "project_id": project.id}
            ),
            key="issue:defaults",
            default={},
        )

        user_defaults = user_option_value.get(self.model.provider, {})

        return {**project_defaults, **user_defaults}

    @abstractmethod
    def create_issue(self, data, **kwargs):
        """
        Create an issue via the provider's API and return the issue key,
        title and description.

        Should also handle API client exceptions and reraise as an
        IntegrationError (using the `message_from_error` helper).

        >>> def create_issue(self, data, **kwargs):
        >>>     resp = self.get_client().create_issue(data)
        >>>     return {
        >>>         'key': resp['id'],
        >>>         'title': resp['title'],
        >>>         'description': resp['description'],
        >>>     }
        """
        raise NotImplementedError

    @abstractmethod
    def get_issue(self, issue_id, **kwargs):
        """
        Get an issue via the provider's API and return the issue key,
        title and description.

        Should also handle API client exceptions and reraise as an
        IntegrationError (using the `message_from_error` helper).

        >>> def get_issue(self, data, **kwargs):
        >>>     resp = self.get_client().get_issue(issue_id)
        >>>     return {
        >>>         'key': resp['id'],
        >>>         'title': resp['title'],
        >>>         'description': resp['description'],
        >>>     }
        """
        raise NotImplementedError

    @abstractmethod
    def search_issues(self, query: str | None, **kwargs) -> list[dict[str, Any]] | dict[str, Any]:
        raise NotImplementedError

    def after_link_issue(self, external_issue, **kwargs):
        """
        Takes the external issue that has been linked via `get_issue`.

        Does anything needed after an issue has been linked, i.e. creating
        a comment for a linked issue.
        """

    def make_external_key(self, data):
        """
        Takes result of `get_issue` or `create_issue` and returns the formatted key
        """
        return data["key"]

    def get_issue_display_name(self, external_issue):
        """
        Returns the display name of the issue.

        This is not required but helpful for integrations whose external issue key
        does not match the desired display name.
        """
        return ""

    def get_annotations_for_group_list(self, group_list):
        group_links = GroupLink.objects.filter(
            group_id__in=[group.id for group in group_list],
            project_id__in=list({group.project.id for group in group_list}),
            linked_type=GroupLink.LinkedType.issue,
            relationship=GroupLink.Relationship.references,
        )

        external_issues = ExternalIssue.objects.filter(
            id__in=[group_link.linked_id for group_link in group_links],
            integration_id=self.model.id,
        )

        # group annotations by group id
        annotations_by_group_id = defaultdict(list)
        for group_link in group_links:
            issues_for_group = filter(lambda x: x.id == group_link.linked_id, external_issues)
            annotations = self.map_external_issues_to_annotations(issues_for_group)
            annotations_by_group_id[group_link.group_id].extend(annotations)

        return annotations_by_group_id

    def map_external_issues_to_annotations(self, external_issues):
        annotations = []
        for ei in external_issues:
            link = self.get_issue_url(ei.key)
            label = self.get_issue_display_name(ei) or ei.key
            annotations.append({"url": link, "displayName": label})

        return annotations

    def get_comment_id(self, comment):
        return comment["id"]

    def create_comment(self, issue_id, user_id, group_note):
        pass

    def update_comment(self, issue_id, user_id, group_note):
        pass


@region_silo_function
def where_should_sync(
    integration: RpcIntegration | Integration,
    key: str,
    organization_id: int | None = None,
) -> Sequence[Organization]:
    """
    Given an integration, get the list of organizations where the sync type in
    `key` is enabled. If an optional `organization_id` is passed, then only
    check the integration for that organization.
    """
    kwargs = dict()
    if organization_id is not None:
        kwargs["id"] = organization_id
        ois = integration_service.get_organization_integrations(
            integration_id=integration.id, organization_id=organization_id
        )
    else:
        ois = integration_service.get_organization_integrations(integration_id=integration.id)

    organizations = Organization.objects.filter(id__in=[oi.organization_id for oi in ois])
    ret = []
    for organization in organizations.filter(**kwargs):
        if features.has("organizations:integrations-issue-sync", organization):
            installation = integration.get_installation(organization_id=organization.id)
            if isinstance(installation, IssueBasicIntegration) and installation.should_sync(key):
                ret.append(organization)
    return ret


class IntegrationSyncTargetNotFound(IntegrationError):
    pass


class IssueSyncIntegration(IssueBasicIntegration, ABC):
    comment_key: ClassVar[str | None] = None
    outbound_status_key: ClassVar[str | None] = None
    inbound_status_key: ClassVar[str | None] = None
    outbound_assignee_key: ClassVar[str | None] = None
    inbound_assignee_key: ClassVar[str | None] = None

    def should_sync(self, attribute: str, sync_source: AssignmentSource | None = None) -> bool:
        key = getattr(self, f"{attribute}_key", None)
        if key is None or self.org_integration is None:
            return False

        # Check that the assignment source isn't this same integration in order to
        # prevent sync-cycles from occurring. This should still allow other
        # integrations to propagate changes outward.
        if sync_source and sync_source.integration_id == self.org_integration.integration_id:
            return False

        value: bool = self.org_integration.config.get(key, False)
        return value

    @abstractmethod
    def sync_assignee_outbound(
        self,
        external_issue: ExternalIssue,
        user: RpcUser | None,
        assign: bool = True,
        **kwargs: Any,
    ) -> None:
        """
        Propagate a sentry issue's assignee to a linked issue's assignee.
        If assign=True, we're assigning the issue. Otherwise, deassign.
        """
        raise NotImplementedError

    @abstractmethod
    def sync_status_outbound(
        self, external_issue: ExternalIssue, is_resolved: bool, project_id: int
    ) -> None:
        """
        Propagate a sentry issue's status to a linked issue's status.
        """
        raise NotImplementedError

    @abstractmethod
    def get_resolve_sync_action(self, data: Mapping[str, Any]) -> ResolveSyncAction:
        """
        Given webhook data, check whether the status category changed FROM
        "done" to something else, meaning the Sentry issue should be marked as
        unresolved or if the status category changed TO "done" from something
        else, meaning the sentry issue should be marked as resolved.

        Because checking the "done" states can rely on an API call, this function
        should calculate both "resolve" and "unresolve" to save a round trip.
        """
        raise NotImplementedError

    def sync_status_inbound(self, issue_key: str, data: Mapping[str, Any]) -> None:
        if not where_should_sync(self.model, "inbound_status", self.organization_id):
            return None

        sync_status_inbound_task.apply_async(
            kwargs={
                "integration_id": self.model.id,
                "organization_id": self.organization_id,
                "issue_key": issue_key,
                "data": data,
            }
        )

    def migrate_issues(self):
        """
        Migrate the corresponding plugin's issues to the integration and disable the plugins.
        """
        pass
