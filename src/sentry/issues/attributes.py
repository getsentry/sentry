import dataclasses
import logging
from collections.abc import Iterable
from datetime import datetime
from enum import Enum

import urllib3
from arroyo import Topic as ArroyoTopic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings
from django.db.models import F, Window
from django.db.models.functions import Rank
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from sentry_kafka_schemas.schema_types.group_attributes_v1 import GroupAttributesSnapshot

from sentry.conf.types.kafka_definition import Topic
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.signals import issue_assigned, issue_deleted, issue_unassigned, post_update
from sentry.utils import json, metrics, snuba
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition
from sentry.utils.snuba import _snuba_pool

logger = logging.getLogger(__name__)


class Operation(Enum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"


@dataclasses.dataclass
class GroupValues:
    id: int
    project_id: int
    status: int
    substatus: int | None
    first_seen: datetime
    num_comments: int
    priority: int | None
    first_release_id: int | None


def _get_attribute_snapshot_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(Topic.GROUP_ATTRIBUTES)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_attribute_snapshot_producer = SingletonProducer(
    _get_attribute_snapshot_producer, max_futures=settings.SENTRY_GROUP_ATTRIBUTES_FUTURES_MAX_LIMIT
)


def _log_group_attributes_changed(
    operation: Operation,
    model_inducing_snapshot: str,
    column_inducing_snapshot: str | None = None,
) -> None:
    metrics.incr(
        "group_attributes.changed",
        tags={
            "operation": operation.value,
            "model": model_inducing_snapshot,
            "column": column_inducing_snapshot,
        },
    )


def send_snapshot_values(
    group_id: int | None, group: Group | None, group_deleted: bool = False
) -> None:
    group_ids = None
    if group_id:
        group_ids = [group_id]

    groups = None
    if group:
        groups = [group]

    bulk_send_snapshot_values(group_ids, groups, group_deleted=group_deleted)


def bulk_send_snapshot_values(
    group_ids: list[int] | None, groups: list[Group] | None, group_deleted: bool = False
) -> None:
    if group_ids is None and groups is None:
        raise ValueError("cannot send snapshot values when group_ids and groups are None")

    group_list: list[Group | GroupValues] = [*(groups or [])]
    if group_ids:
        group_list.extend(_bulk_retrieve_group_values(group_ids))

    snapshots = _bulk_retrieve_snapshot_values(group_list, group_deleted=group_deleted)

    for snapshot in snapshots:
        produce_snapshot_to_kafka(snapshot)


def produce_snapshot_to_kafka(snapshot: GroupAttributesSnapshot) -> None:
    if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
        # If we're not running Kafka then we're just in dev. Skip producing to Kafka and just
        # write to snuba directly
        try:
            resp = _snuba_pool.urlopen(
                "POST",
                "/tests/entities/group_attributes/insert",
                body=json.dumps([snapshot]),
                headers={},
            )
            if resp.status != 200:
                raise snuba.SnubaError(
                    f"HTTP {resp.status} response from Snuba! {resp.data.decode('utf-8')}"
                )
            return None
        except urllib3.exceptions.HTTPError as err:
            raise snuba.SnubaError(err)
    else:
        payload = KafkaPayload(None, json.dumps(snapshot).encode("utf-8"), [])
        _attribute_snapshot_producer.produce(
            ArroyoTopic(get_topic_definition(Topic.GROUP_ATTRIBUTES)["real_topic_name"]), payload
        )


def _bulk_retrieve_group_values(group_ids: list[int]) -> list[GroupValues]:
    group_values_map = {
        group["id"]: group
        for group in Group.objects.filter(id__in=group_ids).values(
            "id",
            "project_id",
            "status",
            "substatus",
            "first_seen",
            "num_comments",
            "priority",
            "first_release",
        )
    }
    assert len(group_values_map) == len(group_ids)

    results = []
    for group_id in group_ids:
        group_values = group_values_map[group_id]
        results.append(
            GroupValues(
                id=group_id,
                project_id=group_values["project_id"],
                status=group_values["status"],
                substatus=group_values["substatus"],
                first_seen=group_values["first_seen"],
                num_comments=group_values["num_comments"] or 0,
                priority=group_values["priority"],
                first_release_id=(group_values["first_release"] or None),
            )
        )
    return results


def _bulk_retrieve_snapshot_values(
    group_values_list: Iterable[Group | GroupValues], group_deleted: bool = False
) -> list[GroupAttributesSnapshot]:
    group_assignee_map = {
        ga["group_id"]: ga
        for ga in GroupAssignee.objects.filter(
            group_id__in=[gv.id for gv in group_values_list]
        ).values("group_id", "user_id", "team_id")
    }

    group_owner_map = {}

    for group_owner in (
        GroupOwner.objects.annotate(
            position=Window(Rank(), partition_by=[F("group_id"), F("type")], order_by="-date_added")
        )
        .filter(position=1, group_id__in=[g.id for g in group_values_list])
        .values("group_id", "user_id", "team_id", "type")
    ):
        group_owner_map[(group_owner["group_id"], group_owner["type"])] = group_owner

    snapshots = []
    for group_value in group_values_list:
        assignee = group_assignee_map.get(group_value.id)
        suspect_owner = group_owner_map.get((group_value.id, GroupOwnerType.SUSPECT_COMMIT.value))
        ownership_owner = group_owner_map.get((group_value.id, GroupOwnerType.OWNERSHIP_RULE.value))
        codeowners_owner = group_owner_map.get((group_value.id, GroupOwnerType.CODEOWNERS.value))
        snapshot: GroupAttributesSnapshot = {
            "group_deleted": group_deleted,
            "project_id": group_value.project_id,
            "group_id": group_value.id,
            "status": group_value.status,
            "substatus": group_value.substatus,
            "priority": group_value.priority,
            "first_release": group_value.first_release_id,
            "first_seen": group_value.first_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            "num_comments": group_value.num_comments,
            "timestamp": datetime.now().isoformat(),
            "assignee_user_id": assignee["user_id"] if assignee else None,
            "assignee_team_id": assignee["team_id"] if assignee else None,
            "owner_suspect_commit_user_id": suspect_owner["user_id"] if suspect_owner else None,
            "owner_ownership_rule_user_id": ownership_owner["user_id"] if ownership_owner else None,
            "owner_ownership_rule_team_id": ownership_owner["team_id"] if ownership_owner else None,
            "owner_codeowners_user_id": codeowners_owner["user_id"] if codeowners_owner else None,
            "owner_codeowners_team_id": codeowners_owner["team_id"] if codeowners_owner else None,
        }
        snapshots.append(snapshot)

    return snapshots


@receiver(
    post_save, sender=Group, dispatch_uid="post_save_log_group_attributes_changed", weak=False
)
def post_save_log_group_attributes_changed(instance, sender, created, *args, **kwargs) -> None:
    try:
        if created:
            _log_group_attributes_changed(Operation.CREATED, "group", None)
            send_snapshot_values(None, instance, False)
        else:
            if process_update_fields(kwargs.get("update_fields", set())):
                send_snapshot_values(None, instance, False)
    except Exception:
        logger.exception("failed to log group attributes after group post_save")


@receiver(post_update, sender=Group, dispatch_uid="post_update_group", weak=False)
def post_update_group(sender, updated_fields, model_ids, *args, **kwargs) -> None:
    try:
        updated_fields = process_update_fields(updated_fields)
        if updated_fields:
            bulk_send_snapshot_values(model_ids, None)
    except Exception:
        logger.exception("failed to log group attributes after group_owner updated")


def process_update_fields(updated_fields) -> set[str]:
    if not updated_fields:
        # we have no guarantees update_fields is used everywhere save() is called
        # we'll need to assume any of the attributes are updated in that case
        updated_fields = {"all"}
    else:
        VALID_FIELDS = {"status", "substatus", "num_comments", "priority", "first_release"}
        updated_fields = VALID_FIELDS.intersection(updated_fields or ())
    if updated_fields:
        _log_group_attributes_changed(Operation.UPDATED, "group", "-".join(sorted(updated_fields)))
    return updated_fields


@issue_deleted.connect(weak=False)
def on_issue_deleted_log_deleted(group, user, delete_type, **kwargs) -> None:
    try:
        _log_group_attributes_changed(Operation.DELETED, "group", "all")
        send_snapshot_values(None, group, True)
    except Exception:
        logger.exception("failed to log group attributes after group delete")


@issue_assigned.connect(weak=False)
def on_issue_assigned_log_group_assignee_attributes_changed(project, group, user, **kwargs) -> None:
    try:
        _log_group_attributes_changed(Operation.UPDATED, "group_assignee", "all")
        send_snapshot_values(None, group, False)
    except Exception:
        logger.exception("failed to log group attributes after group_assignee assignment")


@issue_unassigned.connect(weak=False)
def on_issue_unassigned_log_group_assignee_attributes_changed(
    project, group, user, **kwargs
) -> None:
    try:
        _log_group_attributes_changed(Operation.DELETED, "group_assignee", "all")
        send_snapshot_values(None, group, False)
    except Exception:
        logger.exception("failed to log group attributes after group_assignee unassignment")


@receiver(
    post_save, sender=GroupOwner, dispatch_uid="post_save_log_group_owner_changed", weak=False
)
def post_save_log_group_owner_changed(
    instance, sender, created, update_fields, *args, **kwargs
) -> None:
    try:
        _log_group_attributes_changed(
            Operation.CREATED if created else Operation.UPDATED, "group_owner", "all"
        )
        send_snapshot_values(instance.group_id, None, False)
    except Exception:
        logger.exception("failed to log group attributes after group_owner updated")


@receiver(
    post_delete, sender=GroupOwner, dispatch_uid="post_delete_log_group_owner_changed", weak=False
)
def post_delete_log_group_owner_changed(instance, sender, *args, **kwargs) -> None:
    try:
        _log_group_attributes_changed(Operation.DELETED, "group_owner", "all")
        send_snapshot_values(instance.group_id, None, False)
    except Exception:
        logger.exception("failed to log group attributes after group_owner delete")
