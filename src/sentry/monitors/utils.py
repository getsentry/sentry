from collections import defaultdict
from datetime import datetime, timedelta

from django.db import router, transaction
from django.utils import timezone
from rest_framework.request import Request

from sentry import audit_log
from sentry.api.serializers.rest_framework.rule import RuleSerializer
from sentry.db.models import BoundedPositiveIntegerField
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.rule import Rule, RuleActivity, RuleActivityType, RuleSource
from sentry.monitors.constants import DEFAULT_CHECKIN_MARGIN, MAX_TIMEOUT, TIMEOUT
from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn
from sentry.projects.project_rules.creator import ProjectRuleCreator
from sentry.projects.project_rules.updater import ProjectRuleUpdater
from sentry.signals import (
    cron_monitor_created,
    first_cron_checkin_received,
    first_cron_monitor_created,
)
from sentry.users.models.user import User
from sentry.utils.audit import create_audit_entry, create_system_audit_entry
from sentry.utils.auth import AuthenticatedHttpRequest


def signal_first_checkin(project: Project, monitor: Monitor):
    if not project.flags.has_cron_checkins:
        # Backfill users that already have cron monitors
        check_and_signal_first_monitor_created(project, None, False)
        transaction.on_commit(
            lambda: first_cron_checkin_received.send_robust(
                project=project, monitor_id=str(monitor.guid), sender=Project
            ),
            router.db_for_write(Project),
        )


def check_and_signal_first_monitor_created(project: Project, user, from_upsert: bool):
    if not project.flags.has_cron_monitors:
        first_cron_monitor_created.send_robust(
            project=project, user=user, from_upsert=from_upsert, sender=Project
        )


def signal_monitor_created(project: Project, user, from_upsert: bool, monitor: Monitor, request):
    cron_monitor_created.send_robust(
        project=project, user=user, from_upsert=from_upsert, sender=Project
    )
    check_and_signal_first_monitor_created(project, user, from_upsert)

    if from_upsert:
        create_system_audit_entry(
            organization_id=project.organization_id,
            target_object=monitor.id,
            event=audit_log.get_event_id("UPSERT_MONITOR_ADD"),
            data=monitor.get_audit_log_data(),
        )
    else:
        create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=monitor.id,
            event=audit_log.get_event_id("MONITOR_ADD"),
            data=monitor.get_audit_log_data(),
        )


def get_max_runtime(max_runtime: int | None) -> timedelta:
    """
    Computes a timedelta given a max_runtime. Limits the returned timedelta
    to MAX_TIMEOUT. If an empty max_runtime is provided the default TIMEOUT
    will be used.
    """
    return timedelta(minutes=min((max_runtime or TIMEOUT), MAX_TIMEOUT))


# Generates a timeout_at value for new check-ins
def get_timeout_at(
    monitor_config: dict, status: CheckInStatus, date_added: datetime | None
) -> datetime | None:
    if status == CheckInStatus.IN_PROGRESS and date_added is not None:
        return date_added.replace(second=0, microsecond=0) + get_max_runtime(
            (monitor_config or {}).get("max_runtime")
        )

    return None


# Generates a timeout_at value for existing check-ins that are being updated
def get_new_timeout_at(
    checkin: MonitorCheckIn, new_status: CheckInStatus, date_updated: datetime
) -> datetime | None:
    return get_timeout_at(checkin.monitor.get_validated_config(), new_status, date_updated)


# Used to check valid implicit durations for closing check-ins without a duration specified
# as payload is already validated. Max value is > 24 days.
def valid_duration(duration: int | None) -> bool:
    if duration and (duration < 0 or duration > BoundedPositiveIntegerField.MAX_VALUE):
        return False

    return True


def get_checkin_margin(checkin_margin: int | None) -> timedelta:
    """
    Computes a timedelta given the checkin_margin (missed margin).
    If an empty value is provided the DEFAULT_CHECKIN_MARGIN will be used.
    """
    # TODO(epurkhiser): We should probably just set this value as a
    # `default` in the validator for the config instead of having the magic
    # default number here
    return timedelta(minutes=int(checkin_margin or DEFAULT_CHECKIN_MARGIN))


def fetch_associated_groups(
    trace_ids: list[str], organization_id: int, project_id: int, start: datetime, end
) -> dict[str, list[dict[str, int | str]]]:
    """
    Returns serializer appropriate group_ids corresponding with check-in trace ids
    :param trace_ids: list of trace_ids from the given check-ins
    :param organization_id: organization id
    :param project_id: project id
    :param start: timestamp of the beginning of the specified date range
    :param end: timestamp of the end of the specified date range
    :return:
    """
    from snuba_sdk import (
        Column,
        Condition,
        Direction,
        Entity,
        Limit,
        Offset,
        Op,
        OrderBy,
        Query,
        Request,
    )

    from sentry.eventstore.base import EventStorage
    from sentry.eventstore.snuba.backend import DEFAULT_LIMIT, DEFAULT_OFFSET
    from sentry.snuba.dataset import Dataset
    from sentry.snuba.events import Columns
    from sentry.utils.snuba import DATASETS, raw_snql_query

    dataset = Dataset.Events

    # add 30 minutes on each end to ensure we get all associated events
    query_start = start - timedelta(minutes=30)
    query_end = end + timedelta(minutes=30)

    cols = [col.value.event_name for col in EventStorage.minimal_columns[dataset]]
    cols.append(Columns.TRACE_ID.value.event_name)

    # query snuba for related errors and their associated issues
    snql_request = Request(
        dataset=dataset.value,
        app_id="eventstore",
        query=Query(
            match=Entity(dataset.value),
            select=[Column(col) for col in cols],
            where=[
                Condition(
                    Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]),
                    Op.GTE,
                    query_start,
                ),
                Condition(
                    Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]),
                    Op.LT,
                    query_end,
                ),
                Condition(
                    Column(DATASETS[dataset][Columns.TRACE_ID.value.alias]),
                    Op.IN,
                    trace_ids,
                ),
                Condition(
                    Column(DATASETS[dataset][Columns.PROJECT_ID.value.alias]),
                    Op.EQ,
                    project_id,
                ),
            ],
            orderby=[
                OrderBy(Column(DATASETS[dataset][Columns.TIMESTAMP.value.alias]), Direction.DESC),
            ],
            limit=Limit(DEFAULT_LIMIT),
            offset=Offset(DEFAULT_OFFSET),
        ),
        tenant_ids={
            "referrer": "api.serializer.checkins.trace-ids",
            "organization_id": organization_id,
        },
    )

    group_id_data: dict[int, set[str]] = defaultdict(set)
    trace_groups: dict[str, list[dict[str, int | str]]] = defaultdict(list)

    result = raw_snql_query(snql_request, "api.serializer.checkins.trace-ids", use_cache=False)
    # if query completes successfully, add an array of objects with group id and short id
    # otherwise, return an empty dict to return an empty array through the serializer
    if "error" not in result:
        for event in result["data"]:
            trace_id_event_name = Columns.TRACE_ID.value.event_name
            assert trace_id_event_name is not None

            # create dict with group_id and trace_id
            group_id_data[event["group_id"]].add(event[trace_id_event_name])

        group_ids = group_id_data.keys()
        for group in Group.objects.filter(project_id=project_id, id__in=group_ids):
            for trace_id in group_id_data[group.id]:
                trace_groups[trace_id].append({"id": group.id, "shortId": group.qualified_short_id})

    return trace_groups


def create_issue_alert_rule(
    request: AuthenticatedHttpRequest,
    project: Project,
    monitor: Monitor,
    validated_issue_alert_rule: dict,
) -> int | None:
    """
    Creates an Issue Alert `Rule` instance from a request with the given data
    :param request: Request object
    :param project: Project object
    :param monitor: Monitor object being created
    :param validated_issue_alert_rule: Dictionary of configurations for an associated Rule
    :return: dict
    """
    issue_alert_rule_data = create_issue_alert_rule_data(
        project, request.user, monitor, validated_issue_alert_rule
    )
    serializer = RuleSerializer(
        context={"project": project, "organization": project.organization},
        data=issue_alert_rule_data,
    )

    if not serializer.is_valid():
        return None

    data = serializer.validated_data
    # combine filters and conditions into one conditions criteria for the rule object
    conditions = data.get("conditions", [])
    if "filters" in data:
        conditions.extend(data["filters"])

    rule = ProjectRuleCreator(
        name=data["name"],
        project=project,
        action_match=data["actionMatch"],
        actions=data.get("actions", []),
        conditions=conditions,
        frequency=data.get("frequency"),
        environment=data.get("environment"),
        filter_match=data.get("filterMatch"),
        request=request,
    ).run()
    rule.update(source=RuleSource.CRON_MONITOR)
    RuleActivity.objects.create(
        rule=rule, user_id=request.user.id, type=RuleActivityType.CREATED.value
    )
    return rule.id


def create_issue_alert_rule_data(
    project: Project, user: User, monitor: Monitor, issue_alert_rule: dict
):
    """
    Gets a dict formatted alert rule to create alongside the monitor
    :param project: Project object
    :param user: User object that made the request
    :param monitor: Monitor object being created
    :param issue_alert_rule: Dictionary of configurations for an associated Rule
    :return: dict
    """
    issue_alert_rule_data = {
        "actionMatch": "any",
        "actions": [],
        "conditions": [
            {
                "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition",
            },
            {
                "id": "sentry.rules.conditions.regression_event.RegressionEventCondition",
            },
        ],
        "createdBy": {
            "email": user.email,
            "id": user.id,
            "name": user.email,
        },
        "dateCreated": timezone.now().strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "environment": issue_alert_rule.get("environment", None),
        "filterMatch": "all",
        "filters": [
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "monitor.slug",
                "match": "eq",
                "value": monitor.slug,
            },
        ],
        "frequency": 5,
        "name": f"Monitor Alert: {monitor.name}"[:64],
        "owner": None,
        "projects": [project.slug],
        "snooze": False,
    }

    for target in issue_alert_rule.get("targets", []):
        target_identifier = target["target_identifier"]
        target_type = target["target_type"]

        action = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetIdentifier": target_identifier,
            "targetType": target_type,
        }
        issue_alert_rule_data["actions"].append(action)

    return issue_alert_rule_data


def update_issue_alert_rule(
    request: Request,
    project: Project,
    monitor: Monitor,
    issue_alert_rule: Rule,
    issue_alert_rule_data: dict,
):
    actions = []
    for target in issue_alert_rule_data.get("targets", []):
        target_identifier = target["target_identifier"]
        target_type = target["target_type"]

        action = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetIdentifier": target_identifier,
            "targetType": target_type,
        }
        actions.append(action)

    serializer = RuleSerializer(
        context={"project": project, "organization": project.organization},
        data={
            "actions": actions,
            "environment": issue_alert_rule_data.get("environment", None),
        },
        partial=True,
    )

    if serializer.is_valid():
        data = serializer.validated_data

        # update only slug conditions
        conditions = issue_alert_rule.data.get("conditions", [])
        updated = False
        for condition in conditions:
            if condition.get("key") == "monitor.slug":
                condition["value"] = monitor.slug
                updated = True

        # slug condition not present, add slug to conditions
        if not updated:
            conditions.append(
                {
                    "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                    "key": "monitor.slug",
                    "match": "eq",
                    "value": monitor.slug,
                }
            )

        updated_rule = ProjectRuleUpdater(
            rule=issue_alert_rule,
            request=request,
            project=project,
            name=f"Monitor Alert: {monitor.name}"[:64],
            environment=data.get("environment", None),
            actions=data.get("actions", []),
            conditions=conditions,
        ).run()

        RuleActivity.objects.create(
            rule=updated_rule, user_id=request.user.id, type=RuleActivityType.UPDATED.value
        )

    return issue_alert_rule.id
