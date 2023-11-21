from __future__ import annotations

import logging
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import timedelta
from typing import (
    TYPE_CHECKING,
    Any,
    Dict,
    Iterable,
    List,
    Mapping,
    MutableMapping,
    Optional,
    Sequence,
    Union,
    cast,
)
from urllib.parse import parse_qs, urlparse

from django.db.models import Count
from django.utils.http import urlencode
from django.utils.safestring import mark_safe
from django.utils.translation import gettext_lazy as _

from sentry import integrations
from sentry.eventstore.models import Event, GroupEvent
from sentry.incidents.models import AlertRuleTriggerAction
from sentry.integrations import IntegrationFeatures, IntegrationProvider
from sentry.issues.grouptype import (
    PerformanceConsecutiveDBQueriesGroupType,
    PerformanceNPlusOneAPICallsGroupType,
    PerformanceRenderBlockingAssetSpanGroupType,
)
from sentry.models.activity import Activity
from sentry.models.commit import Commit
from sentry.models.deploy import Deploy
from sentry.models.environment import Environment
from sentry.models.eventerror import EventError
from sentry.models.group import Group
from sentry.models.grouplink import GroupLink
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.releasecommit import ReleaseCommit
from sentry.models.repository import Repository
from sentry.models.rule import Rule
from sentry.services.hybrid_cloud.integration import integration_service
from sentry.services.hybrid_cloud.user import RpcUser
from sentry.services.hybrid_cloud.util import region_silo_function
from sentry.utils.committers import get_serialized_event_file_committers
from sentry.utils.performance_issues.base import get_url_from_span
from sentry.utils.performance_issues.performance_problem import PerformanceProblem
from sentry.web.helpers import render_to_string

if TYPE_CHECKING:
    from sentry.notifications.notifications.activity.base import ActivityNotification
    from sentry.notifications.notifications.user_report import UserReportNotification


logger = logging.getLogger(__name__)


def get_deploy(activity: Activity) -> Deploy | None:
    try:
        return Deploy.objects.get(id=activity.data["deploy_id"])
    except Deploy.DoesNotExist:
        return None


def get_release(activity: Activity, organization: Organization) -> Release | None:
    try:
        return Release.objects.get(
            organization_id=organization.id, version=activity.data["version"]
        )
    except Release.DoesNotExist:
        return None


def get_group_counts_by_project(
    release: Release, projects: Iterable[Project]
) -> Mapping[Project, int]:
    return dict(
        Group.objects.filter(
            project__in=projects,
            id__in=GroupLink.objects.filter(
                project__in=projects,
                linked_type=GroupLink.LinkedType.commit,
                linked_id__in=ReleaseCommit.objects.filter(release=release).values_list(
                    "commit_id", flat=True
                ),
            ).values_list("group_id", flat=True),
        )
        .values_list("project")
        .annotate(num_groups=Count("id"))
    )


def get_repos(
    commits: Iterable[Commit],
    users_by_email: Mapping[str, RpcUser],
    organization: Organization,
) -> Iterable[Mapping[str, str | Iterable[tuple[Commit, RpcUser | None]]]]:
    repositories_by_id = {
        repository_id: {"name": repository_name, "commits": []}
        for repository_id, repository_name in Repository.objects.filter(
            organization_id=organization.id,
            id__in={c.repository_id for c in commits},
        ).values_list("id", "name")
    }
    # These commits are in order so they should end up in the list of commits still in order.
    for commit in commits:
        # Get the user object if it exists
        user_option = users_by_email.get(commit.author.email) if commit.author_id else None
        repositories_by_id[commit.repository_id]["commits"].append((commit, user_option))

    return list(repositories_by_id.values())


def get_environment_for_deploy(deploy: Deploy | None) -> str:
    if deploy:
        environment = Environment.objects.get(id=deploy.environment_id)
        if environment and environment.name:
            return str(environment.name)
    return "Default Environment"


def summarize_issues(
    issues: Iterable[Mapping[str, Mapping[str, Any]]]
) -> Iterable[Mapping[str, str]]:
    rv = []
    for issue in issues:
        extra_info = None
        msg_d = dict(issue["data"])
        msg_d["type"] = issue["type"]

        if "image_path" in issue["data"]:
            extra_info = issue["data"]["image_path"].rsplit("/", 1)[-1]
            if "image_arch" in issue["data"]:
                extra_info = "{} ({})".format(extra_info, issue["data"]["image_arch"])

        rv.append({"message": EventError(msg_d).message, "extra_info": extra_info})
    return rv


def get_email_link_extra_params(
    referrer: str = "alert_email",
    environment: str | None = None,
    rule_details: Sequence[NotificationRuleDetails] | None = None,
    alert_timestamp: int | None = None,
    notification_uuid: str | None = None,
    **kwargs: Any,
) -> dict[int, str]:
    alert_timestamp_str = (
        str(round(time.time() * 1000)) if not alert_timestamp else str(alert_timestamp)
    )
    return {
        rule_detail.id: "?"
        + str(
            urlencode(
                {
                    "referrer": referrer,
                    "alert_type": str(AlertRuleTriggerAction.Type.EMAIL.name).lower(),
                    "alert_timestamp": alert_timestamp_str,
                    "alert_rule_id": rule_detail.id,
                    **dict(
                        []
                        if notification_uuid is None
                        else [("notification_uuid", str(notification_uuid))]
                    ),
                    **dict([] if environment is None else [("environment", environment)]),
                    **kwargs,
                }
            )
        )
        for rule_detail in (rule_details or [])
    }


def get_group_settings_link(
    group: Group,
    environment: str | None,
    rule_details: Sequence[NotificationRuleDetails] | None = None,
    alert_timestamp: int | None = None,
    referrer: str = "alert_email",
    notification_uuid: str | None = None,
    **kwargs: Any,
) -> str:
    alert_rule_id = rule_details[0].id if rule_details and rule_details[0].id else None
    extra_params = ""
    if alert_rule_id:
        extra_params = get_email_link_extra_params(
            referrer,
            environment,
            rule_details,
            alert_timestamp,
            notification_uuid=notification_uuid,
            **kwargs,
        )[alert_rule_id]
    elif not alert_rule_id and notification_uuid:
        extra_params = "?" + str(urlencode({"notification_uuid": notification_uuid}))
    return str(group.get_absolute_url() + extra_params)


def get_integration_link(
    organization: Organization, integration_slug: str, notification_uuid: Optional[str] = None
) -> str:
    query_params = {"referrer": "alert_email"}
    if notification_uuid:
        query_params.update({"notification_uuid": notification_uuid})

    return organization.absolute_url(
        f"/settings/{organization.slug}/integrations/{integration_slug}/",
        query=urlencode(query_params),
    )


def get_issue_replay_link(group: Group, sentry_query_params: str = ""):
    return str(group.get_absolute_url() + "replays/" + sentry_query_params)


@dataclass
class NotificationRuleDetails:
    id: int
    label: str
    url: str
    status_url: str


def get_rules(
    rules: Sequence[Rule], organization: Organization, project: Project
) -> Sequence[NotificationRuleDetails]:
    return [
        NotificationRuleDetails(
            rule.id,
            rule.label,
            f"/organizations/{organization.slug}/alerts/rules/{project.slug}/{rule.id}/",
            f"/organizations/{organization.slug}/alerts/rules/{project.slug}/{rule.id}/details/",
        )
        for rule in rules
    ]


def get_commits(project: Project, event: Event) -> Sequence[Mapping[str, Any]]:
    # lets identify possibly suspect commits and owners
    commits: MutableMapping[int, Mapping[str, Any]] = {}
    try:
        committers = get_serialized_event_file_committers(project, event)
    except (Commit.DoesNotExist, Release.DoesNotExist):
        pass
    except Exception as exc:
        logging.exception(str(exc))
    else:
        for committer in committers:
            for commit in committer["commits"]:
                if commit["id"] not in commits:
                    commit_data = dict(commit)
                    commit_data["shortId"] = commit_data["id"][:7]
                    commit_data["author"] = committer["author"]
                    commit_data["subject"] = (
                        commit_data["message"].split("\n", 1)[0] if commit_data["message"] else ""
                    )
                    commits[commit["id"]] = commit_data

    # TODO(nisanthan): Once Commit Context is GA, no need to sort by "score"
    # commits from Commit Context dont have a "score" key
    return sorted(commits.values(), key=lambda x: float(x.get("score", 0)), reverse=True)


@region_silo_function
def has_integrations(organization: Organization, project: Project) -> bool:
    from sentry.plugins.base import plugins

    project_plugins = plugins.for_project(project, version=1)
    organization_integrations = integration_service.get_integrations(
        organization_id=organization.id, limit=1
    )
    # TODO: fix because project_plugins is an iterator and thus always truthy
    return bool(project_plugins or organization_integrations)


def is_alert_rule_integration(provider: IntegrationProvider) -> bool:
    return any(
        feature == (IntegrationFeatures.ALERT_RULE or IntegrationFeatures.ENTERPRISE_ALERT_RULE)
        for feature in provider.features
    )


def has_alert_integration(project: Project) -> bool:
    org = project.organization

    # check integrations
    provider_keys = [
        provider.key for provider in integrations.all() if is_alert_rule_integration(provider)
    ]
    if integration_service.get_integrations(organization_id=org.id, providers=provider_keys):
        return True

    # check plugins
    from sentry.plugins.base import plugins

    project_plugins = plugins.for_project(project, version=None)
    return any(plugin.get_plugin_type() == "notification" for plugin in project_plugins)


def get_interface_list(event: Event) -> Sequence[tuple[str, str, str]]:
    interface_list = []
    for interface in event.interfaces.values():
        body = interface.to_email_html(event)
        if not body:
            continue
        text_body = interface.to_string(event)
        interface_list.append((interface.get_title(), mark_safe(body), text_body))
    return interface_list


def get_span_evidence_value(
    span: Union[Dict[str, Union[str, float]], None] = None, include_op: bool = True
) -> str:
    """Get the 'span evidence' data for a given span. This is displayed in issue alert emails."""
    value = "no value"
    if not span:
        return value
    if not span.get("op") and span.get("description"):
        value = cast(str, span["description"])
    if span.get("op") and not span.get("description"):
        value = cast(str, span["op"])
    if span.get("op") and span.get("description"):
        op = cast(str, span["op"])
        desc = cast(str, span["description"])
        value = f"{op} - {desc}"
        if not include_op:
            value = desc
    return value


def get_parent_and_repeating_spans(
    spans: Union[List[Dict[str, Union[str, float]]], None], problem: PerformanceProblem
) -> tuple[Union[Dict[str, Union[str, float]], None], Union[Dict[str, Union[str, float]], None]]:
    """Parse out the parent and repeating spans given an event's spans"""
    if not spans:
        return (None, None)

    parent_span = None
    repeating_spans = None

    for span in spans:
        if problem.parent_span_ids:
            if problem.parent_span_ids[0] == span.get("span_id"):
                parent_span = span
        if problem.offender_span_ids:
            if problem.offender_span_ids[0] == span.get("span_id"):
                repeating_spans = span
        if parent_span is not None and repeating_spans is not None:
            break

    return (parent_span, repeating_spans)


def occurrence_perf_to_email_html(context: Any) -> str:
    """Generate the email HTML for an occurrence-backed performance issue alert"""
    return render_to_string("sentry/emails/transactions.html", context)


def get_spans(
    entries: List[Dict[str, Union[List[Dict[str, Union[str, float]]], str]]]
) -> Optional[List[Dict[str, Union[str, float]]]]:
    """Get the given event's spans"""
    if not len(entries):
        return None

    spans: Optional[List[Dict[str, Union[str, float]]]] = None
    for entry in entries:
        if entry.get("type") == "spans":
            spans = cast(Optional[List[Dict[str, Union[str, float]]]], entry.get("data"))
            break

    return spans


def get_transaction_data(event: GroupEvent) -> str:
    """Get data about a transaction to populate alert emails."""
    if event.occurrence is None or not event.occurrence.evidence_data:
        return ""
    return occurrence_perf_to_email_html(event.occurrence.evidence_data)


def get_generic_data(event: GroupEvent) -> Any:
    """Get data about a generic issue type to populate alert emails."""
    if event.occurrence is None or not event.occurrence.evidence_display:
        return ""

    context = {row.name: row.value for row in event.occurrence.evidence_display}
    return generic_email_html(context)


def generic_email_html(context: Any) -> str:
    """Format issue evidence into a (stringified) HTML table for emails"""
    return render_to_string("sentry/emails/generic_table.html", {"data": context})


def get_performance_issue_alert_subtitle(event: GroupEvent) -> str:
    """Generate the issue alert subtitle for performance issues"""
    if event.occurrence is None:
        return ""
    return event.occurrence.evidence_data.get("repeating_spans_compact", "").replace("`", '"')


def get_notification_group_title(
    group: Group, event: Event | GroupEvent, max_length: int = 255, **kwargs: str
) -> str:
    if isinstance(event, GroupEvent) and event.occurrence is not None:
        issue_title = event.occurrence.issue_title
        return issue_title
    else:
        event_title = event.title
        return event_title


def send_activity_notification(notification: ActivityNotification | UserReportNotification) -> None:
    from sentry.notifications.notify import notify

    participants_by_provider = notification.get_participants_with_group_subscription_reason()
    if participants_by_provider.is_empty():
        return

    # Only calculate shared context once.
    shared_context = notification.get_context()

    split = participants_by_provider.split_participants_and_context()
    for provider, participants, extra_context in split:
        notify(provider, notification, participants, shared_context, extra_context)


def get_replay_id(event: Event | GroupEvent) -> str | None:
    replay_id = event.data.get("contexts", {}).get("replay", {}).get("replay_id", {})
    if (
        isinstance(event, GroupEvent)
        and event.occurrence is not None
        and event.occurrence.evidence_data
    ):
        evidence_replay_id = (
            event.occurrence.evidence_data.get("contexts", {}).get("replay", {}).get("replay_id")
        )

        if evidence_replay_id:
            return evidence_replay_id

    return replay_id


@dataclass
class PerformanceProblemContext:
    problem: PerformanceProblem
    spans: Union[List[Dict[str, Union[str, float]]], None]
    event: Event | None

    def __post_init__(self) -> None:
        parent_span, repeating_spans = get_parent_and_repeating_spans(self.spans, self.problem)

        self.parent_span = parent_span
        self.repeating_spans = repeating_spans

    def to_dict(self) -> Dict[str, str | float | List[str]]:
        return {
            "transaction_name": self.transaction,
            "parent_span": get_span_evidence_value(self.parent_span),
            "repeating_spans": get_span_evidence_value(self.repeating_spans),
            "num_repeating_spans": str(len(self.problem.offender_span_ids))
            if self.problem.offender_span_ids
            else "",
        }

    @property
    def transaction(self) -> str:
        if self.event and self.event.transaction:
            return str(self.event.transaction)
        return ""

    @property
    def transaction_duration(self) -> float:
        if not self.event:
            return 0

        return self.duration(self.event.data)

    def duration(self, item: Mapping[str, Any] | None) -> float:
        if not item:
            return 0

        start = float(item.get("start_timestamp", 0) or 0)
        end = float(item.get("timestamp", 0) or 0)

        return (end - start) * 1000

    def _find_span_by_id(self, id: str) -> Dict[str, Any] | None:
        if not self.spans:
            return None

        for span in self.spans:
            span_id = span.get("span_id", "") or ""
            if span_id == id:
                return span
        return None

    def get_span_duration(self, span: Dict[str, Any] | None) -> timedelta:
        if span:
            return timedelta(seconds=span.get("timestamp", 0) - span.get("start_timestamp", 0))
        return timedelta(0)

    def _sum_span_duration(self, spans: list[Dict[str, Any] | None]) -> float:
        "Given non-overlapping spans, find the sum of the span durations in milliseconds"
        sum = 0.0
        for span in spans:
            if span:
                sum += self.get_span_duration(span).total_seconds() * 1000
        return sum

    @classmethod
    def from_problem_and_spans(
        cls,
        problem: PerformanceProblem,
        spans: Union[List[Dict[str, Union[str, float]]], None],
        event: Event | None = None,
    ) -> PerformanceProblemContext:
        if problem.type == PerformanceNPlusOneAPICallsGroupType:
            return NPlusOneAPICallProblemContext(problem, spans, event)
        if problem.type == PerformanceConsecutiveDBQueriesGroupType:
            return ConsecutiveDBQueriesProblemContext(problem, spans, event)
        if problem.type == PerformanceRenderBlockingAssetSpanGroupType:
            return RenderBlockingAssetProblemContext(problem, spans, event)
        else:
            return cls(problem, spans, event)


class NPlusOneAPICallProblemContext(PerformanceProblemContext):
    def to_dict(self) -> Dict[str, str | float | List[str]]:
        return {
            "transaction_name": self.transaction,
            "repeating_spans": self.path_prefix,
            "parameters": self.parameters,
            "num_repeating_spans": str(len(self.problem.offender_span_ids))
            if self.problem.offender_span_ids
            else "",
        }

    @property
    def path_prefix(self) -> str:
        if not self.repeating_spans or len(self.repeating_spans) == 0:
            return ""

        url = get_url_from_span(self.repeating_spans)
        parsed_url = urlparse(url)
        return parsed_url.path or ""

    @property
    def parameters(self) -> List[str]:
        if not self.spans or len(self.spans) == 0:
            return []

        urls = [
            get_url_from_span(span)
            for span in self.spans
            if span.get("span_id") in self.problem.offender_span_ids
        ]

        all_parameters: Mapping[str, List[str]] = defaultdict(list)

        for url in urls:
            parsed_url = urlparse(url)
            parameters = parse_qs(parsed_url.query)

            for key, value in parameters.items():
                all_parameters[key] += value

        return [
            "{{{}: {}}}".format(key, ",".join(values)) for key, values in all_parameters.items()
        ]


class ConsecutiveDBQueriesProblemContext(PerformanceProblemContext):
    def to_dict(self) -> Dict[str, Any]:
        return {
            "span_evidence_key_value": [
                {"key": _("Transaction"), "value": self.transaction},
                {"key": _("Starting Span"), "value": self.starting_span},
                {
                    "key": _("Parallelizable Spans"),
                    "value": self.parallelizable_spans,
                    "is_multi_value": True,
                },
            ],
            "transaction_duration": self.transaction_duration,
            "slow_span_duration": self.time_saved,
        }

    @property
    def starting_span(self) -> str:
        if not self.problem.cause_span_ids or len(self.problem.cause_span_ids) < 1:
            return ""

        starting_span_id = self.problem.cause_span_ids[0]

        return self._find_span_desc_by_id(starting_span_id)

    @property
    def parallelizable_spans(self) -> List[str]:
        if not self.problem.offender_span_ids or len(self.problem.offender_span_ids) < 1:
            return [""]

        offender_span_ids = self.problem.offender_span_ids

        return [self._find_span_desc_by_id(id) for id in offender_span_ids]

    def _find_span_desc_by_id(self, id: str) -> str:
        return get_span_evidence_value(self._find_span_by_id(id))

    @property
    def time_saved(self) -> float:
        """
        Calculates the cost saved by running spans in parallel,
        this is the maximum time saved of running all independent queries in parallel
        note, maximum means it does not account for db connection times and overhead associated with parallelization,
        this is where thresholds come in
        """
        independent_spans = [self._find_span_by_id(id) for id in self.problem.offender_span_ids]
        consecutive_spans = [self._find_span_by_id(id) for id in self.problem.cause_span_ids or ()]
        total_duration = self._sum_span_duration(consecutive_spans)

        max_independent_span_duration = max(
            [self.get_span_duration(span).total_seconds() * 1000 for span in independent_spans]
        )

        sum_of_dependent_span_durations = 0.0
        for span in consecutive_spans:
            if span not in independent_spans:
                sum_of_dependent_span_durations += (
                    self.get_span_duration(span).total_seconds() * 1000
                )

        return total_duration - max(max_independent_span_duration, sum_of_dependent_span_durations)


class RenderBlockingAssetProblemContext(PerformanceProblemContext):
    def to_dict(self) -> Dict[str, str | float | List[str]]:
        return {
            "transaction_name": self.transaction,
            "slow_span_description": self.slow_span_description,
            "slow_span_duration": self.slow_span_duration,
            "transaction_duration": self.transaction_duration,
            "fcp": self.fcp,
        }

    @property
    def slow_span(self) -> Dict[str, Union[str, float]] | None:
        if not self.spans:
            return None

        offending_spans = [
            span for span in self.spans if span.get("span_id") in self.problem.offender_span_ids
        ]

        if len(offending_spans) == 0:
            return None

        return offending_spans[0]

    @property
    def slow_span_description(self) -> str:
        slow_span = self.slow_span
        if not slow_span:
            return ""

        return str(slow_span.get("description", ""))

    @property
    def slow_span_duration(self) -> float:
        return self.duration(self.slow_span)

    @property
    def fcp(self) -> float:
        if not self.event:
            return 0

        return float(self.event.data.get("measurements", {}).get("fcp", {}).get("value", 0) or 0)
