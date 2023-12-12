from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Union

from django.db import router, transaction
from django.utils import timezone
from rest_framework.request import Request

from sentry.api.serializers.rest_framework.rule import RuleSerializer
from sentry.db.models import BoundedPositiveIntegerField
from sentry.mediators.project_rules.creator import Creator
from sentry.mediators.project_rules.updater import Updater
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.rule import Rule, RuleActivity, RuleActivityType, RuleSource
from sentry.models.user import User
from sentry.monitors.constants import DEFAULT_CHECKIN_MARGIN, MAX_TIMEOUT, TIMEOUT
from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn
from sentry.signals import (
    cron_monitor_created,
    first_cron_checkin_received,
    first_cron_monitor_created,
)


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


def signal_monitor_created(project: Project, user, from_upsert: bool):
    cron_monitor_created.send_robust(
        project=project, user=user, from_upsert=from_upsert, sender=Project
    )
    check_and_signal_first_monitor_created(project, user, from_upsert)


def get_max_runtime(max_runtime: Optional[int]) -> timedelta:
    """
    Computes a timedelta given a max_runtime. Limits the returned timedelta
    to MAX_TIMEOUT. If an empty max_runtime is provided the default TIMEOUT
    will be used.
    """
    return timedelta(minutes=min((max_runtime or TIMEOUT), MAX_TIMEOUT))


# Generates a timeout_at value for new check-ins
def get_timeout_at(
    monitor_config: dict, status: CheckInStatus, date_added: Optional[datetime]
) -> Optional[datetime]:
    if status == CheckInStatus.IN_PROGRESS:
        return date_added.replace(second=0, microsecond=0) + get_max_runtime(
            (monitor_config or {}).get("max_runtime")
        )

    return None


# Generates a timeout_at value for existing check-ins that are being updated
def get_new_timeout_at(
    checkin: MonitorCheckIn, new_status: CheckInStatus, date_updated: datetime
) -> Optional[datetime]:
    return get_timeout_at(checkin.monitor.get_validated_config(), new_status, date_updated)


# Used to check valid implicit durations for closing check-ins without a duration specified
# as payload is already validated. Max value is > 24 days.
def valid_duration(duration: Optional[int]) -> bool:
    if duration and (duration < 0 or duration > BoundedPositiveIntegerField.MAX_VALUE):
        return False

    return True


def get_checkin_margin(checkin_margin: Optional[int]) -> timedelta:
    """
    Computes a timedelta given the checkin_margin (missed margin).
    If an empty value is provided the DEFAULT_CHECKIN_MARGIN will be used.
    """
    # TODO(epurkhiser): We should probably just set this value as a
    # `default` in the validator for the config instead of having the magic
    # default number here
    return timedelta(minutes=int(checkin_margin or DEFAULT_CHECKIN_MARGIN))


def fetch_associated_groups(
    trace_ids: List[str], organization_id: int, project_id: int, start: datetime, end
) -> Dict[str, List[Dict[str, int]]]:
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

    group_id_data: Dict[int, Set[str]] = defaultdict(set)
    trace_groups: Dict[str, List[Dict[str, Union[int, str]]]] = defaultdict(list)

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


def create_alert_rule(
    request: Request, project: Project, monitor: Monitor, validated_alert_rule: dict
):
    """
    Create an alert rule from a request with the given data
    :param request: Request object
    :param project: Project object
    :param monitor: Monitor object being created
    :param alert_rule: Dictionary of configurations for an associated Rule
    :return: dict
    """
    alert_rule_data = create_alert_rule_data(project, request.user, monitor, validated_alert_rule)
    serializer = RuleSerializer(
        context={"project": project, "organization": project.organization},
        data=alert_rule_data,
    )

    if not serializer.is_valid():
        return None

    data = serializer.validated_data
    # combine filters and conditions into one conditions criteria for the rule object
    conditions = data.get("conditions", [])
    if "filters" in data:
        conditions.extend(data["filters"])

    kwargs = {
        "name": data["name"],
        "environment": data.get("environment"),
        "project": project,
        "action_match": data["actionMatch"],
        "filter_match": data.get("filterMatch"),
        "conditions": conditions,
        "actions": data.get("actions", []),
        "frequency": data.get("frequency"),
        "user_id": request.user.id,
    }

    rule = Creator.run(request=request, **kwargs)
    rule.update(source=RuleSource.CRON_MONITOR)
    RuleActivity.objects.create(
        rule=rule, user_id=request.user.id, type=RuleActivityType.CREATED.value
    )
    return rule.id


def create_alert_rule_data(project: Project, user: User, monitor: Monitor, alert_rule: dict):
    """
    Gets a dict formatted alert rule to create alongside the monitor
    :param project: Project object
    :param user: User object that made the request
    :param monitor: Monitor object being created
    :param alert_rule: Dictionary of configurations for an associated Rule
    :return: dict
    """
    alert_rule_data = {
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
        "environment": alert_rule.get("environment", None),
        "filterMatch": "all",
        "filters": [
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "monitor.slug",
                "match": "eq",
                "value": monitor.slug,
            },
        ],
        "frequency": 1440,
        "name": f"Monitor Alert: {monitor.name}"[:64],
        "owner": None,
        "projects": [project.slug],
        "snooze": False,
    }

    for target in alert_rule.get("targets", []):
        target_identifier = target["target_identifier"]
        target_type = target["target_type"]

        action = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetIdentifier": target_identifier,
            "targetType": target_type,
        }
        alert_rule_data["actions"].append(action)

    return alert_rule_data


def update_alert_rule(
    request: Request, project: Project, monitor: Monitor, alert_rule: Rule, alert_rule_data: dict
):
    actions = []
    for target in alert_rule_data.get("targets", []):
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
            "environment": alert_rule_data.get("environment", None),
        },
        partial=True,
    )

    if serializer.is_valid():
        data = serializer.validated_data

        # update only slug conditions
        conditions = alert_rule.data.get("conditions", [])
        updated = False
        for condition in conditions:
            if condition.get("key") == "monitor.slug":
                condition["value"] = monitor.slug
                updated = True

        # slug condition not present, add slug to conditions
        if not updated:
            conditions = conditions.append[
                {
                    "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                    "key": "monitor.slug",
                    "match": "eq",
                    "value": monitor.slug,
                }
            ]

        kwargs = {
            "project": project,
            "actions": data.get("actions", []),
            "environment": data.get("environment", None),
            "name": f"Monitor Alert: {monitor.name}"[:64],
            "conditions": conditions,
        }

        updated_rule = Updater.run(rule=alert_rule, request=request, **kwargs)

        RuleActivity.objects.create(
            rule=updated_rule, user_id=request.user.id, type=RuleActivityType.UPDATED.value
        )

    return alert_rule.id
