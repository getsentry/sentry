from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from operator import attrgetter
from typing import Any, NoReturn

from django.urls import reverse

from sentry import features
from sentry.constants import ObjectStatus
from sentry.incidents.utils.format_duration import format_duration_idiomatic
from sentry.integrations.metric_alerts import build_title_link
from sentry.integrations.mixins.issues import MAX_CHAR
from sentry.integrations.models.external_issue import ExternalIssue
from sentry.integrations.source_code_management.issues import SourceCodeIssueIntegration
from sentry.issues.grouptype import GroupCategory
from sentry.issues.issue_occurrence import IssueOccurrence
from sentry.models.group import Group
from sentry.models.repository import Repository
from sentry.organizations.services.organization.service import organization_service
from sentry.services.eventstore.models import Event, GroupEvent
from sentry.shared_integrations.exceptions import (
    ApiError,
    IntegrationConfigurationError,
    IntegrationError,
    IntegrationFormError,
    IntegrationResourceNotFoundError,
)
from sentry.silo.base import all_silo_function
from sentry.users.models.identity import Identity
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser
from sentry.utils.http import absolute_uri
from sentry.utils.strings import truncatechars

PAGE_NUMBER_LIMIT = 1
GITHUB_ENHANCED_DEFAULTS_FEATURE = "organizations:integrations-github-issue-defaults-enhanced"
MAX_TITLE_LENGTH = 255
MAX_EVIDENCE_ITEMS = 8
MAX_EVIDENCE_VALUE_LENGTH = 140
MAX_EVENT_CONTEXT_LENGTH = 1200
CODE_BLOCK_EVIDENCE_NAME_PARTS = frozenset({"query", "offending spans", "selector path"})


class GitHubIssuesSpec(SourceCodeIssueIntegration):
    _METRIC_CONDITION_LABELS = {
        "gt": "Above",
        "gte": "At or above",
        "lt": "Below",
        "lte": "At or below",
        "eq": "Equal to",
        "ne": "Not equal to",
    }

    def _get_metric_issue_body(self, group: Group, occurrence: IssueOccurrence) -> str:
        details: list[str] = ["Metric Details:"]

        alert_id = occurrence.evidence_data.get("alert_id")
        try:
            alert_rule_id = int(alert_id)
        except (TypeError, ValueError):
            alert_rule_id = None

        if alert_rule_id is not None:
            details.append(
                "- **Metric Alert**: "
                f"[View alert rule]({build_title_link(alert_rule_id, group.organization, {'referrer': 'github_integration'})})"
            )

        snuba_query: Mapping[str, Any] = {}
        raw_data_sources = occurrence.evidence_data.get("data_sources")
        if isinstance(raw_data_sources, list):
            for data_source in raw_data_sources:
                if not isinstance(data_source, Mapping):
                    continue
                query_obj = data_source.get("query_obj")
                if not isinstance(query_obj, Mapping):
                    continue
                maybe_query = query_obj.get("snuba_query")
                if isinstance(maybe_query, Mapping):
                    snuba_query = maybe_query
                    break

        dataset = self._normalize_text(
            snuba_query.get("dataset"), normalize_whitespace=True
        ).replace("_", " ")
        if dataset:
            details.append(f"- **Dataset**: {dataset.capitalize()}")

        aggregate = self._normalize_text(
            snuba_query.get("aggregate"), MAX_EVIDENCE_VALUE_LENGTH, normalize_whitespace=True
        )
        if aggregate:
            details.append(f"- **Aggregate**: {aggregate}")

        raw_time_window = snuba_query.get("time_window", snuba_query.get("timeWindow"))
        try:
            time_window_minutes = int(float(raw_time_window)) // 60
        except (TypeError, ValueError):
            time_window_minutes = 0
        if time_window_minutes > 0:
            interval = format_duration_idiomatic(time_window_minutes)
            if " " not in interval:
                interval = f"1 {interval}"
            details.append(f"- **Interval**: {interval}")

        raw_conditions = occurrence.evidence_data.get("conditions")
        selected_condition: Mapping[str, Any] | None = None
        if isinstance(raw_conditions, list):
            priority = occurrence.priority
            if priority is not None:
                selected_condition = next(
                    (
                        condition
                        for condition in raw_conditions
                        if isinstance(condition, Mapping)
                        and (
                            condition.get("condition_result") == priority
                            or str(condition.get("condition_result")) == str(priority)
                        )
                    ),
                    None,
                )
            if selected_condition is None:
                selected_condition = next(
                    (condition for condition in raw_conditions if isinstance(condition, Mapping)),
                    None,
                )

        if selected_condition is not None:
            condition_type = self._normalize_text(
                selected_condition.get("type"), normalize_whitespace=True
            ).lower()
            comparison = self._normalize_text(
                selected_condition.get("comparison"), normalize_whitespace=True
            )
            condition = self._METRIC_CONDITION_LABELS.get(condition_type, condition_type)
            if comparison:
                condition = f"{condition} {comparison}"
            details.append(f"- **Condition**: {condition}")

        raw_value = occurrence.evidence_data.get("value")
        if isinstance(raw_value, bool):
            value = str(raw_value)
        elif isinstance(raw_value, (int, float)):
            value = f"{raw_value:,}"
        else:
            value = self._normalize_text(
                raw_value, MAX_EVIDENCE_VALUE_LENGTH, normalize_whitespace=True
            )
        if value:
            details.append(f"- **Evaluated Value**: {value}")

        if len(details) == 1:
            details.append("- No metric details available.")

        return "\n".join(details)

    def _truncate_text(self, value: str, max_length: int | None = None) -> str:
        if max_length and len(value) > max_length:
            return f"{value[: max_length - 3]}..."
        return value

    def _normalize_text(
        self, value: Any, max_length: int | None = None, normalize_whitespace: bool = False
    ) -> str:
        if value is None:
            return ""
        text = str(value)
        if normalize_whitespace:
            text = " ".join(text.split())
        return self._truncate_text(text, max_length)

    def _has_github_enhanced_defaults_flag(self, group: Group, user: User | RpcUser) -> bool:
        return features.has(GITHUB_ENHANCED_DEFAULTS_FEATURE, group.organization, actor=user)

    def _get_occurrence_evidence_section_title(self, occurrence: IssueOccurrence) -> str:
        category = occurrence.type.category_v2
        if category == GroupCategory.DB_QUERY.value:
            return "Query Evidence"
        if category == GroupCategory.HTTP_CLIENT.value:
            return "Request Evidence"
        if category == GroupCategory.FRONTEND.value:
            return "Interaction Evidence"
        return "Evidence"

    def _get_occurrence_details_section_title(self, occurrence: IssueOccurrence) -> str:
        category = occurrence.type.category_v2
        if category == GroupCategory.METRIC.value:
            return "Metric Details"
        if category == GroupCategory.FRONTEND.value:
            return "Interaction Details"
        return "Details"

    def _is_code_block_evidence(self, evidence_name: str) -> bool:
        normalized_name = evidence_name.lower()
        return any(part in normalized_name for part in CODE_BLOCK_EVIDENCE_NAME_PARTS)

    def _get_formatted_evidence_lines(self, evidence_name: str, evidence_value: Any) -> list[str]:
        name = self._normalize_text(evidence_name, normalize_whitespace=True)
        value = str(evidence_value)
        if self._is_code_block_evidence(name):
            return [f"{name}:", "```", value, "```"]
        return [
            f"{name}: {self._normalize_text(value, MAX_EVIDENCE_VALUE_LENGTH, normalize_whitespace=True)}"
        ]

    def _get_occurrence_detail_lines(self, evidence_data: Mapping[str, Any]) -> list[str]:
        lines: list[str] = []
        added_items = 0
        for key, value in evidence_data.items():
            if value is None or not isinstance(value, (str, int, float, bool)):
                continue
            lines.extend(self._get_formatted_evidence_lines(str(key), value))
            added_items += 1
            if added_items >= MAX_EVIDENCE_ITEMS:
                break
        return lines

    def _get_github_enhanced_title_description(
        self, group: Group, event: Event | GroupEvent, **kwargs: Any
    ) -> tuple[str, str]:
        title = self._normalize_text(
            self.get_group_title(group, event, **kwargs),
            MAX_TITLE_LENGTH,
            normalize_whitespace=True,
        )
        output = self.get_group_link(group, **kwargs)

        if isinstance(event, GroupEvent) and event.occurrence is not None:
            issue_title = self._normalize_text(
                event.occurrence.issue_title,
                MAX_TITLE_LENGTH,
                normalize_whitespace=True,
            )
            if issue_title:
                title = issue_title
                output.extend(["", f"Issue Type: {issue_title}"])

            subtitle = self._normalize_text(
                event.occurrence.subtitle,
                MAX_EVENT_CONTEXT_LENGTH,
                normalize_whitespace=True,
            )
            if subtitle:
                output.append(f"Summary: {subtitle}")

            important_evidence = event.occurrence.important_evidence_display
            if important_evidence:
                important_value = self._normalize_text(
                    important_evidence.value,
                    MAX_EVIDENCE_VALUE_LENGTH,
                    normalize_whitespace=True,
                )
                if important_value:
                    title = self._normalize_text(
                        f"{title}: {important_value}",
                        MAX_TITLE_LENGTH,
                        normalize_whitespace=True,
                    )

            evidence_items = sorted(
                event.occurrence.evidence_display, key=attrgetter("important"), reverse=True
            )[:MAX_EVIDENCE_ITEMS]
            if evidence_items:
                output.extend(
                    ["", f"{self._get_occurrence_evidence_section_title(event.occurrence)}:"]
                )
                for evidence in evidence_items:
                    output.extend(self._get_formatted_evidence_lines(evidence.name, evidence.value))
            else:
                if event.occurrence.type.category_v2 == GroupCategory.METRIC.value:
                    output.extend(
                        [
                            "",
                            self._get_metric_issue_body(group, event.occurrence),
                        ]
                    )
                else:
                    detail_lines = self._get_occurrence_detail_lines(event.occurrence.evidence_data)
                    if detail_lines:
                        output.extend(
                            [
                                "",
                                f"{self._get_occurrence_details_section_title(event.occurrence)}:",
                                *detail_lines,
                            ]
                        )
        else:
            body = self.get_group_body(group, event)
            if body:
                output.extend(
                    [
                        "",
                        "Event Context:",
                        "```",
                        self._truncate_text(body, MAX_EVENT_CONTEXT_LENGTH),
                        "```",
                    ]
                )

        return title, "\n".join(output)

    def _get_create_issue_fields(
        self, group: Group, user: User | RpcUser, **kwargs: Any
    ) -> list[dict[str, Any]]:
        event = group.get_latest_event()
        if event is None:
            return []

        if self._has_github_enhanced_defaults_flag(group, user):
            title, description = self._get_github_enhanced_title_description(group, event, **kwargs)
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

    def raise_error(self, exc: Exception, identity: Identity | None = None) -> NoReturn:
        if isinstance(exc, ApiError):
            if exc.code == 422:
                invalid_fields = {}
                if exc.json is not None:
                    for e in exc.json.get("errors", []):
                        field = e.get("field", "unknown field")
                        code = e.get("code", "invalid")
                        value = e.get("value", "unknown value")

                        invalid_fields[field] = f"Got {code} value: {value} for field: {field}"
                        raise IntegrationFormError(invalid_fields) from exc
                    raise IntegrationFormError(
                        {"detail": "Some given field was misconfigured"}
                    ) from exc
            elif exc.code == 410:
                raise IntegrationConfigurationError(
                    "Issues are disabled for this repository, please check your repository permissions"
                ) from exc
            elif exc.code == 404:
                raise IntegrationResourceNotFoundError from exc
            elif exc.code == 403:
                if exc.json is not None:
                    detail = exc.json.get("message")
                    if detail:
                        raise IntegrationConfigurationError(detail) from exc

                raise IntegrationConfigurationError(
                    "You are not authorized to create issues in this repository. Please check your repository permissions."
                ) from exc

        raise super().raise_error(exc=exc, identity=identity)

    def make_external_key(self, data: Mapping[str, Any]) -> str:
        return "{}#{}".format(data["repo"], data["key"])

    def get_issue_url(self, key: str) -> str:
        domain_name, user = self.model.metadata["domain_name"].split("/")
        repo, issue_id = key.split("#")
        return f"https://{domain_name}/{repo}/issues/{issue_id}"

    def get_feedback_issue_body(self, occurrence: IssueOccurrence) -> str:
        messages = [
            evidence for evidence in occurrence.evidence_display if evidence.name == "message"
        ]
        others = [
            evidence for evidence in occurrence.evidence_display if evidence.name != "message"
        ]

        body = ""
        for message in messages:
            body += message.value
            body += "\n\n"

        body += "|  |  |\n"
        body += "| ------------- | --------------- |\n"
        for evidence in sorted(others, key=attrgetter("important"), reverse=True):
            body += f"| **{evidence.name}** | {evidence.value} |\n"

        return body.rstrip("\n")  # remove the last new line

    def get_generic_issue_body(self, group: Group, occurrence: IssueOccurrence) -> str:
        if (
            occurrence.type.category_v2 == GroupCategory.METRIC.value
            and len(occurrence.evidence_display) == 0
        ):
            return self._get_metric_issue_body(group, occurrence)

        body = "|  |  |\n"
        body += "| ------------- | --------------- |\n"
        for evidence in sorted(
            occurrence.evidence_display, key=attrgetter("important"), reverse=True
        ):
            body += f"| **{evidence.name}** | {truncatechars(evidence.value, MAX_CHAR)} |\n"

        return body[:-2]

    def get_group_description(self, group: Group, event: Event | GroupEvent, **kwargs: Any) -> str:
        output = self.get_group_link(group, **kwargs)

        if isinstance(event, GroupEvent) and event.occurrence is not None:
            body = ""
            if group.issue_category == GroupCategory.FEEDBACK:
                body = self.get_feedback_issue_body(event.occurrence)
            else:
                body = self.get_generic_issue_body(group, event.occurrence)
            output.extend([body])
        else:
            body = self.get_group_body(group, event)
            if body:
                output.extend(["", "```", body, "```"])
        return "\n".join(output)

    def after_link_issue(self, external_issue: ExternalIssue, **kwargs: Any) -> None:
        data = kwargs["data"]
        client = self.get_client()

        repo, issue_num = external_issue.key.split("#")
        if not repo:
            raise IntegrationFormError({"repo": "Repository is required"})

        if not issue_num:
            raise IntegrationFormError({"externalIssue": "Issue number is required"})

        comment = data.get("comment")
        if comment:
            try:
                client.create_comment(repo=repo, issue_id=issue_num, data={"body": comment})
            except ApiError as e:
                raise IntegrationError(self.message_from_error(e))

    def get_persisted_default_config_fields(self) -> Sequence[str]:
        return ["repo"]

    def create_default_repo_choice(self, default_repo: str) -> tuple[str, str]:
        return default_repo, default_repo.split("/")[1]

    @all_silo_function
    def get_create_issue_config(
        self, group: Group | None, user: User | RpcUser, **kwargs: Any
    ) -> list[dict[str, Any]]:
        """
        We use the `group` to get three things: organization_slug, project
        defaults, and default title and description. In the case where we're
        getting `createIssueConfig` from GitHub for Ticket Rules, we don't know
        the issue group beforehand.

        :param group: (Optional) Group model.
        :param user: User model.
        :param kwargs: (Optional) Object
            * params: (Optional) Object
        :return:
        """
        kwargs["link_referrer"] = "github_integration"

        if group:
            fields = self._get_create_issue_fields(group, user, **kwargs)
            org = group.organization
        else:
            fields = []
            org_context = organization_service.get_organization_by_id(
                id=self.organization_id, include_projects=False, include_teams=False
            )
            assert org_context is not None
            org = org_context.organization

        params = kwargs.pop("params", {})
        default_repo, repo_choices = self.get_repository_choices(group, params, PAGE_NUMBER_LIMIT)

        assignees = self.get_allowed_assignees(default_repo) if default_repo else []
        labels: Sequence[tuple[str, str]] = []
        if default_repo:
            owner, repo = default_repo.split("/")
            labels = self.get_repo_labels(owner, repo)

        autocomplete_url = reverse(
            "sentry-integration-github-search", args=[org.slug, self.model.id]
        )

        return [
            {
                "name": "repo",
                "label": "GitHub Repository",
                "type": "select",
                "default": default_repo,
                "choices": repo_choices,
                "url": autocomplete_url,
                "updatesForm": True,
                "required": True,
            },
            *fields,
            {
                "name": "assignee",
                "label": "Assignee",
                "default": "",
                "type": "select",
                "required": False,
                "choices": assignees,
            },
            {
                "name": "labels",
                "label": "Labels",
                "default": [],
                "type": "select",
                "multiple": True,
                "required": False,
                "choices": labels,
            },
        ]

    def create_issue(self, data: Mapping[str, Any], **kwargs: Any) -> Mapping[str, Any]:
        client = self.get_client()
        repo = data.get("repo")
        if not repo:
            raise IntegrationFormError({"repo": "Repository is required"})

        # Check the repository belongs to the integration
        if not Repository.objects.filter(
            name=repo,
            integration_id=self.model.id,
            organization_id=self.organization_id,
            status=ObjectStatus.ACTIVE,
        ).exists():
            raise IntegrationFormError(
                {"repo": f"Given repository, {repo} does not belong to this installation"}
            )

        # Create clean issue data with required fields
        if not data.get("title"):
            raise IntegrationFormError({"title": "Title is required"})

        if not data.get("description"):
            raise IntegrationFormError({"description": "Description is required"})

        issue_data = {
            "title": data["title"],
            "body": data["description"],
        }

        # Only include optional fields if they have valid values
        if data.get("assignee"):
            issue_data["assignee"] = data["assignee"]
        if data.get("labels"):
            issue_data["labels"] = data["labels"]

        try:
            issue = client.create_issue(repo=repo, data=issue_data)
        except ApiError as e:
            self.raise_error(e)

        return {
            "key": issue["number"],
            "title": issue["title"],
            "description": issue["body"],
            "url": issue["html_url"],
            "repo": repo,
        }

    def get_link_issue_config(self, group: Group, **kwargs: Any) -> list[dict[str, Any]]:
        params = kwargs.pop("params", {})
        default_repo, repo_choices = self.get_repository_choices(group, params)

        org = group.organization
        autocomplete_url = reverse(
            "sentry-integration-github-search", args=[org.slug, self.model.id]
        )

        def get_linked_issue_comment_prefix(group: Group) -> str:
            if group.issue_category == GroupCategory.FEEDBACK:
                return "Sentry Feedback"
            else:
                return "Sentry Issue"

        def get_default_comment(group: Group) -> str:
            prefix = get_linked_issue_comment_prefix(group)
            url = group.get_absolute_url(params={"referrer": "github_integration"})
            issue_short_id = group.qualified_short_id

            return f"{prefix}: [{issue_short_id}]({absolute_uri(url)})"

        return [
            {
                "name": "repo",
                "label": "GitHub Repository",
                "type": "select",
                "default": default_repo,
                "choices": repo_choices,
                "url": autocomplete_url,
                "required": True,
                "updatesForm": True,
            },
            {
                "name": "externalIssue",
                "label": "Issue Number or Title",
                "default": "",
                "choices": [],
                "type": "select",
                "url": autocomplete_url,
                "required": True,
            },
            {
                "name": "comment",
                "label": "Comment",
                "default": get_default_comment(group),
                "type": "textarea",
                "required": False,
                "autosize": True,
                "help": "Leave blank if you don't want to add a comment to the GitHub issue.",
            },
        ]

    def get_issue(self, issue_id: str, **kwargs: Any) -> Mapping[str, Any]:
        data = kwargs["data"]
        repo = data.get("repo")
        issue_num = data.get("externalIssue")
        client = self.get_client()

        if not repo:
            raise IntegrationFormError({"repo": "Repository is required"})

        if not Repository.objects.filter(
            name=repo,
            integration_id=self.model.id,
            organization_id=self.organization_id,
            status=ObjectStatus.ACTIVE,
        ).exists():
            raise IntegrationFormError(
                {"repo": f"Given repository, {repo} does not belong to this installation"}
            )

        if not issue_num:
            raise IntegrationFormError({"externalIssue": "Issue number is required"})

        try:
            issue = client.get_issue(repo, issue_num)
        except ApiError as e:
            raise IntegrationError(self.message_from_error(e))

        return {
            "key": issue["number"],
            "title": issue["title"],
            "description": issue["body"],
            "url": issue["html_url"],
            "repo": repo,
        }

    def get_allowed_assignees(self, repo: str) -> Sequence[tuple[str, str]]:
        client = self.get_client()
        try:
            response = client.get_assignees(repo)
        except Exception as e:
            self.raise_error(e)

        users = tuple((u["login"], u["login"]) for u in response)

        return (("", "Unassigned"),) + users

    def get_repo_labels(self, owner: str, repo: str) -> Sequence[tuple[str, str]]:
        client = self.get_client()
        try:
            response = client.get_labels(owner, repo)
        except Exception as e:
            self.raise_error(e)

        def natural_sort_pair(pair: tuple[str, str]) -> list[str | int]:
            return [
                int(text) if text.isdecimal() else text.lower()
                for text in re.split("([0-9]+)", pair[0])
            ]

        # sort alphabetically
        labels = tuple(
            sorted([(label["name"], label["name"]) for label in response], key=natural_sort_pair)
        )

        return labels
