from typing import TYPE_CHECKING, Optional, Union

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import BaseManager, FlexibleForeignKey, Model, sane_repr
from sentry.notifications.types import GroupSubscriptionReason
from sentry.signals import issue_assigned
from sentry.types.activity import ActivityType
from sentry.utils import metrics

if TYPE_CHECKING:
    from sentry.models import ActorTuple, Group, Team, User


class GroupAssigneeManager(BaseManager):
    def assign(
        self,
        group: "Group",
        assigned_to: Union["Team", "User"],
        acting_user: Optional["User"] = None,
    ):
        from sentry import features
        from sentry.integrations.utils import sync_group_assignee_outbound
        from sentry.models import Activity, GroupSubscription, Team, User

        GroupSubscription.objects.subscribe_actor(
            group=group, actor=assigned_to, reason=GroupSubscriptionReason.assigned
        )

        if isinstance(assigned_to, User):
            assignee_type = "user"
            other_type = "team"
        elif isinstance(assigned_to, Team):
            assignee_type = "team"
            other_type = "user"
        else:
            raise AssertionError(f"Invalid type to assign to: {type(assigned_to)}")

        now = timezone.now()
        assignee, created = self.get_or_create(
            group=group,
            defaults={"project": group.project, assignee_type: assigned_to, "date_added": now},
        )

        if not created:
            affected = (
                self.filter(group=group)
                .exclude(**{assignee_type: assigned_to})
                .update(**{assignee_type: assigned_to, other_type: None, "date_added": now})
            )
        else:
            affected = True
            issue_assigned.send_robust(
                project=group.project, group=group, user=acting_user, sender=self.__class__
            )

        if affected:
            Activity.objects.create_group_activity(
                group,
                ActivityType.ASSIGNED,
                user=acting_user,
                data={
                    "assignee": str(assigned_to.id),
                    "assigneeEmail": getattr(assigned_to, "email", None),
                    "assigneeType": assignee_type,
                },
            )

            metrics.incr("group.assignee.change", instance="assigned", skip_internal=True)
            # sync Sentry assignee to external issues
            if assignee_type == "user" and features.has(
                "organizations:integrations-issue-sync", group.organization, actor=acting_user
            ):
                sync_group_assignee_outbound(group, assigned_to.id, assign=True)

        return {"new_assignment": created, "updated_assignment": bool(not created and affected)}

    def deassign(self, group, acting_user=None):
        from sentry import features
        from sentry.integrations.utils import sync_group_assignee_outbound
        from sentry.models import Activity

        affected = self.filter(group=group)[:1].count()
        self.filter(group=group).delete()

        if affected > 0:
            activity = Activity.objects.create(
                project=group.project, group=group, type=Activity.UNASSIGNED, user=acting_user
            )
            activity.send_notification()
            metrics.incr("group.assignee.change", instance="deassigned", skip_internal=True)
            # sync Sentry assignee to external issues
            if features.has(
                "organizations:integrations-issue-sync", group.organization, actor=acting_user
            ):
                sync_group_assignee_outbound(group, None, assign=False)


class GroupAssignee(Model):
    """
    Identifies an assignment relationship between a user/team and an
    aggregated event (Group).
    """

    __include_in_export__ = False

    objects = GroupAssigneeManager()

    project = FlexibleForeignKey("sentry.Project", related_name="assignee_set")
    group = FlexibleForeignKey("sentry.Group", related_name="assignee_set", unique=True)
    user = FlexibleForeignKey(
        settings.AUTH_USER_MODEL, related_name="sentry_assignee_set", null=True
    )
    team = FlexibleForeignKey("sentry.Team", related_name="sentry_assignee_set", null=True)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_groupasignee"
        unique_together = [("project", "group")]

    __repr__ = sane_repr("group_id", "user_id", "team_id")

    def save(self, *args, **kwargs):
        assert not (self.user_id is not None and self.team_id is not None) and not (
            self.user_id is None and self.team_id is None
        ), "Must have Team or User, not both"
        super().save(*args, **kwargs)

    def assigned_actor_id(self) -> str:
        # TODO(mgaeta): Create migration for GroupAssignee to use the Actor model.
        if self.user:
            return f"user:{self.user_id}"

        if self.team:
            return f"team:{self.team_id}"

        raise NotImplementedError("Unknown Assignee")

    def assigned_actor(self) -> "ActorTuple":
        from sentry.models import ActorTuple

        return ActorTuple.from_actor_identifier(self.assigned_actor_id())
