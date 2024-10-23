from datetime import timedelta

from django.utils import timezone

from sentry.models.groupresolution import GroupResolution
from sentry.testutils.cases import TestCase


class GroupResolutionTest(TestCase):
    def setUp(self):
        super().setUp()
        self.old_release = self.create_release(
            version="a", date_added=timezone.now() - timedelta(minutes=30)
        )
        self.new_release = self.create_release(version="b")
        self.group = self.create_group()
        self.old_semver_release = self.create_release(version="foo_package@1.0")
        self.new_semver_release = self.create_release(version="foo_package@2.0")

    def test_in_next_release_with_new_release(self):
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_next_release
        )
        assert not GroupResolution.has_resolution(self.group, self.new_release)

    def test_in_next_release_with_same_release(self):
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_next_release
        )
        assert GroupResolution.has_resolution(self.group, self.old_release)

    def test_in_next_release_with_old_release(self):
        GroupResolution.objects.create(
            release=self.new_release, group=self.group, type=GroupResolution.Type.in_next_release
        )
        assert GroupResolution.has_resolution(self.group, self.old_release)

    def test_for_semver_when_current_release_version_is_set_with_new_semver_release(self):
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

    def test_for_semver_when_current_release_version_is_set_with_same_release(self):
        for grp_res_type in [GroupResolution.Type.in_release, GroupResolution.Type.in_next_release]:
            grp_resolution = GroupResolution.objects.create(
                release=self.old_semver_release,
                current_release_version=self.old_semver_release.version,
                group=self.group,
                type=grp_res_type,
            )
            assert GroupResolution.has_resolution(self.group, self.old_semver_release)

            grp_resolution.delete()

    def test_for_semver_when_current_release_version_is_set_with_old_semver_release(self):
        for grp_res_type in [GroupResolution.Type.in_release, GroupResolution.Type.in_next_release]:
            grp_resolution = GroupResolution.objects.create(
                release=self.new_semver_release,
                current_release_version=self.new_semver_release.version,
                group=self.group,
                type=grp_res_type,
            )
            assert GroupResolution.has_resolution(self.group, self.old_semver_release)
            grp_resolution.delete()

    def test_when_current_release_version_is_set_with_new_release(self):
        for grp_res_type in [GroupResolution.Type.in_release, GroupResolution.Type.in_next_release]:
            grp_resolution = GroupResolution.objects.create(
                release=self.old_release,
                current_release_version=self.old_release.version,
                group=self.group,
                type=grp_res_type,
            )
            assert not GroupResolution.has_resolution(self.group, self.new_release)

            grp_resolution.delete()

    def test_when_current_release_version_is_set_with_same_release(self):
        for grp_res_type in [GroupResolution.Type.in_release, GroupResolution.Type.in_next_release]:
            grp_resolution = GroupResolution.objects.create(
                release=self.old_release,
                current_release_version=self.old_release.version,
                group=self.group,
                type=grp_res_type,
            )
            assert GroupResolution.has_resolution(self.group, self.old_release)

            grp_resolution.delete()

    def test_when_current_release_version_is_set_with_old_release(self):
        for grp_res_type in [GroupResolution.Type.in_release, GroupResolution.Type.in_next_release]:
            grp_resolution = GroupResolution.objects.create(
                release=self.new_release,
                current_release_version=self.new_release.version,
                group=self.group,
                type=grp_res_type,
            )
            assert GroupResolution.has_resolution(self.group, self.old_release)

            grp_resolution.delete()

    def test_when_current_release_version_is_set_incorrect_inputs_fallback_to_older_model(self):
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

    def test_when_current_release_version_is_set_but_does_not_exist_fallback_to_older_model(self):
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

    def test_in_release_with_new_release(self):
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert not GroupResolution.has_resolution(self.group, self.new_release)

    def test_in_release_with_current_release(self):
        GroupResolution.objects.create(
            release=self.old_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert not GroupResolution.has_resolution(self.group, self.old_release)

    def test_in_release_with_old_release(self):
        GroupResolution.objects.create(
            release=self.new_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert GroupResolution.has_resolution(self.group, self.old_release)

    def test_for_semver_in_release_with_new_release(self):
        GroupResolution.objects.create(
            release=self.old_semver_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert not GroupResolution.has_resolution(self.group, self.new_semver_release)

    def test_for_semver_in_release_with_current_release(self):
        GroupResolution.objects.create(
            release=self.old_semver_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert not GroupResolution.has_resolution(self.group, self.old_semver_release)

    def test_for_semver_in_release_with_old_release(self):
        GroupResolution.objects.create(
            release=self.new_semver_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert GroupResolution.has_resolution(self.group, self.old_semver_release)

    def test_no_release_with_resolution(self):
        GroupResolution.objects.create(
            release=self.new_release, group=self.group, type=GroupResolution.Type.in_release
        )
        assert GroupResolution.has_resolution(self.group, None)

    def test_no_release_with_no_resolution(self):
        assert not GroupResolution.has_resolution(self.group, None)

    def test_all_resolutions_are_implemented(self):
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
