from django.db import migrations


def forwards(apps, schema_editor):
    """
    Backfill the saved queries with their version.
    """
    DiscoverSavedQuery = apps.get_model("sentry", "DiscoverSavedQuery")
    for query in DiscoverSavedQuery.objects.filter(version__isnull=True).all():
        if "version" in query.query:
            query.version = query.query.get("version", 1)
            del query.query["version"]
        else:
            query.version = 1
        query.save()


class Migration(migrations.Migration):
    # This flag is used to mark that a migration shouldn't be automatically run in
    # production. We set this to True for operations that we think are risky and want
    # someone from ops to run manually and monitor.
    # General advice is that if in doubt, mark your migration as `is_dangerous`.
    # Some things you should always mark as dangerous:
    # - Adding indexes to large tables. These indexes should be created concurrently,
    #   unfortunately we can't run migrations outside of a transaction until Django
    #   1.10. So until then these should be run manually.
    # - Large data migrations. Typically we want these to be run manually by ops so that
    #   they can be monitored. Since data migrations will now hold a transaction open
    #   this is even more important.
    # - Adding columns to highly active tables, even ones that are NULL.
    is_dangerous = False

    # We are running many updates, so we don't want to be in a transaction.
    atomic = False

    dependencies = [
        ("sentry", "0018_discoversavedquery_version"),
    ]

    operations = [migrations.RunPython(forwards, migrations.RunPython.noop)]
