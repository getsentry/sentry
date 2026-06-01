import logging

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

logger = logging.getLogger(__name__)

# Provider string for the GitLab integration (distinct from the legacy
# "gitlab" plugin, which does not own these Repository rows).
GITLAB_PROVIDER = "integrations:gitlab"


def backfill_gitlab_repository_name(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    """
    GitLab Repository.name historically stored the display "name_with_namespace"
    (e.g. "Get Sentry / Example Repo"), which contains spaces and breaks generic
    code that splits name on "/" to derive owner/repo. The URL slug
    ("getsentry/example-repo") lives in config["path"]. Align name with the slug,
    matching GitHub's "owner/repo" convention.
    """
    Repository = apps.get_model("sentry", "Repository")

    skipped_missing_path = 0
    batch: list[object] = []

    for repo in RangeQuerySetWrapperWithProgressBar(
        Repository.objects.filter(provider=GITLAB_PROVIDER)
    ):
        path = (repo.config or {}).get("path")
        if not path:
            # Pre-config["path"] rows: leave untouched rather than guess.
            skipped_missing_path += 1
            continue
        if repo.name == path:
            continue
        repo.name = path
        batch.append(repo)
        if len(batch) >= 1000:
            Repository.objects.bulk_update(batch, ["name"])
            batch = []

    if batch:
        Repository.objects.bulk_update(batch, ["name"])

    if skipped_missing_path:
        logger.info(
            "gitlab_repository_name_backfill.skipped_missing_path",
            extra={"count": skipped_missing_path},
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
            backfill_gitlab_repository_name,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["sentry_repository"]},
        ),
    ]
