from __future__ import annotations

import enum
import logging
from collections.abc import Mapping, Sequence
from typing import TYPE_CHECKING, Any

import sentry_sdk
from django.db import models
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from sentry import options  # noqa
from sentry.backup.scopes import RelocationScope
from sentry.db.models import Model, region_silo_model, sane_repr
from sentry.db.models.fields import FlexibleForeignKey, JSONField
from sentry.eventstore.models import Event, GroupEvent
from sentry.issues.ownership.grammar import Matcher, Rule, load_schema, resolve_actors
from sentry.models.activity import Activity
from sentry.models.group import Group
from sentry.models.groupowner import OwnerRuleType
from sentry.types.activity import ActivityType
from sentry.types.actor import Actor
from sentry.utils import metrics
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models.projectcodeowners import ProjectCodeOwners
    from sentry.models.team import Team
    from sentry.users.services.user import RpcUser

logger = logging.getLogger(__name__)
READ_CACHE_DURATION = 3600


_Everyone = enum.Enum("_Everyone", "EVERYONE")


@region_silo_model
class ProjectOwnership(Model):
    __relocation_scope__ = RelocationScope.Organization

    project = FlexibleForeignKey("sentry.Project", unique=True)
    raw = models.TextField(null=True)
    schema: models.Field[dict[str, Any] | None, dict[str, Any] | None] = JSONField(null=True)
    fallthrough = models.BooleanField(default=True)
    # Auto Assignment through Ownership Rules & Code Owners
    auto_assignment = models.BooleanField(default=True)
    date_created = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)
    codeowners_auto_sync = models.BooleanField(default=True, null=True)
    suspect_committer_auto_assignment = models.BooleanField(default=False)

    # An object to indicate ownership is implicitly everyone
    Everyone = _Everyone.EVERYONE

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectownership"

    __repr__ = sane_repr("project_id", "is_active")

    @classmethod
    def get_cache_key(self, project_id) -> str:
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
    ) -> tuple[_Everyone | list[Actor], Sequence[Rule] | None]:
        """
        For a given project_id, and event data blob.
        We combine the schemas from IssueOwners and CodeOwners.

        If there are no matching rules, return an empty list, and None for the rule.

        If there are matching rules, return the ordered actors.
            The order is determined by iterating through rules sequentially, evaluating
            CODEOWNERS (if present), followed by Ownership Rules
        """
        from sentry.models.projectcodeowners import ProjectCodeOwners

        ownership = cls.get_ownership_cached(project_id)
        if not ownership:
            ownership = cls(project_id=project_id)

        codeowners = ProjectCodeOwners.get_codeowners_cached(project_id)
        ownership.schema = cls.get_combined_schema(ownership, codeowners)

        rules = cls._matching_ownership_rules(ownership, data)

        if not rules:
            return [], None

        owners = {o for rule in rules for o in rule.owners}
        owners_to_actors = resolve_actors(owners, project_id)
        ordered_actors: list[Actor] = []
        for rule in rules:
            for o in rule.owners:
                if o in owners:
                    actor = owners_to_actors.get(o)
                    if actor is not None:
                        ordered_actors.append(actor)
                        owners.remove(o)

        return ordered_actors, rules

    @classmethod
    def _hydrate_rules(
        cls, project_id: int, rules: Sequence[Rule], type: str = OwnerRuleType.OWNERSHIP_RULE.value
    ):
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
                Actor.resolve_many([actors[owner] for owner in rule.owners if owner in actors]),
                type,
            )
            for rule in rules
        ]
        return result

    @classmethod
    @metrics.wraps("projectownership.get_issue_owners")
    @sentry_sdk.trace
    def get_issue_owners(
        cls, project_id: int, data: Mapping[str, Any], limit: int = 2
    ) -> Sequence[tuple[Rule, Sequence[Team | RpcUser], str]]:
        """
        Get the issue owners for a project if there are any.

        We combine the schemas from IssueOwners and CodeOwners.

        Returns list of tuple (rule, owners, rule_type)
        """
        from sentry.models.projectcodeowners import ProjectCodeOwners

        ownership = cls.get_ownership_cached(project_id)
        codeowners = ProjectCodeOwners.get_codeowners_cached(project_id)
        if not (ownership or codeowners):
            return []

        if not ownership:
            ownership = cls(project_id=project_id)

        # rules_with_owners is ordered by priority, descending, see also:
        # https://docs.sentry.io/product/issues/ownership-rules/#evaluation-flow
        rules_with_owners = []

        with metrics.timer("projectownership.get_issue_owners_ownership_rules"):
            ownership_rules = list(reversed(cls._matching_ownership_rules(ownership, data)))
            hydrated_ownership_rules = cls._hydrate_rules(
                project_id, ownership_rules, OwnerRuleType.OWNERSHIP_RULE.value
            )
            for item in hydrated_ownership_rules:
                if item[1]:  # actors
                    rules_with_owners.append(item)
                    if len(rules_with_owners) == limit:
                        return rules_with_owners

        if not codeowners:
            return rules_with_owners

        with metrics.timer("projectownership.get_issue_owners_codeowners_rules"):
            codeowners_rules = list(reversed(cls._matching_ownership_rules(codeowners, data)))
            hydrated_codeowners_rules = cls._hydrate_rules(
                project_id, codeowners_rules, OwnerRuleType.CODEOWNERS.value
            )
            for item in hydrated_codeowners_rules:
                if item[1]:  # actors
                    rules_with_owners.append(item)
                    if len(rules_with_owners) == limit:
                        return rules_with_owners

        return rules_with_owners

    @classmethod
    def _get_autoassignment_types(cls, ownership):
        from sentry.models.groupowner import GroupOwnerType

        autoassignment_types = []
        if ownership.suspect_committer_auto_assignment:
            autoassignment_types.append(GroupOwnerType.SUSPECT_COMMIT.value)

        if ownership.auto_assignment:
            autoassignment_types.extend(
                [GroupOwnerType.OWNERSHIP_RULE.value, GroupOwnerType.CODEOWNERS.value]
            )
        return autoassignment_types

    @classmethod
    def handle_auto_assignment(
        cls,
        project_id: int,
        event: Event | GroupEvent | None = None,
        group: Group | None = None,
        organization_id: int | None = None,
        force_autoassign: bool = False,
        logging_extra: dict[str, str | bool | int] | None = None,
    ) -> None:
        """
        Get the auto-assign owner for a project if there are any.
        We combine the schemas from IssueOwners and CodeOwners.

        If `force_autoassign` is set to True, auto-assignment will occur even if manual assignment
        has already taken place, but only if auto-assignment is enabled for the project.
        """
        from sentry import analytics
        from sentry.models.activity import ActivityIntegration
        from sentry.models.groupassignee import GroupAssignee
        from sentry.models.groupowner import GroupOwner, GroupOwnerType
        from sentry.models.team import Team
        from sentry.users.models.user import User
        from sentry.users.services.user import RpcUser

        if logging_extra is None:
            logging_extra = {}

        if group is None and event is not None:
            group = event.group

        if group is None:
            return

        with metrics.timer("projectownership.get_autoassign_owners"):

            ownership = cls.get_ownership_cached(project_id)
            if not ownership:
                ownership = cls(project_id=project_id)
            logging_extra["ownership"] = ownership

            autoassignment_types = cls._get_autoassignment_types(ownership)
            if not len(autoassignment_types):
                return
            logging_extra["autoassignment_types"] = autoassignment_types

            # Get the most recent GroupOwner that matches the following order: Suspect Committer, then Ownership Rule, then Code Owner
            issue_owner = GroupOwner.get_autoassigned_owner(
                group.id, project_id, autoassignment_types
            )

            if issue_owner is False:
                return
            logging_extra["issue_owner"] = issue_owner

            owner = issue_owner.owner()
            if not owner:
                return

            logging_extra["owner"] = owner
            try:
                owner = owner.resolve()
            except (User.DoesNotExist, Team.DoesNotExist):
                logger.info("handle_auto_assignment.no_resolved_owner", extra=logging_extra)
                return
            logging_extra["resolved_owner"] = owner

            activity_details = {}
            if issue_owner.type == GroupOwnerType.SUSPECT_COMMIT.value:
                activity_details["integration"] = ActivityIntegration.SUSPECT_COMMITTER.value
            elif issue_owner.type == GroupOwnerType.OWNERSHIP_RULE.value:
                activity_details["integration"] = ActivityIntegration.PROJECT_OWNERSHIP.value
                activity_details["rule"] = (issue_owner.context or {}).get("rule", "")
            else:
                activity_details["integration"] = ActivityIntegration.CODEOWNERS.value
                activity_details["rule"] = (issue_owner.context or {}).get("rule", "")

            logging_extra = {**logging_extra, **activity_details}

            activity = Activity.objects.filter(
                group=group, type=ActivityType.ASSIGNED.value
            ).order_by("-datetime")
            if activity:
                auto_assigned = activity[0].data.get("integration")
                if not auto_assigned and not force_autoassign:
                    return

            if not isinstance(owner, Team) and not isinstance(owner, RpcUser):
                logging_extra["owner_type"] = str(type(owner))
                logger.info("handle_auto_assignment.unknown_owner_type", extra=logging_extra)
                return

            if (
                isinstance(owner, Team)
                and GroupAssignee.objects.filter(group=group, team=owner.id).exists()
            ):
                return

            if (
                isinstance(owner, RpcUser)
                and GroupAssignee.objects.filter(group=group, user_id=owner.id).exists()
            ):
                return

            assignment = GroupAssignee.objects.assign(
                group,
                owner,
                create_only=not force_autoassign,
                extra=activity_details,
                force_autoassign=force_autoassign,
            )

            if assignment["new_assignment"] or assignment["updated_assignment"]:
                analytics.record(
                    (
                        "codeowners.assignment"
                        if activity_details.get("integration")
                        == ActivityIntegration.CODEOWNERS.value
                        else "issueowners.assignment"
                    ),
                    organization_id=organization_id or ownership.project.organization_id,
                    project_id=project_id,
                    group_id=group.id,
                    updated_assignment=assignment["updated_assignment"],
                )

    @classmethod
    def _matching_ownership_rules(
        cls,
        ownership: ProjectOwnership | ProjectCodeOwners,
        data: Mapping[str, Any],
    ) -> list[Rule]:
        if ownership.schema is None:
            return []

        # "projectownership" or "projectcodeowners"
        ownership_type = type(ownership).__name__.lower()

        munged_data = Matcher.munge_if_needed(data)
        metrics.distribution(
            key="projectownership.matching_ownership_rules.frames",
            value=len(munged_data[0]),
            tags={"ownership_type": ownership_type},
        )

        rules = load_schema(ownership.schema)
        metrics.distribution(
            key="projectownership.matching_ownership_rules.rules",
            value=len(rules),
            tags={"ownership_type": ownership_type},
        )

        return [rule for rule in rules if rule.test(data, munged_data)]


def process_resource_change(instance, change, **kwargs):
    from sentry.models.groupowner import GroupOwner
    from sentry.models.projectownership import ProjectOwnership

    cache.set(
        ProjectOwnership.get_cache_key(instance.project_id),
        instance if change == "updated" else None,
        READ_CACHE_DURATION,
    )
    GroupOwner.invalidate_assignee_exists_cache(instance.project.id)
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
