import operator


from django.db import models
from django.db.models import Q
from django.db.models.signals import post_delete, post_save
from django.utils import timezone

from sentry.db.models import Model, sane_repr
from sentry.db.models.fields import FlexibleForeignKey, JSONField
from sentry.ownership.grammar import load_schema
from sentry.utils import metrics
from sentry.utils.cache import cache
from functools import reduce

READ_CACHE_DURATION = 3600


class ProjectOwnership(Model):
    __core__ = True

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
    def get_owners(cls, project_id, data):
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
    def get_autoassign_owners(cls, project_id, data, limit=2):
        """
        Get the auto-assign owner for a project if there are any.

        We combine the schemas from IssueOwners and CodeOwners.

        Returns a tuple of (auto_assignment_enabled, list_of_owners).
        """
        from sentry.models import ProjectCodeOwners

        with metrics.timer("projectownership.get_autoassign_owners"):
            ownership = cls.get_ownership_cached(project_id)
            codeowners = ProjectCodeOwners.get_codeowners_cached(project_id)

            if not (ownership or codeowners):
                return False, []

            if not ownership:
                ownership = cls(project_id=project_id)

            ownership.schema = cls.get_combined_schema(ownership, codeowners)

            rules = cls._matching_ownership_rules(ownership, project_id, data)
            if not rules:
                return ownership.auto_assignment, []

            # We want the last matching rule to take the most precedence.
            owners = [owner for rule in rules for owner in rule.owners]
            owners.reverse()
            actors = {
                key: val
                for key, val in resolve_actors({owner for owner in owners}, project_id).items()
                if val
            }
            actors = [actors[owner] for owner in owners if owner in actors][:limit]

            # Can happen if the ownership rule references a user/team that no longer
            # is assigned to the project or has been removed from the org.
            if not actors:
                return ownership.auto_assignment, []

            from sentry.models import ActorTuple

            return ownership.auto_assignment, ActorTuple.resolve_many(actors)

    @classmethod
    def _matching_ownership_rules(cls, ownership, project_id, data):
        rules = []
        if ownership.schema is not None:
            for rule in load_schema(ownership.schema):
                if rule.test(data):
                    rules.append(rule)

        return rules


def resolve_actors(owners, project_id):
    """Convert a list of Owner objects into a dictionary
    of {Owner: Actor} pairs. Actors not identified are returned
    as None."""
    from sentry.models import ActorTuple
    from sentry.models import User, Team

    if not owners:
        return {}

    users, teams = [], []
    owners_lookup = {}

    for owner in owners:
        # teams aren't technical case insensitive, but teams also
        # aren't allowed to have non-lowercase in slugs, so
        # this kinda works itself out correctly since they won't match
        owners_lookup[(owner.type, owner.identifier.lower())] = owner
        if owner.type == "user":
            users.append(owner)
        elif owner.type == "team":
            teams.append(owner)

    actors = {}
    if users:
        actors.update(
            {
                ("user", email.lower()): ActorTuple(u_id, User)
                for u_id, email in User.objects.filter(
                    reduce(operator.or_, [Q(emails__email__iexact=o.identifier) for o in users]),
                    # We don't require verified emails
                    # emails__is_verified=True,
                    is_active=True,
                    sentry_orgmember_set__organizationmemberteam__team__projectteam__project_id=project_id,
                )
                .distinct()
                .values_list("id", "emails__email")
            }
        )

    if teams:
        actors.update(
            {
                ("team", slug): ActorTuple(t_id, Team)
                for t_id, slug in Team.objects.filter(
                    slug__in=[o.identifier for o in teams], projectteam__project_id=project_id
                ).values_list("id", "slug")
            }
        )

    return {o: actors.get((o.type, o.identifier.lower())) for o in owners}


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
