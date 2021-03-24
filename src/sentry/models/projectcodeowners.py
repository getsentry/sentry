import logging

from django.db import models
from django.utils import timezone

from sentry.db.models import FlexibleForeignKey, DefaultFieldsModel, JSONField, sane_repr
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)
READ_CACHE_DURATION = 3600


class ProjectCodeOwners(DefaultFieldsModel):
    __core__ = False
    # no db constraint to prevent locks on the Project table
    project = FlexibleForeignKey("sentry.Project", db_constraint=False)
    # repository_project_path_config ⇒ use this to transform CODEOWNERS paths to stacktrace paths
    repository_project_path_config = FlexibleForeignKey(
        "sentry.RepositoryProjectPathConfig", on_delete=models.PROTECT
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
