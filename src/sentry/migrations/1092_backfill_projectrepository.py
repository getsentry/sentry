from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

# Mirror of ProjectRepositorySource values — we can't import the model
# in a migration because the code may change after the migration is written.
SOURCE_MANUAL = 0
SOURCE_AUTO_EVENT = 2
SOURCE_SEER_PREFERENCE = 4

# Lower number = higher priority. Used to pick the best source when
# a (project, repo) pair appears in multiple tables.
SOURCE_PRIORITY = {
    SOURCE_SEER_PREFERENCE: 0,
    SOURCE_MANUAL: 1,
    SOURCE_AUTO_EVENT: 2,
}


def backfill_project_repository(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    ProjectRepository = apps.get_model("sentry", "ProjectRepository")
    RepositoryProjectPathConfig = apps.get_model("sentry", "RepositoryProjectPathConfig")
    SeerProjectRepository = apps.get_model("seer", "SeerProjectRepository")

    # Step 1: Collect all unique (project_id, repository_id) pairs and pick
    # the best source for each.
    #
    # Priority: SEER_PREFERENCE (user explicitly picked repos for Seer)
    # > MANUAL (user-created code mapping) > AUTO_EVENT (auto-generated).

    pair_to_source: dict[tuple[int, int], int] = {}

    def _set_if_higher_priority(key: tuple[int, int], new_source: int) -> None:
        existing = pair_to_source.get(key)
        if existing is None or SOURCE_PRIORITY[new_source] < SOURCE_PRIORITY[existing]:
            pair_to_source[key] = new_source

    for row in RangeQuerySetWrapperWithProgressBar(
        RepositoryProjectPathConfig.objects.values_list(
            "id", "project_id", "repository_id", "automatically_generated"
        ),
        result_value_getter=lambda values: values[0],
    ):
        _id, project_id, repository_id, automatically_generated = row
        new_source = SOURCE_AUTO_EVENT if automatically_generated else SOURCE_MANUAL
        _set_if_higher_priority((project_id, repository_id), new_source)

    for row in RangeQuerySetWrapperWithProgressBar(
        SeerProjectRepository.objects.values_list("id", "project_id", "repository_id"),
        result_value_getter=lambda values: values[0],
    ):
        _id, project_id, repository_id = row
        _set_if_higher_priority((project_id, repository_id), SOURCE_SEER_PREFERENCE)

    existing_pairs = set(ProjectRepository.objects.values_list("project_id", "repository_id"))

    batch: list[object] = []
    for (project_id, repository_id), source in pair_to_source.items():
        if (project_id, repository_id) in existing_pairs:
            continue
        batch.append(
            ProjectRepository(project_id=project_id, repository_id=repository_id, source=source)
        )
        if len(batch) >= 1000:
            ProjectRepository.objects.bulk_create(batch, ignore_conflicts=True)
            batch = []
    if batch:
        ProjectRepository.objects.bulk_create(batch, ignore_conflicts=True)

    pr_lookup: dict[tuple[int, int], int] = {}
    for pr_id, project_id, repository_id in ProjectRepository.objects.values_list(
        "id", "project_id", "repository_id"
    ):
        pr_lookup[(project_id, repository_id)] = pr_id

    for config in RangeQuerySetWrapperWithProgressBar(
        RepositoryProjectPathConfig.objects.filter(project_repository_id__isnull=True)
    ):
        pr_id = pr_lookup.get((config.project_id, config.repository_id))
        if pr_id is not None:
            RepositoryProjectPathConfig.objects.filter(id=config.id).update(
                project_repository_id=pr_id
            )

    for spr in RangeQuerySetWrapperWithProgressBar(
        SeerProjectRepository.objects.filter(project_repository_id__isnull=True)
    ):
        pr_id = pr_lookup.get((spr.project_id, spr.repository_id))
        if pr_id is not None:
            spr.project_repository_id = pr_id
            spr.save(update_fields=["project_repository_id"])


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
        ("sentry", "1091_delete_triggered_incidents_alertruletrigger"),
        ("seer", "0011_add_project_repository_fk_to_seer"),
    ]

    operations = [
        migrations.RunPython(
            backfill_project_repository,
            reverse_code=migrations.RunPython.noop,
            hints={
                "tables": [
                    "sentry_projectrepository",
                    "sentry_repositoryprojectpathconfig",
                    "seer_projectrepository",
                ]
            },
        ),
    ]
