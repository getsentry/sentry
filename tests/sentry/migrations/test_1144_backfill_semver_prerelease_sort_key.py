from sentry.models.release import Release
from sentry.models.releases.util import SEMVER_PRERELEASE_NUMERIC_PAD_WIDTH
from sentry.testutils.cases import TestMigrations


class BackfillSemverPrereleaseSortKeyTest(TestMigrations):
    migrate_from = "1143_add_pipeline_hash_index_to_groupderiveddata"
    migrate_to = "1144_backfill_semver_prerelease_sort_key"

    def setup_before_migration(self, apps):
        self.org = self.create_organization(name="Test org", slug="test-org")

        def create_legacy_release(version, raw_prerelease):
            # Simulate a pre-fix row: `update()` bypasses the pre_save signal
            # that would normalize the prerelease.
            release = Release.objects.create(organization=self.org, version=version)
            Release.objects.filter(id=release.id).update(prerelease=raw_prerelease)
            return release

        self.release_numeric = create_legacy_release(
            "test@3.0.0-prerelease.96", "prerelease.96"
        )
        self.release_alpha = create_legacy_release("test@3.0.0-alpha.beta", "alpha.beta")
        self.release_no_prerelease = create_legacy_release("test@3.0.0", "")
        self.release_non_semver = Release.objects.create(
            organization=self.org, version="not a semver release"
        )

    def test(self):
        self.release_numeric.refresh_from_db()
        self.release_alpha.refresh_from_db()
        self.release_no_prerelease.refresh_from_db()
        self.release_non_semver.refresh_from_db()

        padded_96 = "96".zfill(SEMVER_PRERELEASE_NUMERIC_PAD_WIDTH)
        assert self.release_numeric.prerelease == f"prerelease.{padded_96}"
        # Alphanumeric identifiers and empty prereleases are untouched.
        assert self.release_alpha.prerelease == "alpha.beta"
        assert self.release_no_prerelease.prerelease == ""
        assert self.release_non_semver.prerelease is None
