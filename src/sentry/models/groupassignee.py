from __future__ import absolute_import
import logging
import six

from collections import defaultdict

from django.conf import settings
from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, Model, sane_repr, BaseManager
from sentry.models.activity import Activity
from sentry.signals import issue_assigned
from sentry.utils import metrics


def get_user_project_ids(users):
    """
    Given a list of users, return a dict where keys are user_ids
    and values are a set of the project_ids the user is a member of
    """
    from sentry.models import OrganizationMemberTeam, ProjectTeam

    user_teams = list(
        OrganizationMemberTeam.objects.filter(
            organizationmember__user__in=users, is_active=True
        ).values("organizationmember__user", "team")
    )

    # team_id to list of projects
    projects_by_team = defaultdict(set)
    for tp in ProjectTeam.objects.filter(team__in=[ut["team"] for ut in user_teams]):
        projects_by_team[tp.team_id].add(tp.project_id)

    # user_id to projects
    projects_by_user = defaultdict(set)
    for ut in user_teams:
        projects_by_user[ut["organizationmember__user"]].update(projects_by_team[ut["team"]])

    return projects_by_user


def sync_group_assignee_inbound(integration, email, external_issue_key, assign=True):
    """
    Given an integration, user email address and an external issue key,
    assign linked groups to matching users. Checks project membership.
    Returns a list of groups that were successfully assigned.
    """
    from sentry import features
    from sentry.models import Group, UserEmail, User

    logger = logging.getLogger("sentry.integrations.%s" % integration.provider)

    orgs_with_sync_enabled = []
    for org in integration.organizations.all():
        has_issue_sync = features.has("organizations:integrations-issue-sync", org)
        if not has_issue_sync:
            continue

        installation = integration.get_installation(org.id)
        if installation.should_sync("inbound_assignee"):
            orgs_with_sync_enabled.append(org.id)

    affected_groups = list(
        Group.objects.get_groups_by_external_issue(integration, external_issue_key).filter(
            project__organization_id__in=orgs_with_sync_enabled
        )
    )

    if not affected_groups:
        return []

    if not assign:
        for group in affected_groups:
            GroupAssignee.objects.deassign(group)
        return affected_groups

    users = {
        u.id: u
        for u in User.objects.filter(
            id__in=UserEmail.objects.filter(is_verified=True, email=email).values_list(
                "user_id", flat=True
            )
        )
    }

    projects_by_user = get_user_project_ids(users.values())

    groups_assigned = []
    for group in affected_groups:
        try:
            user_id = [
                user_id
                for user_id, projects in projects_by_user.items()
                if group.project_id in projects
            ][0]
        except IndexError:
            logger.info(
                "assignee-not-found-inbound",
                extra={
                    "integration_id": integration.id,
                    "email": email,
                    "issue_key": external_issue_key,
                },
            )
        else:
            user = users[user_id]
            GroupAssignee.objects.assign(group, user)
            groups_assigned.append(group)

    return groups_assigned


def sync_group_assignee_outbound(group, user_id, assign=True):
    from sentry.tasks.integrations import sync_assignee_outbound
    from sentry.models import GroupLink

    external_issue_ids = GroupLink.objects.filter(
        project_id=group.project_id, group_id=group.id, linked_type=GroupLink.LinkedType.issue
    ).values_list("linked_id", flat=True)

    for external_issue_id in external_issue_ids:
        sync_assignee_outbound.apply_async(
            kwargs={"external_issue_id": external_issue_id, "user_id": user_id, "assign": assign}
        )


class GroupAssigneeManager(BaseManager):
    def assign(self, group, assigned_to, acting_user=None):
        from sentry import features
        from sentry.models import User, Team, GroupSubscription, GroupSubscriptionReason

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
            raise AssertionError("Invalid type to assign to: %r" % type(assigned_to))

        now = timezone.now()
        assignee, created = GroupAssignee.objects.get_or_create(
            group=group,
            defaults={"project": group.project, assignee_type: assigned_to, "date_added": now},
        )

        if not created:
            affected = (
                GroupAssignee.objects.filter(group=group)
                .exclude(**{assignee_type: assigned_to})
                .update(**{assignee_type: assigned_to, other_type: None, "date_added": now})
            )
        else:
            affected = True
            issue_assigned.send_robust(
                project=group.project, group=group, user=acting_user, sender=self.__class__
            )

        if affected:
            activity = Activity.objects.create(
                project=group.project,
                group=group,
                type=Activity.ASSIGNED,
                user=acting_user,
                data={
                    "assignee": six.text_type(assigned_to.id),
                    "assigneeEmail": getattr(assigned_to, "email", None),
                    "assigneeType": assignee_type,
                },
            )
            activity.send_notification()
            metrics.incr("group.assignee.change", instance="assigned", skip_internal=True)
            # sync Sentry assignee to external issues
            if assignee_type == "user" and features.has(
                "organizations:integrations-issue-sync", group.organization, actor=acting_user
            ):
                sync_group_assignee_outbound(group, assigned_to.id, assign=True)

    def deassign(self, group, acting_user=None):
        from sentry import features

        affected = GroupAssignee.objects.filter(group=group)[:1].count()
        GroupAssignee.objects.filter(group=group).delete()

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

    __core__ = False

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
        super(GroupAssignee, self).save(*args, **kwargs)

    def assigned_actor_id(self):
        if self.user:
            return u"user:{}".format(self.user_id)

        if self.team:
            return u"team:{}".format(self.team_id)

        raise NotImplementedError("Unknown Assignee")

    def assigned_actor(self):
        from sentry.api.fields.actor import Actor

        return Actor.from_actor_identifier(self.assigned_actor_id())
