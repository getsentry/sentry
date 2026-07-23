"""
Backfill `Release.prerelease` into its normalized, sortable form.

Numeric prerelease identifiers used to be stored raw, which made the
lexicographic ordering Postgres applies to the column disagree with semver
precedence (e.g. `rc.96` sorted higher than `rc.193`). New/updated releases
now store numeric identifiers zero-padded via `normalize_semver_prerelease`;
this migration rewrites existing rows to match.

Safe to re-run: rows already in normalized form are left untouched.
"""

from typing import Any

from django.db import migrations

from sentry.new_migrations.migrations import CheckedMigration
from sentry.utils.query import RangeQuerySetWrapperWithProgressBar

# Keep in sync with
# `sentry.models.releases.util.SEMVER_PRERELEASE_NUMERIC_PAD_WIDTH`, inlined
# here so the migration stays stable if the application code changes.
SEMVER_PRERELEASE_NUMERIC_PAD_WIDTH = 19


def _normalize_semver_prerelease(prerelease: str) -> str:
    return ".".join(
        (
            identifier.zfill(SEMVER_PRERELEASE_NUMERIC_PAD_WIDTH)
            if identifier.isascii()
            and identifier.isdigit()
            and len(identifier) <= SEMVER_PRERELEASE_NUMERIC_PAD_WIDTH
            else identifier
        )
        for identifier in prerelease.split(".")
    )


def backfill_semver_prerelease_sort_key(apps: Any, schema_editor: Any) -> None:
    Release = apps.get_model("sentry", "Release")

    queryset = Release.objects.filter(prerelease__isnull=False).exclude(prerelease="")
    for release in RangeQuerySetWrapperWithProgressBar(queryset):
        normalized = _normalize_semver_prerelease(release.prerelease)
        if normalized != release.prerelease:
            Release.objects.filter(id=release.id).update(prerelease=normalized)


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
        ("sentry", "1143_add_pipeline_hash_index_to_groupderiveddata"),
    ]

    operations = [
        migrations.RunPython(
            backfill_semver_prerelease_sort_key,
            migrations.RunPython.noop,
            hints={"tables": ["sentry_release"]},
        ),
    ]
