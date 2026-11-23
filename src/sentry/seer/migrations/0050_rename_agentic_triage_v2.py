from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

OLD_STRATEGY = "agentic_triage_v2"
NEW_STRATEGY = "scheduled_investigation"
NIGHT_SHIFT_ACTION_SETTINGS = {"skill": "night_shift"}


def rename_agentic_triage_v2(apps: StateApps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    SeerWorkflowConfig = apps.get_model("seer", "SeerWorkflowConfig")
    for config in RangeQuerySetWrapperWithProgressBar(
        SeerWorkflowConfig.objects.filter(strategy=OLD_STRATEGY)
    ):
        config.strategy = NEW_STRATEGY
        if config.extras.get("seeded_default") == OLD_STRATEGY:
            config.extras["seeded_default"] = NEW_STRATEGY
            # The seeded default ran the night shift prompt, which is now a Seer skill.
            if not config.extras.get("action_settings"):
                config.extras["action_settings"] = NIGHT_SHIFT_ACTION_SETTINGS
        config.save(update_fields=["strategy", "extras"])


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

    is_post_deployment = False

    dependencies = [
        ("seer", "0049_workflow_config_versions"),
    ]

    operations = [
        migrations.RunPython(
            rename_agentic_triage_v2,
            reverse_code=migrations.RunPython.noop,
            hints={"tables": ["seer_workflowconfig"]},
        ),
    ]
