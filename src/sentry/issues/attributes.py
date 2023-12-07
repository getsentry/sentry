import dataclasses
import logging
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional, Union

import requests
import urllib3
from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from sentry_kafka_schemas.schema_types.group_attributes_v1 import GroupAttributesSnapshot

from sentry import options
from sentry.models.group import Group
from sentry.models.groupassignee import GroupAssignee
from sentry.models.groupowner import GroupOwner, GroupOwnerType
from sentry.signals import issue_assigned, issue_deleted, issue_unassigned
from sentry.utils import json, metrics, snuba
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

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
    substatus: Optional[int]
    first_seen: datetime
    num_comments: int


def _get_attribute_snapshot_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(settings.KAFKA_GROUP_ATTRIBUTES)["cluster"]
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
    column_inducing_snapshot: Optional[str] = None,
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
    group_id: Optional[int], group: Optional[Group], group_deleted: bool = False
) -> None:
    if not (options.get("issues.group_attributes.send_kafka") or False):
        return

    if group_id is None and group is None:
        raise ValueError("cannot send snapshot values when group_id and group are None")

    if group is not None:
        return produce_snapshot_to_kafka(_retrieve_snapshot_values(group, group_deleted))

    if group_id is not None:
        return produce_snapshot_to_kafka(
            _retrieve_snapshot_values(_retrieve_group_values(group_id), group_deleted)
        )


def produce_snapshot_to_kafka(snapshot: GroupAttributesSnapshot) -> None:
    if settings.SENTRY_EVENTSTREAM != "sentry.eventstream.kafka.KafkaEventStream":
        # If we're not running Kafka then we're just in dev. Skip producing to Kafka and just
        # write to snuba directly
        try:
            resp = requests.post(
                f"{settings.SENTRY_SNUBA}/tests/entities/group_attributes/insert",
                data=json.dumps([snapshot]),
            )
            if resp.status_code != 200:
                raise snuba.SnubaError(
                    f"HTTP {resp.status_code} response from Snuba! {resp.content.decode('utf-8')}"
                )
            return None
        except urllib3.exceptions.HTTPError as err:
            raise snuba.SnubaError(err)
    else:
        payload = KafkaPayload(None, json.dumps(snapshot).encode("utf-8"), [])
        _attribute_snapshot_producer.produce(Topic(settings.KAFKA_GROUP_ATTRIBUTES), payload)


def _retrieve_group_values(group_id: int) -> GroupValues:
    group_values = list(
        Group.objects.filter(id=group_id).values(
            "project_id", "status", "substatus", "first_seen", "num_comments"
        )
    )
    assert len(group_values) == 1

    return GroupValues(
        id=group_id,
        project_id=group_values[0]["project_id"],
        status=group_values[0]["status"],
        substatus=group_values[0]["substatus"],
        first_seen=group_values[0]["first_seen"],
        num_comments=group_values[0]["num_comments"],
    )


def _retrieve_snapshot_values(
    group_values: Union[Group, GroupValues], group_deleted: bool = False
) -> GroupAttributesSnapshot:
    group_assignee_values = list(
        GroupAssignee.objects.filter(group_id=group_values.id)
        .order_by("-date_added")
        .values("user_id", "team_id")
    )

    group_owner_values = list(
        GroupOwner.objects.filter(group_id=group_values.id).values(
            "type", "user_id", "team_id", "date_added"
        )
    )
    latest_group_owner_by_type: Dict[int, Dict[str, Any]] = {}
    for vals in group_owner_values:
        if vals["type"] in latest_group_owner_by_type:
            if vals["date_added"] >= latest_group_owner_by_type[vals["type"]]["date_added"]:
                latest_group_owner_by_type[vals["type"]] = vals
        else:
            latest_group_owner_by_type[vals["type"]] = vals

    return {
        "group_deleted": group_deleted,
        "project_id": group_values.project_id,
        "group_id": group_values.id,
        "status": group_values.status,
        "substatus": group_values.substatus,
        "first_seen": group_values.first_seen.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        "num_comments": group_values.num_comments,
        "assignee_user_id": group_assignee_values[0]["user_id"]
        if len(group_assignee_values) > 0
        else None,
        "assignee_team_id": group_assignee_values[0]["team_id"]
        if len(group_assignee_values) > 0
        else None,
        "owner_suspect_commit_user_id": latest_group_owner_by_type[
            GroupOwnerType.SUSPECT_COMMIT.value
        ]["user_id"]
        if GroupOwnerType.SUSPECT_COMMIT.value in latest_group_owner_by_type
        else None,
        "owner_ownership_rule_user_id": latest_group_owner_by_type[
            GroupOwnerType.OWNERSHIP_RULE.value
        ]["user_id"]
        if GroupOwnerType.OWNERSHIP_RULE.value in latest_group_owner_by_type
        else None,
        "owner_ownership_rule_team_id": latest_group_owner_by_type[
            GroupOwnerType.OWNERSHIP_RULE.value
        ]["team_id"]
        if GroupOwnerType.OWNERSHIP_RULE.value in latest_group_owner_by_type
        else None,
        "owner_codeowners_user_id": latest_group_owner_by_type[GroupOwnerType.CODEOWNERS.value][
            "user_id"
        ]
        if GroupOwnerType.CODEOWNERS.value in latest_group_owner_by_type
        else None,
        "owner_codeowners_team_id": latest_group_owner_by_type[GroupOwnerType.CODEOWNERS.value][
            "team_id"
        ]
        if GroupOwnerType.CODEOWNERS.value in latest_group_owner_by_type
        else None,
        "timestamp": datetime.now().isoformat(),
    }


@receiver(
    post_save, sender=Group, dispatch_uid="post_save_log_group_attributes_changed", weak=False
)
def post_save_log_group_attributes_changed(instance, sender, created, *args, **kwargs):
    try:
        if created:
            _log_group_attributes_changed(Operation.CREATED, "group", None)
            send_snapshot_values(None, instance, False)
        else:
            if "update_fields" in kwargs:
                update_fields = kwargs["update_fields"]
                # we have no guarantees update_fields is used everywhere save() is called
                # we'll need to assume any of the attributes are updated in that case
                attributes_updated = {"status", "substatus", "num_comments"}.intersection(
                    update_fields or ()
                )
                if attributes_updated:
                    _log_group_attributes_changed(
                        Operation.UPDATED, "group", "-".join(sorted(attributes_updated))
                    )
                    send_snapshot_values(None, instance, False)
    except Exception:
        logger.exception("failed to log group attributes after group post_save")


@issue_deleted.connect(weak=False)
def on_issue_deleted_log_deleted(group, user, delete_type, **kwargs):
    try:
        _log_group_attributes_changed(Operation.DELETED, "group", "all")
        send_snapshot_values(None, group, True)
    except Exception:
        logger.exception("failed to log group attributes after group delete")


@issue_assigned.connect(weak=False)
def on_issue_assigned_log_group_assignee_attributes_changed(project, group, user, **kwargs):
    try:
        _log_group_attributes_changed(Operation.UPDATED, "group_assignee", "all")
        send_snapshot_values(None, group, False)
    except Exception:
        logger.exception("failed to log group attributes after group_assignee assignment")


@issue_unassigned.connect(weak=False)
def on_issue_unassigned_log_group_assignee_attributes_changed(project, group, user, **kwargs):
    try:
        _log_group_attributes_changed(Operation.DELETED, "group_assignee", "all")
        send_snapshot_values(None, group, False)
    except Exception:
        logger.exception("failed to log group attributes after group_assignee unassignment")


@receiver(
    post_save, sender=GroupOwner, dispatch_uid="post_save_log_group_owner_changed", weak=False
)
def post_save_log_group_owner_changed(instance, sender, created, update_fields, *args, **kwargs):
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
def post_delete_log_group_owner_changed(instance, sender, *args, **kwargs):
    try:
        _log_group_attributes_changed(Operation.DELETED, "group_owner", "all")
        send_snapshot_values(instance.group_id, None, False)
    except Exception:
        logger.exception("failed to log group attributes after group_owner delete")
