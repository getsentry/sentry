from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration

DEBUG_ID_PATTERN = r"^[A-Fa-f0-9-]+$"
NIL_UUID = "00000000-0000-0000-0000-000000000000"


def backfill_invalid_projectdebugfile_debug_ids(
    apps: StateApps, schema_editor: BaseDatabaseSchemaEditor
) -> None:
    ProjectDebugFile = apps.get_model("sentry", "ProjectDebugFile")
    ProjectDebugFile.objects.exclude(debug_id__regex=DEBUG_ID_PATTERN).update(debug_id=NIL_UUID)


class Migration(CheckedMigration):
    is_post_deployment = True

    dependencies = [
        ("sentry", "1100_add_relocation_file_bucket_path"),
    ]

    operations = [
        migrations.RunPython(
            backfill_invalid_projectdebugfile_debug_ids,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["sentry_projectdsymfile"]},
        ),
    ]
