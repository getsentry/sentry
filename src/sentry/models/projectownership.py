from typing import Any, Mapping, Optional, Sequence, Tuple, Union

from django.db import models
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from sentry.db.models import Model, sane_repr
from sentry.db.models.fields import FlexibleForeignKey, JSONField
from sentry.models import ActorTuple
from sentry.ownership.grammar import Rule, load_schema, resolve_actors
from sentry.utils import metrics
from sentry.utils.cache import cache

READ_CACHE_DURATION = 3600


class ProjectOwnership(Model):
    __include_in_export__ = True

    project = FlexibleForeignKey("sentry.Project", unique=True)
    raw = models.TextField(null=True)
    schema = JSONField(null=True)
    fallthrough = models.BooleanField(default=True)
    auto_assignment = models.BooleanField(default=False)
    date_created = models.DateTimeField(default=timezone.now)
    last_updated = models.DateTimeField(default=timezone.now)
    is_active = models.BooleanField(default=True)

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

        If Everyone is returned, this means we implicitly are
        falling through our rules and everyone is responsible.

        If an empty list is returned, this means there are explicitly
        no owners.
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
    def _find_actors(cls, project_id, rules, limit):
        """
        Get the last matching rule to take the most precedence.
        """
        owners = [owner for rule in rules for owner in rule.owners]
        owners.reverse()
        actors = {
            key: val
            for key, val in resolve_actors({owner for owner in owners}, project_id).items()
            if val
        }
        actors = [actors[owner] for owner in owners if owner in actors][:limit]
        return actors

    @classmethod
    def get_autoassign_owners(cls, project_id, data, limit=2):
        """
        Get the auto-assign owner for a project if there are any.

        We combine the schemas from IssueOwners and CodeOwners.

        Returns a tuple of (auto_assignment_enabled, list_of_owners, assigned_by_codeowners: boolean).
        """
        from sentry.models import ProjectCodeOwners

        with metrics.timer("projectownership.get_autoassign_owners"):
            ownership = cls.get_ownership_cached(project_id)
            codeowners = ProjectCodeOwners.get_codeowners_cached(project_id)
            assigned_by_codeowners = False
            if not (ownership or codeowners):
                return False, [], assigned_by_codeowners

            if not ownership:
                ownership = cls(project_id=project_id)

            ownership_rules = cls._matching_ownership_rules(ownership, project_id, data)
            codeowners_rules = (
                cls._matching_ownership_rules(codeowners, project_id, data) if codeowners else []
            )

            if not (codeowners_rules or ownership_rules):
                return ownership.auto_assignment, [], assigned_by_codeowners

            ownership_actors = cls._find_actors(project_id, ownership_rules, limit)
            codeowners_actors = cls._find_actors(project_id, codeowners_rules, limit)

            # Can happen if the ownership rule references a user/team that no longer
            # is assigned to the project or has been removed from the org.
            if not (ownership_actors or codeowners_actors):
                return ownership.auto_assignment, [], assigned_by_codeowners

            # Ownership rules take precedence over codeowner rules.
            actors = [*ownership_actors, *codeowners_actors][:limit]

            # Only the first item in the list is used for assignment, the rest are just used to suggest suspect owners.
            # So if ownership_actors is empty, it will be assigned by codeowners_actors
            if len(ownership_actors) == 0:
                assigned_by_codeowners = True

            from sentry.models import ActorTuple

            return (
                ownership.auto_assignment,
                ActorTuple.resolve_many(actors),
                assigned_by_codeowners,
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
