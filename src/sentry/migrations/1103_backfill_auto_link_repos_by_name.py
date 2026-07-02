"""
Backfill ProjectRepository rows by matching repo name suffix to project slug.

This is a one-time backfill for the auto-link-repos-by-name feature. It
iterates all active organizations, and for each one matches unlinked repos
to unlinked projects by name. Respects the dry-run option
(repository.auto-link-by-name-dry-run) read directly from sentry_option.

Safe to re-run: uses get_or_create and skips already-linked pairs.
"""

import logging
from typing import Any

from django.db import migrations
from django.db.models import Exists, OuterRef
from django.utils.text import slugify

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

logger = logging.getLogger(__name__)

# source enum: AUTO_NAME_MATCH = 3
AUTO_NAME_MATCH = 3
ACTIVE = 0


def _get_dry_run(apps: Any) -> bool:
    Option = apps.get_model("sentry", "Option")
    try:
        opt = Option.objects.get(key="repository.auto-link-by-name-dry-run")
        return bool(opt.value)
    except Option.DoesNotExist:
        return True


def _get_repo_name_candidates(repo_name: str) -> list[str]:
    parts = [slugify(part.strip()) for part in repo_name.split("/") if part.strip()]
    parts = [p for p in parts if p]
    if not parts:
        return []
    candidates = [parts[-1]]
    if len(parts) > 1:
        candidates.append("-".join(parts))
    return candidates


def backfill_auto_link_repos(apps: Any, schema_editor: Any) -> None:
    Organization = apps.get_model("sentry", "Organization")
    Project = apps.get_model("sentry", "Project")
    Repository = apps.get_model("sentry", "Repository")
    ProjectRepository = apps.get_model("sentry", "ProjectRepository")

    dry_run = _get_dry_run(apps)
    total_matched = 0
    total_created = 0

    for org in RangeQuerySetWrapperWithProgressBar(Organization.objects.filter(status=ACTIVE)):
        repos = Repository.objects.filter(
            organization_id=org.id,
            status=ACTIVE,
        ).exclude(Exists(ProjectRepository.objects.filter(repository_id=OuterRef("id"))))
        if not repos.exists():
            continue

        unlinked_projects_by_slug = {}
        for project_id, slug in (
            Project.objects.filter(
                organization_id=org.id,
                status=ACTIVE,
            )
            .exclude(Exists(ProjectRepository.objects.filter(project_id=OuterRef("id"))))
            .values_list("id", "slug")
        ):
            unlinked_projects_by_slug[slug] = (project_id, slug)

        if not unlinked_projects_by_slug:
            continue

        for repo in repos:
            project_id = None
            project_slug = None
            for candidate in _get_repo_name_candidates(repo.name):
                if candidate in unlinked_projects_by_slug:
                    project_id, project_slug = unlinked_projects_by_slug.pop(candidate)
                    break
            if project_id is None:
                continue

            total_matched += 1

            if dry_run:
                logger.info(
                    "backfill_auto_link_repos.dry_run_match",
                    extra={
                        "organization_id": org.id,
                        "repository_id": repo.id,
                        "repository_name": repo.name,
                        "project_id": project_id,
                        "project_slug": project_slug,
                    },
                )
            else:
                _, was_created = ProjectRepository.objects.get_or_create(
                    project_id=project_id,
                    repository=repo,
                    defaults={"source": AUTO_NAME_MATCH},
                )
                if was_created:
                    total_created += 1
                    logger.info(
                        "backfill_auto_link_repos.linked",
                        extra={
                            "organization_id": org.id,
                            "repository_id": repo.id,
                            "repository_name": repo.name,
                            "project_id": project_id,
                            "project_slug": project_slug,
                        },
                    )

    if dry_run:
        logger.info(
            "backfill_auto_link_repos.dry_run_complete",
            extra={"total_matched": total_matched},
        )
    else:
        logger.info(
            "backfill_auto_link_repos.complete",
            extra={"total_matched": total_matched, "total_created": total_created},
        )


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should not be used for most operations that alter the schema
    # of a table.
    # Here are some things that make sense to mark as post deployment:
    # - Large data migrations. Typically we want these to be run manually so that they can be
    #   monitored and not block the deploy for a long period of time while they run.
    # - Adding indexes to large tables. Since this can take a long time, we'd generally prefer to
    #   run this outside deployments so that we don't block them. Note that while adding an index
    #   is a schema change, it's completely safe to run the operation after the code has deployed.
    # Once deployed, run these manually via: https://develop.sentry.dev/database-migrations/#migration-deployment

    is_post_deployment = True

    dependencies = [
        ("sentry", "1102_activity_project_type_index"),
    ]

    operations = [
        migrations.RunPython(
            backfill_auto_link_repos,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_projectrepository"]},
        ),
    ]
