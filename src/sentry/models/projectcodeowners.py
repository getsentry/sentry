import logging

from django.db import models
from django.utils import timezone

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, JSONField, sane_repr
from sentry.models import actor_type_to_string
from sentry.models.externalactor import ExternalActor
from sentry.models.projectownership import resolve_actors
from sentry.ownership.grammar import (
    ParseError,
    convert_codeowners_syntax,
    dump_schema,
    parse_code_owners,
    parse_rules,
)
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)
READ_CACHE_DURATION = 3600


class ProjectCodeOwners(DefaultFieldsModel):
    __core__ = False
    # no db constraint to prevent locks on the Project table
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    # repository_project_path_config ⇒ use this to transform CODEOWNERS paths to stacktrace paths
    repository_project_path_config = FlexibleForeignKey(
        "sentry.RepositoryProjectPathConfig", unique=True, on_delete=models.PROTECT
    )
    # raw ⇒ original CODEOWNERS file.
    raw = models.TextField(null=True)
    # schema ⇒ transformed into IssueOwner syntax
    schema = JSONField(null=True)
    # override date_added from DefaultFieldsModel
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectcodeowners"

    __repr__ = sane_repr("project_id", "id")

    @classmethod
    def get_cache_key(self, project_id):
        return f"projectcodewoners_project_id:1:{project_id}"

    @classmethod
    def get_codeowners_cached(self, project_id):
        """
        Cached read access to sentry_projectcodeowners.

        This method implements a negative cache which saves us
        a pile of read queries in post_processing as most projects
        don't have CODEOWNERS.
        """
        cache_key = self.get_cache_key(project_id)
        codeowners = cache.get(cache_key)
        if codeowners is None:
            try:
                codeowners = self.objects.get(project_id=project_id)
            except self.DoesNotExist:
                codeowners = False
            cache.set(cache_key, codeowners, READ_CACHE_DURATION)
        return codeowners or None

    def update_schema(
        self,
    ):
        """
        Updating the schema goes through the following steps:

        1. parsing the original codeowner file to get the external
           teams, usernames, and emails
        2. find the external actors for any usernames or team names
        3. convert the codeowner file to the ownership syntax
        4. convert the ownership syntax to the schema syntax

        """

        team_names, usernames, emails = parse_code_owners(self.raw)
        external_actors = ExternalActor.objects.filter(
            external_name__in=usernames + team_names,
            organization=self.project.organization,
        )

        # Convert CODEOWNERS into IssueOwner syntax
        issue_owner_rules, _ = codeowners_to_ownership_syntax(
            self.raw, self.repository_project_path_config, self.project, external_actors, emails
        )

        # Convert IssueOwner syntax into schema syntax
        schema = self.issue_syntax_to_schema(issue_owner_rules)
        if schema:
            self.schema = schema
            self.save()

    def issue_syntax_to_schema(self, raw):
        """
        Converts ownership syntax to the schema.
        Duplicate code from ProjectOwnershipSerializer

        Returns None if we run into parsing errors
        or bad actors.
        """
        raw.strip()
        try:
            rules = parse_rules(raw)
        except ParseError:
            return

        schema = dump_schema(rules)

        owners = {o for rule in rules for o in rule.owners}
        actors = resolve_actors(owners, self.project_id)

        bad_actors = []
        for owner, actor in actors.items():
            if actor is None:
                if owner.type == "user":
                    bad_actors.append(owner.identifier)
                elif owner.type == "team":
                    bad_actors.append(f"#{owner.identifier}")

        if bad_actors:
            bad_actors.sort()
            return

        return schema


def codeowners_to_ownership_syntax(
    raw_codeowners,
    code_mapping,
    project,
    external_actors,
    emails,
):
    # Convert CODEOWNERS into IssueOwner syntax
    users_dict = {}
    teams_dict = {}
    teams_without_access = []
    for external_actor in external_actors:
        type = actor_type_to_string(external_actor.actor.type)
        if type == "user":
            user = external_actor.actor.resolve()
            users_dict[external_actor.external_name] = user.email
        elif type == "team":
            team = external_actor.actor.resolve()
            # make sure the sentry team has access to the project
            # tied to the codeowner
            if project in team.get_projects():
                teams_dict[external_actor.external_name] = f"#{team.slug}"
            else:
                teams_without_access.append(f"#{team.slug}")

    emails_dict = {email: email for email in emails}
    associations = {**users_dict, **teams_dict, **emails_dict}

    # returns issue owner syntax
    issue_syntax = convert_codeowners_syntax(raw_codeowners, associations, code_mapping)
    return (issue_syntax, teams_without_access)
