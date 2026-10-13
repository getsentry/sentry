from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps
from django.utils import timezone

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

BATCH_SIZE = 1000

# The row each legacy list becomes: legacy_filter, initial name, data type and the type of
# its one condition. Repeated from sentry.ingest.legacy_filter_lists because a migration
# must not follow later edits to the module.
ROW_BY_OPTION_KEY = {
    "sentry:releases": ("release-version", "Releases", "all", "release"),
    "sentry:error_messages": ("error-message", "Error Messages", "error", "error_message"),
    "sentry:log_messages": ("log-message", "Log Messages", "log", "log_message"),
    "sentry:trace_metric_names": ("trace-metric-name", "Metric Names", "metric", "metric_name"),
}


def backfill_legacy_lists(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    """
    Writes every project's legacy filter lists into custom inbound filter rows the way the
    double write does on every PUT: one row per list, found by legacy_filter, with one
    condition that holds all the lines. A row that exists only gets its lines replaced, so
    the name and the active flag stay with the user. An empty list writes no row.

    The double write runs while this migration does. A PUT that lands between the read of a
    batch and its writes leaves a row newer than the option the batch read, so a conflict on
    insert is skipped and an update only lands on the lines the batch read.
    """
    ProjectOption = apps.get_model("sentry", "ProjectOption")
    CustomInboundFilter = apps.get_model("sentry", "CustomInboundFilter")

    options = RangeQuerySetWrapperWithProgressBar(
        ProjectOption.objects.filter(key__in=ROW_BY_OPTION_KEY), step=BATCH_SIZE
    )
    for batch in chunked(options, BATCH_SIZE):
        lists = [option for option in batch if isinstance(option.value, list) and option.value]
        if not lists:
            continue

        existing_rows = {
            (row.project_id, row.legacy_filter): row
            for row in CustomInboundFilter.objects.filter(
                project_id__in={option.project_id for option in lists},
                legacy_filter__isnull=False,
            )
        }

        new_rows = []
        for option in lists:
            legacy_filter, name, data_type, condition_type = ROW_BY_OPTION_KEY[option.key]
            conditions = [{"type": condition_type, "value": option.value}]
            existing = existing_rows.get((option.project_id, legacy_filter))
            if existing is None:
                new_rows.append(
                    CustomInboundFilter(
                        project_id=option.project_id,
                        name=name,
                        data_type=data_type,
                        conditions=conditions,
                        legacy_filter=legacy_filter,
                    )
                )
            elif existing.conditions != conditions:
                CustomInboundFilter.objects.filter(
                    id=existing.id, conditions=existing.conditions
                ).update(conditions=conditions, date_updated=timezone.now())

        CustomInboundFilter.objects.bulk_create(new_rows, ignore_conflicts=True)


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
        ("sentry", "1198_prepare_incidentactivity_retirement"),
    ]

    operations = [
        migrations.RunPython(
            backfill_legacy_lists,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_projectoptions", "sentry_custominboundfilter"]},
        ),
    ]
