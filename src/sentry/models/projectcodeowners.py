from __future__ import annotations

import logging

from django.db import models
from django.db.models.signals import post_delete, post_save
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from sentry.db.models import (
    DefaultFieldsModel,
    FlexibleForeignKey,
    JSONField,
    region_silo_only_model,
    sane_repr,
)
from sentry.ownership.grammar import convert_codeowners_syntax, create_schema_from_issue_owners
from sentry.utils.cache import cache

logger = logging.getLogger(__name__)
READ_CACHE_DURATION = 3600


@region_silo_only_model
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

    def update_schema(self, raw: str | None = None) -> None:
        """
        Updating the schema goes through the following steps:
        1. parsing the original codeowner file to get the associations
        2. convert the codeowner file to the ownership syntax
        3. convert the ownership syntax to the schema
        """
        from sentry.api.validators.project_codeowners import validate_codeowners_associations

        if raw and self.raw != raw:
            self.raw = raw

        if not self.raw:
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
                issue_owners=issue_owner_rules, project_id=self.project.id
            )
            # Convert IssueOwner syntax into schema syntax
            if schema:
                self.schema = schema
                self.save()
        except ValidationError:
            return


def process_resource_change(instance, change, **kwargs):
    from sentry.models import GroupOwner, ProjectOwnership

    cache.set(
        ProjectCodeOwners.get_cache_key(instance.project_id),
        None,
        READ_CACHE_DURATION,
    )
    ownership = ProjectOwnership.get_ownership_cached(instance.project_id)
    if not ownership:
        ownership = ProjectOwnership(project_id=instance.project_id)

    autoassignment_types = ProjectOwnership._get_autoassignment_types(ownership)
    GroupOwner.invalidate_autoassigned_owner_cache(instance.project_id, autoassignment_types)


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
