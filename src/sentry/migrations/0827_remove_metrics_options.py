from django.db import migrations
from django.db.migrations.state import StateApps

from sentry.new_migrations.migrations import CheckedMigration


def remove_project_option(apps: StateApps, key: str):
    ProjectOption = apps.get_model("sentry", "ProjectOption")
    for option in ProjectOption.objects.filter(key=key):
        option.delete()


def remove_org_option(apps: StateApps, key: str):
    OrganizationOption = apps.get_model("sentry", "OrganizationOption")
    for option in OrganizationOption.objects.filter(key=key):
        option.delete()


class Migration(CheckedMigration):
    # This flag is used to mark that a migration shouldn't be automatically run in production.
    # This should only be used for operations where it's safe to run the migration after your
    # code has deployed. So this should nØot be used for most operations that alter the schema
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
        ("sentry", "0826_make_sentryapp_uuid_unique"),
    ]

    operations = [
        migrations.RunPython(
            lambda apps, _: remove_project_option(apps, "sentry:blocked_metrics"),
            migrations.RunPython.noop,
            hints={"tables": ["sentry_projectoptions"]},
        ),
        migrations.RunPython(
            lambda apps, _: remove_project_option(apps, "sentry:metrics_extraction_rules"),
            migrations.RunPython.noop,
            hints={"tables": ["sentry_projectoptions"]},
        ),
        migrations.RunPython(
            lambda apps, _: remove_org_option(apps, "sentry:metrics_activate_percentiles"),
            migrations.RunPython.noop,
            hints={"tables": ["sentry_organizationoptions"]},
        ),
        migrations.RunPython(
            lambda apps, _: remove_org_option(apps, "sentry:metrics_activate_last_for_gauges"),
            migrations.RunPython.noop,
            hints={"tables": ["sentry_organizationoptions"]},
        ),
    ]
