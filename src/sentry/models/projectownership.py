from typing import TYPE_CHECKING, Any, Mapping, Optional, Sequence, Tuple, Union

from django.db import models
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from sentry.db.models import Model, region_silo_only_model, sane_repr
from sentry.db.models.fields import FlexibleForeignKey, JSONField
from sentry.models import ActorTuple
from sentry.models.groupowner import OwnerRuleType
from sentry.ownership.grammar import Rule, load_schema, resolve_actors
from sentry.utils import metrics
from sentry.utils.cache import cache

if TYPE_CHECKING:
    from sentry.models import Team, User

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
    suspect_committer_auto_assignment = models.BooleanField(default=True)

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

        rules = cls._matching_ownership_rules(ownership, project_id, data)

        if not rules:
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
            Sequence[Union["Team", "User"]],
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

            ownership_rules = cls._matching_ownership_rules(ownership, project_id, data)
            codeowners_rules = (
                cls._matching_ownership_rules(codeowners, project_id, data) if codeowners else []
            )

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
    def handle_auto_assignment(cls, project_id, event):
        """
        Get the auto-assign owner for a project if there are any.

        We combine the schemas from IssueOwners and CodeOwners.

        """
        from sentry import analytics
        from sentry.models import ActivityIntegration, GroupAssignee, GroupOwner, GroupOwnerType

        with metrics.timer("projectownership.get_autoassign_owners"):
            ownership = cls.get_ownership_cached(project_id)
            if not ownership:
                ownership = cls(project_id=project_id)
            queue = []

            if ownership.suspect_committer_auto_assignment:
                try:
                    committer = GroupOwner.objects.filter(
                        group=event.group,
                        type=GroupOwnerType.SUSPECT_COMMIT.value,
                        project_id=project_id,
                    )
                except GroupOwner.DoesNotExist:
                    committer = []

                if len(committer) > 0:
                    queue.append(
                        (
                            committer[0].owner(),
                            {
                                "integration": ActivityIntegration.SUSPECT_COMMITTER.value,
                            },
                        )
                    )

            # Skip if we already found a Suspect Committer
            if ownership.auto_assignment and len(queue) == 0:
                ownership_rules = GroupOwner.objects.filter(
                    group=event.group,
                    type=GroupOwnerType.OWNERSHIP_RULE.value,
                    project_id=project_id,
                )
                codeowners = GroupOwner.objects.filter(
                    group=event.group,
                    type=GroupOwnerType.CODEOWNERS.value,
                    project_id=project_id,
                )

                for issue_owner in ownership_rules:
                    queue.append(
                        (
                            issue_owner.owner(),
                            {
                                "integration": ActivityIntegration.PROJECT_OWNERSHIP.value,
                                "rule": (issue_owner.context or {}).get("rule", ""),
                            },
                        )
                    )

                for issue_owner in codeowners:
                    queue.append(
                        (
                            issue_owner.owner(),
                            {
                                "integration": ActivityIntegration.CODEOWNERS.value,
                                "rule": (issue_owner.context or {}).get("rule", ""),
                            },
                        )
                    )

            try:
                owner, details = queue.pop(0)
            except IndexError:
                return

            assignment = GroupAssignee.objects.assign(
                event.group,
                owner.resolve(),
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

    @classmethod
    def _matching_ownership_rules(
        cls, ownership: "ProjectOwnership", project_id: int, data: Mapping[str, Any]
    ) -> Sequence["Rule"]:
        rules = []
        if ownership.schema is not None:
            for rule in load_schema(ownership.schema):
                if rule.test(data):
                    rules.append(rule)

        return rules


# Signals update the cached reads used in post_processing
post_save.connect(
    lambda instance, **kwargs: cache.set(
        ProjectOwnership.get_cache_key(instance.project_id), instance, READ_CACHE_DURATION
    ),
    sender=ProjectOwnership,
    weak=False,
)
post_delete.connect(
    lambda instance, **kwargs: cache.set(
        ProjectOwnership.get_cache_key(instance.project_id), False, READ_CACHE_DURATION
    ),
    sender=ProjectOwnership,
    weak=False,
)
