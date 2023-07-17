import logging
from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from arroyo import Topic
from arroyo.backends.kafka import KafkaPayload, KafkaProducer, build_kafka_configuration
from django.conf import settings
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from sentry_kafka_schemas.schema_types.group_attributes_v1 import GroupAttributesSnapshot

from sentry.models import Group, GroupAssignee, GroupOwner, GroupOwnerType
from sentry.signals import issue_assigned, issue_deleted, issue_unassigned
from sentry.utils import json, metrics
from sentry.utils.arroyo_producer import SingletonProducer
from sentry.utils.kafka_config import get_kafka_producer_cluster_options, get_topic_definition

logger = logging.getLogger(__name__)


class Operation(Enum):
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"


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


def _retrieve_snapshot_values(group: Group, group_deleted: bool = False) -> GroupAttributesSnapshot:
    group_values = list(
        Group.objects.filter(id=group.id).values(
            "status", "substatus", "first_seen", "num_comments"
        )
    )
    assert len(group_values) == 1

    group_assignee_values = list(
        GroupAssignee.objects.filter(group_id=group.id)
        .order_by("-date_added")
        .values("user_id", "team_id")
    )

    group_owner_values = list(
        GroupOwner.objects.filter(group_id=group.id).values(
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
        "project_id": group.project.id,
        "group_id": group.id,
        "status": group_values[0]["status"],
        "substatus": group_values[0]["substatus"],
        "first_seen": group_values[0]["first_seen"],
        "num_comments": group_values[0]["num_comments"],
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


def _get_attribute_snapshot_producer() -> KafkaProducer:
    cluster_name = get_topic_definition(settings.KAFKA_GROUP_ATTRIBUTES)["cluster"]
    producer_config = get_kafka_producer_cluster_options(cluster_name)
    producer_config.pop("compression.type", None)
    producer_config.pop("message.max.bytes", None)
    return KafkaProducer(build_kafka_configuration(default_config=producer_config))


_attribute_snapshot_producer = SingletonProducer(
    _get_attribute_snapshot_producer, max_futures=settings.SENTRY_GROUP_ATTRIBUTES_FUTURES_MAX_LIMIT
)


def produce_snapshot_to_kafka(snapshot: GroupAttributesSnapshot) -> None:
    payload = KafkaPayload(None, json.dumps(snapshot).encode("utf-8"), [])
    _attribute_snapshot_producer.produce(Topic(settings.KAFKA_GROUP_ATTRIBUTES), payload)


@receiver(
    post_save, sender=Group, dispatch_uid="post_save_log_group_attributes_changed", weak=False
)
def post_save_log_group_attributes_changed(instance, sender, created, *args, **kwargs):
    try:
        if created:
            _log_group_attributes_changed(Operation.CREATED, "group", None)
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
    except Exception:
        logger.error("failed to log group attributes after group post_save", exc_info=True)


@issue_deleted.connect(weak=False)
def on_issue_deleted_log_deleted(group, user, delete_type, **kwargs):
    try:
        _log_group_attributes_changed(Operation.DELETED, "group", "all")
    except Exception:
        logger.error("failed to log group attributes after group delete", exc_info=True)


@issue_assigned.connect(weak=False)
def on_issue_assigned_log_group_assignee_attributes_changed(project, group, user, **kwargs):
    try:
        _log_group_attributes_changed(Operation.UPDATED, "group_assignee", "all")
    except Exception:
        logger.error(
            "failed to log group attributes after group_assignee assignment", exc_info=True
        )


@issue_unassigned.connect(weak=False)
def on_issue_unassigned_log_group_assignee_attributes_changed(project, group, user, **kwargs):
    try:
        _log_group_attributes_changed(Operation.DELETED, "group_assignee", "all")
    except Exception:
        logger.error(
            "failed to log group attributes after group_assignee unassignment", exc_info=True
        )


@receiver(
    post_save, sender=GroupOwner, dispatch_uid="post_save_log_group_owner_changed", weak=False
)
def post_save_log_group_owner_changed(instance, sender, created, update_fields, *args, **kwargs):
    try:
        _log_group_attributes_changed(
            Operation.CREATED if created else Operation.UPDATED, "group_owner", "all"
        )
    except Exception:
        logger.error("failed to log group attributes after group_owner updated", exc_info=True)


@receiver(
    post_delete, sender=GroupOwner, dispatch_uid="post_delete_log_group_owner_changed", weak=False
)
def post_delete_log_group_owner_changed(instance, sender, *args, **kwargs):
    try:
        _log_group_attributes_changed(Operation.DELETED, "group_owner", "all")
    except Exception:
        logger.error("failed to log group attributes after group_owner delete", exc_info=True)
