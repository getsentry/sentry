from __future__ import annotations

import logging
import time
from dataclasses import dataclass
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

from django.db.models import Count
from django.utils.http import urlencode
from django.utils.safestring import mark_safe

from sentry import integrations
from sentry.api.serializers.models.event import get_entries, get_problems
from sentry.incidents.models import AlertRuleTriggerAction
from sentry.integrations import IntegrationFeatures, IntegrationProvider
from sentry.models import (
    Activity,
    Commit,
    Deploy,
    Environment,
    EventError,
    Group,
    GroupHash,
    GroupLink,
    Integration,
    Organization,
    Project,
    Release,
    ReleaseCommit,
    Repository,
    Rule,
    User,
)
from sentry.notifications.notify import notify
from sentry.notifications.utils.participants import split_participants_and_context
from sentry.utils.committers import get_serialized_event_file_committers
from sentry.utils.http import absolute_uri
from sentry.utils.performance_issues.performance_detection import (
    EventPerformanceProblem,
    PerformanceProblem,
)
from sentry.web.helpers import render_to_string

if TYPE_CHECKING:
    from sentry.eventstore.models import Event
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
    users_by_email: Mapping[str, User],
    organization: Organization,
) -> Iterable[Mapping[str, str | Iterable[tuple[Commit, User | None]]]]:
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
                    **dict([] if environment is None else [("environment", environment)]),
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
) -> str:
    alert_rule_id: int | None = rule_details[0].id if rule_details and rule_details[0].id else None
    return str(
        group.get_absolute_url()
        + (
            ""
            if not alert_rule_id
            else get_email_link_extra_params(referrer, environment, rule_details, alert_timestamp)[
                alert_rule_id
            ]
        )
    )


def get_integration_link(organization: Organization, integration_slug: str) -> str:
    # Explicitly typing to satisfy mypy.
    integration_link: str = absolute_uri(
        f"/settings/{organization.slug}/integrations/{integration_slug}/?referrer=alert_email"
    )
    return integration_link


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
                    commit_data["subject"] = commit_data["message"].split("\n", 1)[0]
                    commits[commit["id"]] = commit_data

    return sorted(commits.values(), key=lambda x: float(x["score"]), reverse=True)


def has_integrations(organization: Organization, project: Project) -> bool:
    from sentry.plugins.base import plugins

    project_plugins = plugins.for_project(project, version=1)
    organization_integrations = Integration.objects.filter(organizations=organization).first()
    # TODO: fix because project_plugins is an iterator and thus always truthy
    return bool(project_plugins or organization_integrations)


def is_alert_rule_integration(provider: IntegrationProvider) -> bool:
    return any(feature == IntegrationFeatures.ALERT_RULE for feature in provider.features)


def has_alert_integration(project: Project) -> bool:
    org = project.organization

    # check integrations
    providers = filter(is_alert_rule_integration, list(integrations.all()))
    provider_keys = map(lambda x: cast(str, x.key), providers)
    if Integration.objects.filter(organizations=org, provider__in=provider_keys).exists():
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


def get_span_evidence_value_problem(problem: PerformanceProblem) -> str:
    """Get the 'span evidence' data for a performance problem. This is displayed in issue alert emails."""
    value = "no value"
    if not problem:
        return value
    if not problem.op and problem.desc:
        value = problem.desc
    if problem.op and not problem.desc:
        value = problem.op
    if problem.op and problem.desc:
        value = f"{problem.op} - {problem.desc}"
    return value


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


def perf_to_email_html(
    spans: Union[List[Dict[str, Union[str, float]]], None], problem: PerformanceProblem = None
) -> Any:
    """Generate the email HTML for a performance issue alert"""
    if not problem:
        return ""

    parent_span, repeating_spans = get_parent_and_repeating_spans(spans, problem)

    context = {
        "transaction_name": get_span_evidence_value_problem(problem),
        "parent_span": get_span_evidence_value(parent_span),
        "repeating_spans": get_span_evidence_value(repeating_spans),
        "num_repeating_spans": str(len(problem.offender_span_ids))
        if problem.offender_span_ids
        else "",
    }
    return render_to_string("sentry/emails/transactions.html", context)


def get_matched_problem(event: Event) -> Optional[EventPerformanceProblem]:
    """Get the matching performance problem for a given event"""
    problems = get_problems([event])
    if not problems:
        return None

    for problem in problems:
        if problem.problem.fingerprint == GroupHash.objects.get(group=event.group).hash:
            return problem.problem
    return None


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


def get_span_and_problem(
    event: Event,
) -> tuple[Optional[List[Dict[str, Union[str, float]]]], Optional[EventPerformanceProblem]]:
    """Get a given event's spans and performance problem"""
    entries = get_entries(event, None)
    spans = get_spans(entries[0]) if len(entries) else None
    matched_problem = get_matched_problem(event)
    return (spans, matched_problem)


def get_transaction_data(event: Event) -> Any:
    """Get data about a transaction to populate alert emails."""
    spans, matched_problem = get_span_and_problem(event)
    return perf_to_email_html(spans, matched_problem)


def get_performance_issue_alert_subtitle(event: Event) -> str:
    """Generate the issue alert subtitle for performance issues"""
    spans, matched_problem = get_span_and_problem(event)
    repeating_span_value = ""
    if spans and matched_problem:
        _, repeating_spans = get_parent_and_repeating_spans(spans, matched_problem)
        repeating_span_value = get_span_evidence_value(repeating_spans, include_op=False)
    return repeating_span_value.replace("`", '"')


def send_activity_notification(notification: ActivityNotification | UserReportNotification) -> None:
    participants_by_provider = notification.get_participants_with_group_subscription_reason()
    if not participants_by_provider:
        return

    # Only calculate shared context once.
    shared_context = notification.get_context()

    for provider, participants_with_reasons in participants_by_provider.items():
        participants_, extra_context = split_participants_and_context(participants_with_reasons)
        notify(provider, notification, participants_, shared_context, extra_context)
