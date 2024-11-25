from collections.abc import MutableMapping
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import StrEnum
from time import time
from typing import TYPE_CHECKING, Any, TypedDict, TypeVar

from django.utils import timezone as django_timezone

from sentry import analytics
from sentry.event_manager import assign_event_to_group
from sentry.integrations.tasks.kick_off_status_syncs import kick_off_status_syncs
from sentry.issues import grouptype
from sentry.metrics.middleware import MutableTags
from sentry.models.activity import Activity
from sentry.models.group import Group, GroupStatus
from sentry.models.grouphistory import GroupHistoryStatus, record_group_history
from sentry.models.groupinbox import GroupInboxRemoveAction, remove_group_from_inbox
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.signals import issue_resolved
from sentry.types.activity import ActivityType
from sentry.workflow_engine.models import DataPacket
from sentry.workflow_engine.models.data_condition import Condition, condition_registry
from sentry.workflow_engine.processors.detector import DetectorEvaluationResult, DetectorHandler
from sentry.workflow_engine.types import DetectorGroupKey

if TYPE_CHECKING:
    from sentry.eventstore.models import Event

T = TypeVar("T")


class ErrorDetectorConfigType(StrEnum):
    GROUPING = "ErrorGroupingCondition"
    RESOLVE = "ErrorResolveCondition"


class ErrorDetectorHandler(DetectorHandler[T]):
    def evaluate(
        self, data_packet: DataPacket[T]
    ) -> dict[DetectorGroupKey, DetectorEvaluationResult]:
        pass

    def apply(self, type: ErrorDetectorConfigType, data: dict[str, Any]):
        assert self.condition_group
        config = self.condition_group.conditions.get(
            type=type
        )  # unused condition model for project options. can migrate later, but make sure it exists
        assert config
        condition = condition_registry.get(type)
        return condition.apply(data)

    def check_auto_resolve_project(self, project_id, options, cutoff):
        if not options.get("sentry:resolve_age"):
            # kill the option to avoid it coming up in the future
            ProjectOption.objects.filter(
                key__in=["sentry:_last_auto_resolve", "sentry:resolve_age"], project=project_id
            ).delete()
            return False

        if int(options.get("sentry:_last_auto_resolve", 0)) > cutoff:
            return False

        return True


Job = MutableMapping[str, Any]


@condition_registry.register("ErrorGroupingCondition")
@dataclass
class ErrorGroupingCondition(Condition):
    data_dict = TypedDict(
        "ErrorGroupingDict", {"event": Event, "job": Job, "metric_tags": MutableTags}
    )

    @classmethod
    def apply(cls, data: dict[str, Any]):
        data_dict = cls.data_dict(**data)

        # nothing to do with getting the DataCondition here...
        return assign_event_to_group(**data_dict)


@condition_registry.register("ErrorResolveCondition")
@dataclass
class ErrorResolveCondition(Condition):
    # for a project
    data_dict = TypedDict("ErrorResolveDict", {"project_id": int, "chunk_size": int, "cutoff": Any})

    @classmethod
    def apply(cls, data: dict[str, Any]):
        data_dict = cls.data_dict(**data)
        cutoff = data_dict.cutoff

        project = Project.objects.get_from_cache(id=data_dict.project_id)
        age = project.get_option("sentry:resolve_age", None)
        if not age:
            return

        project.update_option("sentry:_last_auto_resolve", int(time()))

        if cutoff:
            cutoff = datetime.fromtimestamp(cutoff, timezone.utc)
        else:
            cutoff = django_timezone.now() - timedelta(hours=int(age))

        filter_conditions = {
            "project": project,
            "last_seen__lte": cutoff,
            "status": GroupStatus.UNRESOLVED,
        }

        enabled_auto_resolve_types = [
            group_type.type_id
            for group_type in grouptype.registry.all()
            if group_type.enable_auto_resolve
        ]
        filter_conditions["type__in"] = enabled_auto_resolve_types

        chunk_size = data_dict.chunk_size
        queryset = list(Group.objects.filter(**filter_conditions)[:chunk_size])

        for group in queryset:
            happened = Group.objects.filter(
                id=group.id,
                status=GroupStatus.UNRESOLVED,
                last_seen__lte=cutoff,
            ).update(
                status=GroupStatus.RESOLVED,
                resolved_at=django_timezone.now(),
                substatus=None,
            )
            remove_group_from_inbox(group, action=GroupInboxRemoveAction.RESOLVED)

            if happened:
                Activity.objects.create(
                    group=group,
                    project=project,
                    type=ActivityType.SET_RESOLVED_BY_AGE.value,
                    data={"age": age},
                )
                record_group_history(group, GroupHistoryStatus.AUTO_RESOLVED)

                kick_off_status_syncs.apply_async(
                    kwargs={"project_id": group.project_id, "group_id": group.id}
                )

                analytics.record(
                    "issue.auto_resolved",
                    project_id=project.id,
                    organization_id=project.organization_id,
                    group_id=group.id,
                    issue_type=group.issue_type.slug,
                    issue_category=group.issue_category.name.lower(),
                )
                # auto-resolve is a kind of resolve and this signal makes
                # sure all things that need to happen after resolve are triggered
                # examples are analytics and webhooks
                issue_resolved.send_robust(
                    organization_id=project.organization_id,
                    user=None,
                    group=group,
                    project=project,
                    resolution_type="autoresolve",
                    sender="auto_resolve_issues",
                )

            might_have_more = len(queryset) == chunk_size
            return might_have_more
