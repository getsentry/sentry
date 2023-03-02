import logging
from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence, Tuple, Union

from django.db import models
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from sentry import features
from sentry.db.models import Model, region_silo_only_model, sane_repr
from sentry.db.models.fields import FlexibleForeignKey, JSONField
from sentry.models import Activity, ActorTuple
from sentry.models.groupowner import OwnerRuleType
from sentry.models.project import Project
from sentry.ownership.grammar import Rule, load_schema, resolve_actors
from sentry.types.activity import ActivityType
from sentry.utils import metrics
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models import ProjectCodeOwners, Team
    from sentry.services.hybrid_cloud.user import RpcUser

logger = logging.getLogger(__name__)
READ_CACHE_DURATION = 3600


@region_silo_only_model
class ProjectOwnership(Model):
    __include_in_export__ = True

    project = FlexibleForeignKey("sentry.Project", unique=True)
    raw = models.TextField(null=True)
    schema = JSONField(null=True)
    fallthrough = models.BooleanField(default=True)
    # Auto Assignment through Ownership Rules & Code Owners
    auto_assignment = models.BooleanField(default=True)
    date_created = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    codeowners_auto_sync = models.BooleanField(default=True, null=True)
    suspect_committer_auto_assignment = models.BooleanField(default=False)

    # An object to indicate ownership is implicitly everyone
    Everyone = object()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectownership"

    __repr__ = sane_repr("project_id", "is_active")

    @classmethod
    def get_cache_key(self, project_id):
        return f"projectownership_project_id:1:{project_id}"

    @classmethod
    def get_combined_schema(self, ownership, codeowners):
        if codeowners and codeowners.schema:
            ownership.schema = (
                codeowners.schema
                if not ownership.schema
                else {
                    **ownership.schema,
                    "rules": [
                        # Since we use the last matching rule owner as the auto-assignee,
                        # we implicitly prioritize Ownership Rules over CODEOWNERS rules
                        *codeowners.schema["rules"],
                        *ownership.schema["rules"],
                    ],
                }
            )
        return ownership.schema

    @classmethod
    def get_ownership_cached(cls, project_id):
        """
        Cached read access to projectownership.

        This method implements a negative cache which saves us
        a pile of read queries in post_processing as most projects
        don't have ownership rules.

        See the post_save and post_delete signals below for additional
        cache updates.
        """
        cache_key = cls.get_cache_key(project_id)
        ownership = cache.get(cache_key)
        if ownership is None:
            try:
                ownership = cls.objects.get(project_id=project_id)
            except cls.DoesNotExist:
                ownership = False
            cache.set(cache_key, ownership, READ_CACHE_DURATION)
        return ownership or None

    @classmethod
    def get_owners(
        cls, project_id: int, data: Mapping[str, Any]
    ) -> Tuple[Union["Everyone", Sequence["ActorTuple"]], Optional[Sequence[Rule]]]:
        """
        For a given project_id, and event data blob.
        We combine the schemas from IssueOwners and CodeOwners.

        If there are no matching rules, check ProjectOwnership.fallthrough:
            If ProjectOwnership.fallthrough is enabled, return Everyone (all project members)
             - we implicitly are falling through our rules and everyone is responsible.
            If ProjectOwnership.fallthrough is disabled, return an empty list
             - there are explicitly no owners

        If there are matching rules, return the ordered actors.
            The order is determined by iterating through rules sequentially, evaluating
            CODEOWNERS (if present), followed by Ownership Rules
        """
        from sentry.models import ProjectCodeOwners

        ownership = cls.get_ownership_cached(project_id)
        if not ownership:
            ownership = cls(project_id=project_id)

        codeowners = ProjectCodeOwners.get_codeowners_cached(project_id)
        ownership.schema = cls.get_combined_schema(ownership, codeowners)

        rules = cls._matching_ownership_rules(ownership, data)

        if not rules:
            project = Project.objects.get(id=project_id)
            if features.has(
                "organizations:issue-alert-fallback-targeting", project.organization, actor=None
            ):
                return [], None

            return cls.Everyone if ownership.fallthrough else [], None

        owners = {o for rule in rules for o in rule.owners}
        owners_to_actors = resolve_actors(owners, project_id)
        ordered_actors = []
        for rule in rules:
            for o in rule.owners:
                if o in owners and owners_to_actors.get(o) is not None:
                    ordered_actors.append(owners_to_actors[o])
                    owners.remove(o)

        return ordered_actors, rules

    @classmethod
    def _hydrate_rules(cls, project_id, rules, type=OwnerRuleType.OWNERSHIP_RULE.value):
        """
        Get the last matching rule to take the most precedence.
        """
        owners = [owner for rule in rules for owner in rule.owners]
        actors = {
            key: val
            for key, val in resolve_actors({owner for owner in owners}, project_id).items()
            if val
        }
        result = [
            (
                rule,
                ActorTuple.resolve_many(
                    [actors.get(owner) for owner in rule.owners if actors.get(owner)]
                ),
                type,
            )
            for rule in rules
        ]
        return result

    @classmethod
    def get_issue_owners(
        cls, project_id, data, limit=2
    ) -> Sequence[
        Tuple[
            "Rule",
            Sequence[Union["Team", "RpcUser"]],
            Union[OwnerRuleType.OWNERSHIP_RULE.value, OwnerRuleType.CODEOWNERS.value],
        ]
    ]:
        """
        Get the issue owners for a project if there are any.

        We combine the schemas from IssueOwners and CodeOwners.

        Returns list of tuple (rule, owners, rule_type)
        """
        from sentry.models import ProjectCodeOwners

        with metrics.timer("projectownership.get_autoassign_owners"):
            ownership = cls.get_ownership_cached(project_id)
            codeowners = ProjectCodeOwners.get_codeowners_cached(project_id)
            if not (ownership or codeowners):
                return []

            if not ownership:
                ownership = cls(project_id=project_id)

            ownership_rules = cls._matching_ownership_rules(ownership, data)
            codeowners_rules = cls._matching_ownership_rules(codeowners, data) if codeowners else []

            if not (codeowners_rules or ownership_rules):
                return []

            hydrated_ownership_rules = cls._hydrate_rules(
                project_id, ownership_rules, OwnerRuleType.OWNERSHIP_RULE.value
            )
            hydrated_codeowners_rules = cls._hydrate_rules(
                project_id, codeowners_rules, OwnerRuleType.CODEOWNERS.value
            )

            rules_in_evaluation_order = [
                *hydrated_ownership_rules[::-1],
                *hydrated_codeowners_rules[::-1],
            ]
            rules_with_owners = list(
                filter(
                    lambda item: len(item[1]) > 0,
                    rules_in_evaluation_order,
                )
            )

            return rules_with_owners[:limit]

    @classmethod
    def _get_autoassignment_types(cls, ownership):
        from sentry.models import GroupOwnerType

        autoassignment_types = []
        if ownership.suspect_committer_auto_assignment:
            autoassignment_types.append(GroupOwnerType.SUSPECT_COMMIT.value)

        if ownership.auto_assignment:
            autoassignment_types.extend(
                [GroupOwnerType.OWNERSHIP_RULE.value, GroupOwnerType.CODEOWNERS.value]
            )
        return autoassignment_types

    @classmethod
    def handle_auto_assignment(cls, project_id, event):
        """
        Get the auto-assign owner for a project if there are any.

        We combine the schemas from IssueOwners and CodeOwners.

        """
        from sentry import analytics
        from sentry.models import (
            ActivityIntegration,
            GroupAssignee,
            GroupOwner,
            GroupOwnerType,
            Team,
            User,
        )

        with metrics.timer("projectownership.get_autoassign_owners"):
            ownership = cls.get_ownership_cached(project_id)
            if not ownership:
                ownership = cls(project_id=project_id)

            autoassignment_types = cls._get_autoassignment_types(ownership)
            if not len(autoassignment_types):
                return

            # Get the most recent GroupOwner that matches the following order: Suspect Committer, then Ownership Rule, then Code Owner
            issue_owner = GroupOwner.get_autoassigned_owner_cached(
                event.group.id, project_id, autoassignment_types
            )
            if issue_owner is False:
                return

            owner = issue_owner.owner()
            if not owner:
                return

            try:
                owner = owner.resolve()
            except (User.DoesNotExist, Team.DoesNotExist):
                return

            details = (
                {"integration": ActivityIntegration.SUSPECT_COMMITTER.value}
                if issue_owner.type == GroupOwnerType.SUSPECT_COMMIT.value
                else {
                    "integration": ActivityIntegration.PROJECT_OWNERSHIP.value,
                    "rule": (issue_owner.context or {}).get("rule", ""),
                }
                if issue_owner.type == GroupOwnerType.OWNERSHIP_RULE.value
                else {
                    "integration": ActivityIntegration.CODEOWNERS.value,
                    "rule": (issue_owner.context or {}).get("rule", ""),
                }
            )
            activity = Activity.objects.filter(
                group=event.group, type=ActivityType.ASSIGNED.value
            ).order_by("-datetime")
            if activity:
                auto_assigned = activity[0].data.get("integration")
                if not auto_assigned:
                    logger.info(
                        "autoassignment.post_manual_assignment",
                        extra={
                            "event_id": event.event_id,
                            "group_id": event.group_id,
                            "project": event.project_id,
                            "organization_id": event.project.organization_id,
                            **details,
                        },
                    )
                    return

            assignment = GroupAssignee.objects.assign(
                event.group,
                owner,
                create_only=True,
                extra=details,
            )

            if assignment["new_assignment"] or assignment["updated_assignment"]:
                analytics.record(
                    "codeowners.assignment"
                    if details.get("integration") == ActivityIntegration.CODEOWNERS.value
                    else "issueowners.assignment",
                    organization_id=ownership.project.organization_id,
                    project_id=project_id,
                    group_id=event.group.id,
                )
                logger.info(
                    "handle_auto_assignment.success",
                    extra={
                        "event": event.event_id,
                        "group": event.group_id,
                        "project": event.project_id,
                        "organization": event.project.organization_id,
                        # owner_id returns a string including the owner type (user or team) and id
                        "assignee": issue_owner.owner_id(),
                        "reason": "created" if assignment["new_assignment"] else "updated",
                        **details,
                    },
                )

    @classmethod
    def _matching_ownership_rules(
        cls,
        ownership: Union["ProjectOwnership", "ProjectCodeOwners"],
        data: Mapping[str, Any],
    ) -> Sequence["Rule"]:
        rules = []

        if ownership.schema is not None:
            for rule in load_schema(ownership.schema):
                if rule.test(data):
                    rules.append(rule)

        return rules


def process_resource_change(instance, change, **kwargs):
    from sentry.models import GroupOwner, ProjectOwnership

    cache.set(
        ProjectOwnership.get_cache_key(instance.project_id),
        instance if change == "updated" else None,
        READ_CACHE_DURATION,
    )
    autoassignment_types = ProjectOwnership._get_autoassignment_types(instance)
    if len(autoassignment_types) > 0:
        GroupOwner.invalidate_autoassigned_owner_cache(instance.project_id, autoassignment_types)

    GroupOwner.invalidate_debounce_issue_owners_evaluation_cache(instance.project_id)


# Signals update the cached reads used in post_processing
post_save.connect(
    lambda instance, **kwargs: process_resource_change(instance, "updated", **kwargs),
    sender=ProjectOwnership,
    weak=False,
)
post_delete.connect(
    lambda instance, **kwargs: process_resource_change(instance, "deleted", **kwargs),
    sender=ProjectOwnership,
    weak=False,
)
