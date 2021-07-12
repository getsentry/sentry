import logging

from django.db import models
from django.utils import timezone

from sentry.db.models import DefaultFieldsModel, FlexibleForeignKey, JSONField, sane_repr
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
        codeowners = cache.get(cache_key)
        if codeowners is None:
            try:
                codeowners = self.objects.get(project_id=project_id)
            except self.DoesNotExist:
                codeowners = False
            cache.set(cache_key, codeowners, READ_CACHE_DURATION)
        return codeowners or None

    @classmethod
    def validate_codeowners_associations(self, attrs, project):
        from sentry.api.endpoints.project_codeowners import validate_association
        from sentry.models import ExternalActor, UserEmail, actor_type_to_string
        from sentry.ownership.grammar import parse_code_owners

        # Get list of team/user names from CODEOWNERS file
        team_names, usernames, emails = parse_code_owners(attrs["raw"])

        # Check if there exists Sentry users with the emails listed in CODEOWNERS
        user_emails = UserEmail.objects.filter(
            email__in=emails,
            user__sentry_orgmember_set__organization=project.organization,
        )

        # Check if the usernames/teamnames have an association
        external_actors = ExternalActor.objects.filter(
            external_name__in=usernames + team_names,
            organization=project.organization,
        )

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

        emails_dict = {item.email: item.email for item in user_emails}
        associations = {**users_dict, **teams_dict, **emails_dict}

        errors = {
            "missing_user_emails": validate_association(emails, user_emails, "emails"),
            "missing_external_users": validate_association(usernames, external_actors, "usernames"),
            "missing_external_teams": validate_association(
                team_names, external_actors, "team names"
            ),
            "teams_without_access": teams_without_access,
        }
        return associations, errors
