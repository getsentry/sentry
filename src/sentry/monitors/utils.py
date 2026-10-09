import logging
from collections import defaultdict
from datetime import datetime, timedelta
from uuid import uuid4

from django.db import router, transaction
from django.http.request import HttpRequest
from rest_framework.request import Request

from sentry import audit_log
from sentry.constants import ObjectStatus
from sentry.db.models import BoundedPositiveIntegerField
from sentry.db.postgres.transactions import in_test_hide_transaction_boundary
from sentry.middleware import is_frontend_request
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.rule import Rule, RuleActivity, RuleActivityType, RuleSource
from sentry.monitors.constants import DEFAULT_CHECKIN_MARGIN, MAX_TIMEOUT, TIMEOUT
from sentry.monitors.models import CheckInStatus, Monitor, MonitorCheckIn
from sentry.monitors.types import DATA_SOURCE_CRON_MONITOR
from sentry.projects.project_rules.creator import ProjectRuleCreator
from sentry.projects.project_rules.updater import ProjectRuleUpdater
from sentry.search.eap.occurrences.common_queries import get_group_to_trace_ids_map
from sentry.search.eap.occurrences.query_utils import build_snuba_params_from_ids
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.services.eventstore.snuba.backend import DEFAULT_LIMIT, DEFAULT_OFFSET
from sentry.signals import (
    cron_monitor_created,
    first_cron_checkin_received,
    first_cron_monitor_created,
)
from sentry.snuba.occurrences_rpc import OccurrenceCategory
from sentry.snuba.referrer import Referrer
from sentry.utils.audit import create_audit_entry, create_system_audit_entry
from sentry.utils.auth import AuthenticatedHttpRequest
from sentry.utils.db import atomic_transaction
from sentry.utils.projectflags import set_project_flag_and_signal
from sentry.workflow_engine.models import DataSource, DataSourceDetector, Detector

logger = logging.getLogger(__name__)


def get_request_attribution(request: HttpRequest | Request) -> dict[str, str | bool]:
    """
    Identify which endpoint served a request and whether it came from the UI.
    Used to attribute usage of deprecated Rule functionality on Cron Monitor
    endpoints, so these values are bounded and safe to use as metric tags.
    """
    resolver_match = getattr(request, "resolver_match", None)
    return {
        "endpoint": getattr(resolver_match, "url_name", None) or "unknown",
        "ui_request": is_frontend_request(request),
    }


def signal_first_checkin(project: Project, monitor: Monitor):
    if not project.flags.has_cron_checkins:
        # Backfill users that already have cron monitors
        check_and_signal_first_monitor_created(project, None, False)
        transaction.on_commit(
            lambda: set_project_flag_and_signal(
                project,
                "has_cron_checkins",
                first_cron_checkin_received,
                monitor_id=str(monitor.guid),
            ),
            router.db_for_write(Project),
        )


def check_and_signal_first_monitor_created(project: Project, user, from_upsert: bool):
    set_project_flag_and_signal(
        project, "has_cron_monitors", first_cron_monitor_created, user=user, from_upsert=from_upsert
    )


def signal_monitor_created(project: Project, user, from_upsert: bool, monitor: Monitor, request):
    cron_monitor_created.send_robust(
        project=project, user=user, from_upsert=from_upsert, sender=Project
    )
    check_and_signal_first_monitor_created(project, user, from_upsert)

    create_audit_log = create_system_audit_entry if from_upsert else create_audit_entry
    kwargs = {
        "organization": project.organization,
        **({"request": request} if not from_upsert else {}),
        "target_object": monitor.id,
        "event": audit_log.get_event_id("MONITOR_ADD"),
        "data": {"upsert": from_upsert, **monitor.get_audit_log_data()},
    }

    create_audit_log(**kwargs)


def get_max_runtime(max_runtime: int | None) -> timedelta:
    """
    Computes a timedelta given a max_runtime. Limits the returned timedelta
    to MAX_TIMEOUT. If an empty max_runtime is provided the default TIMEOUT
    will be used.
    """
    return timedelta(minutes=min((max_runtime or TIMEOUT), MAX_TIMEOUT))


# Generates a timeout_at value for new check-ins
def get_timeout_at(
    monitor_config: dict | None, status: int, date_added: datetime | None
) -> datetime | None:
    if status == CheckInStatus.IN_PROGRESS and date_added is not None:
        return date_added.replace(second=0, microsecond=0) + get_max_runtime(
            (monitor_config or {}).get("max_runtime")
        )

    return None


# The latest a check-in may stay open, regardless of in-progress updates
def get_max_timeout_at(checkin: MonitorCheckIn) -> datetime:
    return checkin.date_added.replace(second=0, microsecond=0) + timedelta(minutes=MAX_TIMEOUT)


# Generates a timeout_at value for existing check-ins that are being updated
def get_new_timeout_at(
    checkin: MonitorCheckIn, new_status: int, date_updated: datetime
) -> datetime | None:
    timeout_at = get_timeout_at(checkin.monitor.get_validated_config(), new_status, date_updated)
    if timeout_at is None:
        return None

    return min(timeout_at, get_max_timeout_at(checkin))


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


def _fetch_associated_groups_snuba(
    trace_ids: list[str],
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
) -> dict[int, set[str]]:
    """
    Snuba implementation of fetch_associated_groups.

    Returns a mapping of group_id to set of trace_ids.
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

    from sentry.services.eventstore.base import EventStorage
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

    result = raw_snql_query(snql_request, "api.serializer.checkins.trace-ids", use_cache=False)
    # if query completes successfully, add an array of objects with group id and short id
    # otherwise, return an empty dict to return an empty array through the serializer
    if "error" not in result:
        for event in result["data"]:
            trace_id_event_name = Columns.TRACE_ID.value.event_name
            assert trace_id_event_name is not None

            # create dict with group_id and trace_id
            group_id_data[event["group_id"]].add(event[trace_id_event_name])

    return dict(group_id_data)


def _fetch_associated_groups_eap(
    trace_ids: list[str],
    organization_id: int,
    project_id: int,
    start: datetime,
    end: datetime,
) -> dict[int, set[str]]:
    """
    EAP implementation of fetch_associated_groups.

    Returns a mapping of group_id to set of trace_ids.
    """
    query_start = start - timedelta(minutes=30)
    query_end = end + timedelta(minutes=30)

    snuba_params = build_snuba_params_from_ids(
        organization_id=organization_id,
        project_ids=[project_id],
        start=query_start,
        end=query_end,
    )
    if snuba_params is None:
        return {}

    return get_group_to_trace_ids_map(
        snuba_params=snuba_params,
        trace_ids=trace_ids,
        referrer=Referrer.API_SERIALIZER_CHECKINS_TRACE_IDS.value,
        limit=DEFAULT_LIMIT,
        occurrence_category=OccurrenceCategory.ERROR,
        orderby=["-timestamp"],
        offset=DEFAULT_OFFSET,
    )


def fetch_associated_groups(
    trace_ids: list[str], organization_id: int, project_id: int, start: datetime, end: datetime
) -> dict[str, list[dict[str, int | str]]]:
    """
    Returns groups associated with check-in trace ids, formatted for the serializer.
    """
    snuba_result = _fetch_associated_groups_snuba(
        trace_ids, organization_id, project_id, start, end
    )
    group_id_data = snuba_result

    callsite = "monitors.fetch_associated_groups"
    if EAPOccurrencesComparator.should_check_experiment(callsite):
        eap_result = _fetch_associated_groups_eap(
            trace_ids, organization_id, project_id, start, end
        )
        group_id_data = EAPOccurrencesComparator.check_and_choose(
            snuba_result,
            eap_result,
            callsite,
            is_experimental_data_nullish=len(eap_result) == 0,
            reasonable_match_comparator=lambda snuba, eap: (
                eap.keys() <= snuba.keys() and all(eap[gid] <= snuba[gid] for gid in eap)
            ),
            debug_context={
                "organization_id": organization_id,
                "project_id": project_id,
                "trace_ids_count": len(trace_ids),
                "start": start.isoformat(),
                "end": end.isoformat(),
            },
        )

    trace_groups: dict[str, list[dict[str, int | str]]] = defaultdict(list)
    if group_id_data:
        group_ids = group_id_data.keys()
        groups_queryset = Group.objects.filter(
            project_id=project_id, id__in=group_ids
        ).select_related("project")
        for group in groups_queryset:
            for trace_id in group_id_data[group.id]:
                trace_groups[trace_id].append({"id": group.id, "shortId": group.qualified_short_id})

    return trace_groups


def create_issue_alert_rule(
    request: AuthenticatedHttpRequest,
    project: Project,
    monitor: Monitor,
    validated_issue_alert_rule: dict,
) -> int:
    """
    Creates an Issue Alert `Rule` instance from a request with the given data
    :param request: Request object
    :param project: Project object
    :param monitor: Monitor object being created
    :param validated_issue_alert_rule: Dictionary of configurations for an associated Rule
    :return: dict
    """
    rule = ProjectRuleCreator(
        name=f"Monitor Alert: {monitor.name}"[:64],
        project=project,
        action_match="any",
        actions=_build_issue_alert_rule_actions(validated_issue_alert_rule),
        conditions=[
            {"id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"},
            {"id": "sentry.rules.conditions.regression_event.RegressionEventCondition"},
            {
                "id": "sentry.rules.filters.tagged_event.TaggedEventFilter",
                "key": "monitor.slug",
                "match": "eq",
                "value": monitor.slug,
            },
        ],
        frequency=5,
        environment=validated_issue_alert_rule.get("environment"),
        filter_match="all",
        request=request,
        source=RuleSource.CRON_MONITOR,
    ).run()
    RuleActivity.objects.create(
        rule=rule, user_id=request.user.id, type=RuleActivityType.CREATED.value
    )
    return rule.id


def _build_issue_alert_rule_actions(issue_alert_rule: dict) -> list[dict]:
    return [
        {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetIdentifier": target["target_identifier"],
            "targetType": target["target_type"],
            "uuid": str(uuid4()),
        }
        for target in issue_alert_rule.get("targets", [])
    ]


def update_issue_alert_rule(
    request: Request,
    project: Project,
    monitor: Monitor,
    issue_alert_rule: Rule,
    issue_alert_rule_data: dict,
):
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
        environment=issue_alert_rule_data.get("environment"),
        actions=_build_issue_alert_rule_actions(issue_alert_rule_data),
        conditions=conditions,
    ).run()

    RuleActivity.objects.create(
        rule=updated_rule, user_id=request.user.id, type=RuleActivityType.UPDATED.value
    )

    return issue_alert_rule.id


def ensure_cron_detector(monitor: Monitor) -> Detector | None:
    from sentry.monitors.grouptype import MonitorIncidentType

    try:
        with atomic_transaction(using=router.db_for_write(DataSource)):
            data_source, created = DataSource.objects.get_or_create(
                type=DATA_SOURCE_CRON_MONITOR,
                organization_id=monitor.organization_id,
                source_id=str(monitor.id),
            )
            if created:
                detector = Detector.objects.create(
                    type=MonitorIncidentType.slug,
                    project_id=monitor.project_id,
                    name=monitor.name,
                    owner_user_id=monitor.owner_user_id,
                    owner_team_id=monitor.owner_team_id,
                    enabled=monitor.status == ObjectStatus.ACTIVE,
                    config={},
                )
                DataSourceDetector.objects.create(data_source=data_source, detector=detector)
                return detector
            else:
                return Detector.objects.get(
                    type=MonitorIncidentType.slug,
                    project_id=monitor.project_id,
                    data_sources=data_source,
                )

    except Exception:
        logger.exception("Error creating cron detector")

    return None


def ensure_cron_detector_deletion(monitor: Monitor):
    with atomic_transaction(using=router.db_for_write(DataSource)):
        try:
            data_source = DataSource.objects.get(
                type=DATA_SOURCE_CRON_MONITOR,
                organization_id=monitor.organization_id,
                source_id=str(monitor.id),
            )
        except DataSource.DoesNotExist:
            return

        detector = None
        try:
            detector = Detector.objects.get(data_sources=data_source)
        except Detector.DoesNotExist:
            pass

        # We don't want to end up in a loop when attempting to delete monitors, so just delete these directly.
        # This is just temporary until we move completely over to the detector apis.
        data_source.delete()
        if detector:
            detector.delete()


def update_monitor_status(monitor: Monitor, status: int) -> None:
    monitor.update(status=status)
    sync_cron_detector_enabled(monitor)


def sync_cron_detector_enabled(monitor: Monitor) -> None:
    """
    The monitors UI reads `Detector.enabled`, so keep it in line with
    `Monitor.status` whenever the status changes.
    """
    detector = get_detector_for_monitor(monitor)
    enabled = monitor.status == ObjectStatus.ACTIVE
    if detector and detector.enabled != enabled:
        detector.update(enabled=enabled)


def get_detector_for_monitor(monitor: Monitor) -> Detector | None:
    try:
        with in_test_hide_transaction_boundary():
            return Detector.objects.get(
                datasource__type=DATA_SOURCE_CRON_MONITOR,
                datasource__source_id=str(monitor.id),
                datasource__organization_id=monitor.organization_id,
            )
    except Detector.DoesNotExist:
        return None
