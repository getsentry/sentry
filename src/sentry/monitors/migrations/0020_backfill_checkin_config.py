import hashlib
from collections import defaultdict

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils import json
from sentry.utils.iterators import chunked
from sentry.utils.query import RangeQuerySetWrapperWithProgressBarApprox


def backfill_checkin_config(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    MonitorCheckIn = apps.get_model("monitors", "MonitorCheckIn")
    MonitorCheckInConfig = apps.get_model("monitors", "MonitorCheckInConfig")

    config_ids: dict[str, int] = {}
    checkins = MonitorCheckIn.objects.all().values_list("id", "monitor_config", "checkin_config_id")

    for batch in chunked(
        RangeQuerySetWrapperWithProgressBarApprox(
            checkins, step=1000, result_value_getter=lambda row: row[0]
        ),
        1000,
    ):
        checkin_ids_by_config_id: dict[int, list[int]] = defaultdict(list)
        for checkin_id, config, checkin_config_id in batch:
            if config is None or checkin_config_id is not None:
                continue
            config_hash = hashlib.sha256(
                json.dumps(config, sort_keys=True).encode("utf-8")
            ).hexdigest()
            if config_hash not in config_ids:
                config_ids[config_hash] = MonitorCheckInConfig.objects.get_or_create(
                    hash=config_hash, defaults={"config": config}
                )[0].id
            checkin_ids_by_config_id[config_ids[config_hash]].append(checkin_id)

        for config_id, checkin_ids in checkin_ids_by_config_id.items():
            MonitorCheckIn.objects.filter(id__in=checkin_ids).update(checkin_config_id=config_id)


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
        ("monitors", "0019_drop_checkin_project_id"),
    ]

    operations = [
        migrations.RunPython(
            backfill_checkin_config,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_monitorcheckin", "sentry_monitorcheckinconfig"]},
        ),
    ]
