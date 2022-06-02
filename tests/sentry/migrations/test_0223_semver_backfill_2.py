from unittest import mock

from psycopg2.extras import execute_values

from sentry.testutils.cases import TestMigrations


class TestBackfill(TestMigrations):
    migrate_from = "0222_add_datetime_index_to_auditlogentry"
    migrate_to = "0223_semver_backfill_2"

    def setup_before_migration(self, apps):
        Release = apps.get_model("sentry", "Release")
        self.expected_none_ids = [
            Release.objects.create(
                organization_id=self.organization.id,
                version="test@1cdbeafkj",
                package="test",
                major=1,
                minor=0,
                patch=0,
                revision=0,
                prerelease="cdbeafkj",
                build_code="",
            ).id,
            Release.objects.create(
                organization_id=self.organization.id,
                version="1.2.3",
                package="sentry",
                major=1,
                minor=2,
                patch=3,
                revision=0,
                prerelease="",
                build_code="",
            ).id,
        ]
        self.expected_semver = [
            (
                Release.objects.create(
                    organization_id=self.organization.id,
                    version="test@1.2.3",
                    package="sentry",
                ).id,
                ["test", 1, 2, 3, 0, "", None],
            ),
        ]
        self.expected_not_updated = {
            Release.objects.create(
                organization_id=self.organization.id,
                version="abc123",
            ).id,
            Release.objects.create(
                organization_id=self.organization.id,
                version="test@1.2.4",
                package="test",
                major=1,
                minor=2,
                patch=4,
                revision=0,
                prerelease="",
            ).id,
            Release.objects.create(
                organization_id=self.organization.id,
                version="test@1.2.5-hi",
                package="test",
                major=1,
                minor=2,
                patch=5,
                revision=0,
                prerelease="hi",
            ).id,
            Release.objects.create(
                organization_id=self.organization.id,
                version="test@1.2.6-hi+1234",
                package="test",
                major=1,
                minor=2,
                patch=6,
                revision=0,
                prerelease="hi",
                build_code="1234",
                build_number=1234,
            ).id,
            Release.objects.create(
                organization_id=self.organization.id,
                version="test@1.2.7-hi+abc123",
                package="test",
                major=1,
                minor=2,
                patch=7,
                revision=0,
                prerelease="hi",
                build_code="abc123",
            ).id,
        }
        self.execute_values_patcher = mock.patch(
            "sentry.migrations.0223_semver_backfill_2.execute_values", side_effect=execute_values
        )
        self.execute_values_mock = self.execute_values_patcher.start()

    def tearDown(self):
        super().tearDown()
        self.execute_values_patcher.stop()

    def test(self):
        Release = self.apps.get_model("sentry", "Release")
        none_releases = Release.objects.filter(id__in=self.expected_none_ids)
        expected_fields = (
            "package",
            "major",
            "minor",
            "patch",
            "revision",
            "prerelease",
            "build_code",
        )
        for release in none_releases:
            assert all(getattr(release, field) is None for field in expected_fields)

        expected_semver_releases = Release.objects.filter(
            id__in=[expected[0] for expected in self.expected_semver]
        )
        for release, expected in zip(
            expected_semver_releases, [expected[1] for expected in self.expected_semver]
        ):
            assert [getattr(release, field) for field in expected_fields] == expected

        updated_release_ids = {item[0] for item in self.execute_values_mock.call_args[0][2]}
        assert updated_release_ids & self.expected_not_updated == set()
