import logging

from django.db import models
from django.db.models import Subquery
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, JSONField, sane_repr
from sentry.ownership.grammar import convert_codeowners_syntax, create_schema_from_issue_owners
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)
READ_CACHE_DURATION = 3600


class ProjectCodeOwners(DefaultFieldsModel):
    __include_in_export__ = False
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
        return f"projectcodeowners_project_id:1:{project_id}"

    @classmethod
    def get_codeowners_cached(self, project_id):
        """
        Cached read access to sentry_projectcodeowners.

        This method implements a negative cache which saves us
        a pile of read queries in post_processing as most projects
        don't have CODEOWNERS.
        """
        cache_key = self.get_cache_key(project_id)
        code_owners = cache.get(cache_key)
        if code_owners is None:
            query = self.objects.filter(project_id=project_id).order_by("-date_added") or False
            code_owners = self.merge_code_owners_list(code_owners_list=query) if query else query
            cache.set(cache_key, code_owners, READ_CACHE_DURATION)

        return code_owners or None

    @classmethod
    def validate_codeowners_associations(self, codeowners, project):
        from sentry.api.endpoints.project_codeowners import validate_association
        from sentry.models import (
            ExternalActor,
            OrganizationMember,
            OrganizationMemberTeam,
            Project,
            UserEmail,
            actor_type_to_string,
        )
        from sentry.ownership.grammar import parse_code_owners
        from sentry.types.integrations import ExternalProviders

        # Get list of team/user names from CODEOWNERS file
        team_names, usernames, emails = parse_code_owners(codeowners)

        # Check if there exists Sentry users with the emails listed in CODEOWNERS
        user_emails = UserEmail.objects.filter(
            email__in=emails,
            user__sentry_orgmember_set__organization=project.organization,
        )

        # Check if the usernames/teamnames have an association
        external_actors = ExternalActor.objects.filter(
            external_name__in=usernames + team_names,
            organization=project.organization,
            provider__in=[ExternalProviders.GITHUB.value, ExternalProviders.GITLAB.value],
        )

        # Convert CODEOWNERS into IssueOwner syntax
        users_dict = {}
        teams_dict = {}
        teams_without_access = []
        users_without_access = []
        for external_actor in external_actors:
            type = actor_type_to_string(external_actor.actor.type)
            if type == "user":
                user = external_actor.actor.resolve()
                organization_members_ids = OrganizationMember.objects.filter(
                    user_id=user.id, organization_id=project.organization_id
                ).values_list("id", flat=True)
                team_ids = OrganizationMemberTeam.objects.filter(
                    organizationmember_id__in=Subquery(organization_members_ids)
                ).values_list("team_id", flat=True)
                projects = Project.objects.get_for_team_ids(Subquery(team_ids))

                if project in projects:
                    users_dict[external_actor.external_name] = user.email
                else:
                    users_without_access.append(f"{user.get_display_name()}")
            elif type == "team":
                team = external_actor.actor.resolve()
                # make sure the sentry team has access to the project
                # tied to the codeowner
                if project in team.get_projects():
                    teams_dict[external_actor.external_name] = f"#{team.slug}"
                else:
                    teams_without_access.append(f"#{team.slug}")

        emails_dict = {item.email: item.email for item in user_emails}
        associations = {**users_dict, **teams_dict, **emails_dict}

        errors = {
            "missing_user_emails": validate_association(emails, user_emails, "emails"),
            "missing_external_users": validate_association(usernames, external_actors, "usernames"),
            "missing_external_teams": validate_association(
                team_names, external_actors, "team names"
            ),
            "teams_without_access": teams_without_access,
            "users_without_access": users_without_access,
        }
        return associations, errors

    @classmethod
    def merge_code_owners_list(self, code_owners_list):
        """
        Merge list of code_owners into a single code_owners object concatenating
        all the rules. We assume schema version is constant.
        """
        merged_code_owners = None
        for code_owners in code_owners_list:
            if code_owners.schema:
                if merged_code_owners is None:
                    merged_code_owners = code_owners
                    continue
                merged_code_owners.schema["rules"] = [
                    *merged_code_owners.schema["rules"],
                    *code_owners.schema["rules"],
                ]

        return merged_code_owners

    def update_schema(self):
        """
        Updating the schema goes through the following steps:
        1. parsing the original codeowner file to get the associations
        2. convert the codeowner file to the ownership syntax
        3. convert the ownership syntax to the schema
        """
        associations, _ = self.validate_codeowners_associations(self.raw, self.project)

        issue_owner_rules = convert_codeowners_syntax(
            codeowners=self.raw,
            associations=associations,
            code_mapping=self.repository_project_path_config,
        )

        # Convert IssueOwner syntax into schema syntax
        try:
            schema = create_schema_from_issue_owners(
                issue_owners=issue_owner_rules, project_id=self.project.id
            )
            # Convert IssueOwner syntax into schema syntax
            if schema:
                self.schema = schema
                self.save()
        except ValidationError:
            return
