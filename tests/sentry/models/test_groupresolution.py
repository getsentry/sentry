from datetime import timedelta

from django.utils import timezone

from sentry.models.groupresolution import GroupResolution
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class GroupResolutionTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.old_release = self.create_release(
            version="a", date_added=timezone.now() - timedelta(minutes=30)
        )
        self.new_release = self.create_release(version="b")
        self.group = self.create_group()
        self.old_semver_release = self.create_release(version="foo_package@1.0")
        self.new_semver_release = self.create_release(version="foo_package@2.0")

    def test_in_next_release_with_new_release(self) -> None:
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_next_release
        )
        assert not GroupResolution.has_resolution(self.group, self.new_release)

    def test_in_next_release_with_same_release(self) -> None:
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_next_release
        )
        assert GroupResolution.has_resolution(self.group, self.old_release)

    def test_in_next_release_with_old_release(self) -> None:
        GroupResolution.objects.create(
            release=self.new_release, group=self.group, type=GroupResolution.Type.in_next_release
        )
        assert GroupResolution.has_resolution(self.group, self.old_release)

    def test_for_semver_when_current_release_version_is_set_with_new_semver_release(self) -> None:
        # Behaviour should be the same in both `in_release` and `in_next_release` because if
        # `current_release_version` is set then comparison will be > current_release_version
        # should not have a resolution
        for grp_res_type in [GroupResolution.Type.in_release, GroupResolution.Type.in_next_release]:
            grp_resolution = GroupResolution.objects.create(
                release=self.old_semver_release,
                current_release_version=self.old_semver_release.version,
                group=self.group,
                type=grp_res_type,
            )
            assert not GroupResolution.has_resolution(self.group, self.new_semver_release)

            grp_resolution.delete()

    def test_for_semver_when_current_release_version_is_set_with_same_release(self) -> None:
        for grp_res_type in [GroupResolution.Type.in_release, GroupResolution.Type.in_next_release]:
            grp_resolution = GroupResolution.objects.create(
                release=self.old_semver_release,
                current_release_version=self.old_semver_release.version,
                group=self.group,
                type=grp_res_type,
            )
            assert GroupResolution.has_resolution(self.group, self.old_semver_release)

            grp_resolution.delete()

    def test_for_semver_when_current_release_version_is_set_with_old_semver_release(self) -> None:
        for grp_res_type in [GroupResolution.Type.in_release, GroupResolution.Type.in_next_release]:
            grp_resolution = GroupResolution.objects.create(
                release=self.new_semver_release,
                current_release_version=self.new_semver_release.version,
                group=self.group,
                type=grp_res_type,
            )
            assert GroupResolution.has_resolution(self.group, self.old_semver_release)
            grp_resolution.delete()

    def test_when_current_release_version_is_set_with_new_release(self) -> None:
        for grp_res_type in [GroupResolution.Type.in_release, GroupResolution.Type.in_next_release]:
            grp_resolution = GroupResolution.objects.create(
                release=self.old_release,
                current_release_version=self.old_release.version,
                group=self.group,
                type=grp_res_type,
            )
            assert not GroupResolution.has_resolution(self.group, self.new_release)

            grp_resolution.delete()

    def test_when_current_release_version_is_set_with_same_release(self) -> None:
        for grp_res_type in [GroupResolution.Type.in_release, GroupResolution.Type.in_next_release]:
            grp_resolution = GroupResolution.objects.create(
                release=self.old_release,
                current_release_version=self.old_release.version,
                group=self.group,
                type=grp_res_type,
            )
            assert GroupResolution.has_resolution(self.group, self.old_release)

            grp_resolution.delete()

    def test_when_current_release_version_is_set_with_old_release(self) -> None:
        for grp_res_type in [GroupResolution.Type.in_release, GroupResolution.Type.in_next_release]:
            grp_resolution = GroupResolution.objects.create(
                release=self.new_release,
                current_release_version=self.new_release.version,
                group=self.group,
                type=grp_res_type,
            )
            assert GroupResolution.has_resolution(self.group, self.old_release)

            grp_resolution.delete()

    def test_when_current_release_version_is_set_incorrect_inputs_fallback_to_older_model(
        self,
    ) -> None:
        """
        Test that ensures in a project that follows semver and where current_release_version is
        set, wrong release input (non semver) comparison does not break the method, but rather
        fallsback to the older model of comparison
        """
        old_random_release = self.create_release(
            date_added=timezone.now() - timedelta(minutes=45), version="doggo"
        )

        GroupResolution.objects.create(
            release=old_random_release,
            current_release_version=old_random_release.version,
            group=self.group,
            type=GroupResolution.Type.in_next_release,
        )

        for release in [
            self.old_release,
            self.new_release,
            self.old_semver_release,
            self.new_semver_release,
        ]:
            assert not GroupResolution.has_resolution(self.group, release)

    def test_when_current_release_version_is_set_but_does_not_exist_fallback_to_older_model(
        self,
    ) -> None:
        """
        Test that ensures in a project that does not follows semver, and current_release_version
        is set but no corresponding Release instance exists for that release version then
        comparison does not break the method, but rather fallsback to the older model
        """
        GroupResolution.objects.create(
            release=self.old_release,
            current_release_version="kittie 12",
            group=self.group,
            type=GroupResolution.Type.in_next_release,
        )

        for release in [self.new_release, self.old_semver_release, self.new_semver_release]:
            assert not GroupResolution.has_resolution(self.group, release)

    def test_in_release_with_new_release(self) -> None:
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert not GroupResolution.has_resolution(self.group, self.new_release)

    def test_in_release_with_current_release(self) -> None:
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert not GroupResolution.has_resolution(self.group, self.old_release)

    def test_in_release_with_old_release(self) -> None:
        GroupResolution.objects.create(
            release=self.new_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert GroupResolution.has_resolution(self.group, self.old_release)

    def test_for_semver_in_release_with_new_release(self) -> None:
        GroupResolution.objects.create(
            release=self.old_semver_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert not GroupResolution.has_resolution(self.group, self.new_semver_release)

    def test_for_semver_in_release_with_current_release(self) -> None:
        GroupResolution.objects.create(
            release=self.old_semver_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert not GroupResolution.has_resolution(self.group, self.old_semver_release)

    def test_for_semver_in_release_with_old_release(self) -> None:
        GroupResolution.objects.create(
            release=self.new_semver_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert GroupResolution.has_resolution(self.group, self.old_semver_release)

    def test_no_release_with_resolution(self) -> None:
        GroupResolution.objects.create(
            release=self.new_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert GroupResolution.has_resolution(self.group, None)

    def test_no_release_with_no_resolution(self) -> None:
        assert not GroupResolution.has_resolution(self.group, None)

    @with_feature("organizations:resolve-in-future-release")
    def test_in_future_release_with_semver_and_newer_release(self) -> None:
        """Test that release newer than self.new_semver_release
        has no resolution with group resolved in self.new_semver_release."""
        newer_semver_release = self.create_release(version="foo_package@2.1")

        GroupResolution.objects.create(
            release=self.old_semver_release,
            group=self.group,
            type=GroupResolution.Type.in_future_release,
            future_release_version=self.new_semver_release.version,
        )

        assert not GroupResolution.has_resolution(self.group, newer_semver_release)

    @with_feature("organizations:resolve-in-future-release")
    def test_in_future_release_with_semver_and_same_release(self) -> None:
        """Test that release same as self.new_semver_release
        has no resolution with group resolved in self.new_semver_release."""
        GroupResolution.objects.create(
            release=self.old_semver_release,
            group=self.group,
            type=GroupResolution.Type.in_future_release,
            future_release_version=self.new_semver_release.version,
        )

        assert not GroupResolution.has_resolution(self.group, self.new_semver_release)

    @with_feature("organizations:resolve-in-future-release")
    def test_in_future_release_with_semver_and_older_release(self) -> None:
        """Test that release older than self.new_semver_release
        has resolution with group resolved in self.new_semver_release."""
        older_semver_release = self.create_release(version="foo_package@1.9")

        GroupResolution.objects.create(
            release=self.old_semver_release,
            group=self.group,
            type=GroupResolution.Type.in_future_release,
            future_release_version=self.new_semver_release.version,
        )

        assert GroupResolution.has_resolution(self.group, older_semver_release)

    @with_feature("organizations:resolve-in-future-release")
    def test_in_future_release_non_semver(self) -> None:
        """Test that non-semver releases fall back to the older date-based comparison model."""
        # Newer semver but older date
        release_v2_older_date = self.create_release(
            version="bar_package@3.0", date_added=timezone.now() - timedelta(minutes=60)
        )
        # Older semver but newer date
        release_v1_newer_date = self.create_release(
            version="bar_package@2.5", date_added=timezone.now() - timedelta(minutes=30)
        )

        GroupResolution.objects.create(
            release=release_v1_newer_date,
            group=self.group,
            type=GroupResolution.Type.in_future_release,
            future_release_version="non-semver-version",
        )

        # By date-based logic, 3.0 released before 2.5 -> resolution
        assert GroupResolution.has_resolution(self.group, release_v2_older_date)

        # The resolution release itself should have resolution
        assert GroupResolution.has_resolution(self.group, release_v1_newer_date)

    def test_in_future_release_no_feature_flag(self) -> None:
        """Test that without feature flag, fall back to the older date-based comparison model."""
        # Newer semver but older date
        release_v3_older_date = self.create_release(
            version="baz_package@3.0", date_added=timezone.now() - timedelta(minutes=60)
        )
        # Older semver but newer date
        release_v2_newer_date = self.create_release(
            version="baz_package@2.5", date_added=timezone.now() - timedelta(minutes=30)
        )

        GroupResolution.objects.create(
            release=release_v2_newer_date,
            group=self.group,
            type=GroupResolution.Type.in_future_release,
            future_release_version="baz_package@2.8",
        )

        # By semver logic, 3.0 > 2.8 -> regression
        # By date-based logic, 3.0 released before 2.5 -> resolution
        assert GroupResolution.has_resolution(self.group, release_v3_older_date)

        # The resolution release itself should have resolution
        assert GroupResolution.has_resolution(self.group, release_v2_newer_date)

    def test_all_resolutions_are_implemented(self) -> None:
        resolution_types = [
            attr for attr in vars(GroupResolution.Type) if not attr.startswith("__")
        ]
        for resolution_type in resolution_types:
            resolution = GroupResolution.objects.create(
                release=self.new_release,
                group=self.group,
                type=getattr(GroupResolution.Type, resolution_type),
            )
            assert (
                GroupResolution.has_resolution(self.group, self.old_release) is not NotImplemented
            )

            resolution.delete()
