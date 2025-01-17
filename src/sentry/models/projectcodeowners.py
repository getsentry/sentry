from __future__ import annotations

import logging
from collections.abc import Iterable

from django.db import models
from django.db.models.signals import post_delete, post_save, pre_save
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from sentry import analytics
from sentry.backup.scopes import RelocationScope
from sentry.db.models import FlexibleForeignKey, JSONField, Model, region_silo_model, sane_repr
from sentry.issues.ownership.grammar import (
    convert_codeowners_syntax,
    create_schema_from_issue_owners,
)
from sentry.models.organization import Organization
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)
READ_CACHE_DURATION = 3600


@region_silo_model
class ProjectCodeOwners(Model):

    __relocation_scope__ = RelocationScope.Excluded
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
    date_updated = models.DateTimeField(default=timezone.now)
    date_added = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = "sentry"
        db_table = "sentry_projectcodeowners"

    __repr__ = sane_repr("project_id", "id")

    @classmethod
    def get_cache_key(self, project_id: int) -> str:
        return f"projectcodeowners_project_id:1:{project_id}"

    @classmethod
    def get_codeowners_cached(self, project_id: int) -> ProjectCodeOwners | None:
        """
        Cached read access to sentry_projectcodeowners.

        This method implements a negative cache which saves us
        a pile of read queries in post_processing as most projects
        don't have CODEOWNERS.
        """
        cache_key = self.get_cache_key(project_id)
        code_owners = cache.get(cache_key)
        if code_owners is None:
            query = self.objects.filter(project_id=project_id).order_by("-date_added") or ()
            code_owners = self.merge_code_owners_list(code_owners_list=query) if query else query
            cache.set(cache_key, code_owners, READ_CACHE_DURATION)

        return code_owners or None

    @classmethod
    def merge_code_owners_list(
        self, code_owners_list: Iterable[ProjectCodeOwners]
    ) -> ProjectCodeOwners | None:
        """
        Merge list of code_owners into a single code_owners object concatenating
        all the rules. We assume schema version is constant.
        """
        merged_code_owners: ProjectCodeOwners | None = None
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

    def update_schema(self, organization: Organization, raw: str | None = None) -> None:
        """
        Updating the schema goes through the following steps:
        1. parsing the original codeowner file to get the associations
        2. convert the codeowner file to the ownership syntax
        3. convert the ownership syntax to the schema
        """
        from sentry.api.validators.project_codeowners import validate_codeowners_associations
        from sentry.utils.codeowners import MAX_RAW_LENGTH

        if raw and self.raw != raw:
            self.raw = raw

        if not self.raw:
            return

        if len(self.raw) > MAX_RAW_LENGTH:
            analytics.record(
                "codeowners.max_length_exceeded",
                organization_id=organization.id,
            )
            logger.warning({"raw": f"Raw needs to be <= {MAX_RAW_LENGTH} characters in length"})
            return

        associations, _ = validate_codeowners_associations(self.raw, self.project)

        issue_owner_rules = convert_codeowners_syntax(
            codeowners=self.raw,
            associations=associations,
            code_mapping=self.repository_project_path_config,
        )

        # Convert IssueOwner syntax into schema syntax
        try:
            schema = create_schema_from_issue_owners(
                project_id=self.project.id, issue_owners=issue_owner_rules
            )
            # Convert IssueOwner syntax into schema syntax
            if schema:
                self.schema = schema
                self.save()
        except ValidationError:
            return


def modify_date_updated(instance, **kwargs):
    if instance.id is None:
        return
    instance.date_updated = timezone.now()


def process_resource_change(instance, change, **kwargs):
    from sentry.models.groupowner import GroupOwner
    from sentry.models.projectownership import ProjectOwnership

    cache.set(
        ProjectCodeOwners.get_cache_key(instance.project_id),
        None,
        READ_CACHE_DURATION,
    )
    ownership = ProjectOwnership.get_ownership_cached(instance.project_id)
    if not ownership:
        ownership = ProjectOwnership(project_id=instance.project_id)

    GroupOwner.invalidate_debounce_issue_owners_evaluation_cache(instance.project_id)


pre_save.connect(
    modify_date_updated,
    sender=ProjectCodeOwners,
    dispatch_uid="projectcodeowners_modify_date_updated",
    weak=False,
)
# Signals update the cached reads used in post_processing
post_save.connect(
    lambda instance, **kwargs: process_resource_change(instance, "updated", **kwargs),
    sender=ProjectCodeOwners,
    weak=False,
)
post_delete.connect(
    lambda instance, **kwargs: process_resource_change(instance, "deleted", **kwargs),
    sender=ProjectCodeOwners,
    weak=False,
)
