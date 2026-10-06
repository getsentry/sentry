import hashlib
from collections import defaultdict

from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils import json
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar


def backfill_checkin_config(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    MonitorCheckIn = apps.get_model("monitors", "MonitorCheckIn")
    MonitorCheckInConfig = apps.get_model("monitors", "MonitorCheckInConfig")

    config_ids: dict[str, int] = {}

    def get_config_id(config: dict) -> int:
        config_hash = hashlib.sha256(json.dumps(config, sort_keys=True).encode("utf-8")).hexdigest()
        if config_hash not in config_ids:
            checkin_config, _ = MonitorCheckInConfig.objects.get_or_create(
                hash=config_hash, defaults={"config": config}
            )
            config_ids[config_hash] = checkin_config.id
        return config_ids[config_hash]

    def update_batch(checkins: list) -> None:
        checkin_ids_by_config_id: dict[int, list[int]] = defaultdict(list)
        for checkin in checkins:
            if checkin.checkin_config_id is not None or checkin.monitor_config is None:
                continue
            checkin_ids_by_config_id[get_config_id(checkin.monitor_config)].append(checkin.id)

        for config_id, checkin_ids in checkin_ids_by_config_id.items():
            MonitorCheckIn.objects.filter(
                id__in=checkin_ids, checkin_config_id__isnull=True
            ).update(checkin_config_id=config_id)

    queryset = MonitorCheckIn.objects.filter(
        monitor_config__isnull=False, checkin_config_id__isnull=True
    ).only("id", "monitor_config", "checkin_config_id")

    for _ in RangeQuerySetWrapperWithProgressBar(queryset, callbacks=[update_batch]):
        pass


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
        ("monitors", "0014_add_monitorcheckinconfig"),
    ]

    operations = [
        migrations.RunPython(
            backfill_checkin_config,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_monitorcheckin", "sentry_monitorcheckinconfig"]},
        ),
    ]
