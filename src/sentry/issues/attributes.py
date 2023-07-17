import logging
from enum import Enum
from typing import Optional

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from sentry.models import Group, GroupOwner
from sentry.signals import issue_assigned, issue_deleted, issue_unassigned
from sentry.utils import metrics

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
