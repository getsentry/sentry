from datetime import timedelta

from django.utils import timezone

from sentry.models.groupresolution import GroupResolution
from sentry.testutils.cases import TestCase


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

    def test_stale_current_release_version_with_semver_flip(self) -> None:
        now = timezone.now()
        current_at_resolution = self.create_release(
            version="hotfix_pkg@1.3.0",
            date_added=now - timedelta(minutes=45),
        )
        resolved_in_release = self.create_release(
            version="hotfix_pkg@1.5.0",
            date_added=now - timedelta(minutes=30),
        )
        # Out-of-order: older semver but created later
        event_release = self.create_release(
            version="hotfix_pkg@1.4.0",
            date_added=now - timedelta(minutes=15),
        )
        # Non-semver release makes follows_semver False at resolution time;
        # by event time it's no longer in the recent 3 so follows_semver flips to True
        self.create_release(
            version="hotfix_pkg@nightly-100",
            date_added=now - timedelta(minutes=60),
        )

        GroupResolution.objects.create(
            release=resolved_in_release,
            current_release_version=current_at_resolution.version,
            group=self.group,
            type=GroupResolution.Type.in_next_release,
            status=GroupResolution.Status.pending,
        )

        # Fix is in 1.5.0; event on 1.4.0 (< 1.5.0 in semver) should NOT regress
        assert GroupResolution.has_resolution(self.group, event_release)

    def test_genuine_regression_detected_with_stale_current_release_version(self) -> None:
        now = timezone.now()
        current_at_resolution = self.create_release(
            version="regtest_pkg@1.3.0",
            date_added=now - timedelta(minutes=45),
        )
        resolved_in_release = self.create_release(
            version="regtest_pkg@1.5.0",
            date_added=now - timedelta(minutes=30),
        )
        event_release = self.create_release(
            version="regtest_pkg@1.7.0",
            date_added=now - timedelta(minutes=15),
        )

        GroupResolution.objects.create(
            release=resolved_in_release,
            current_release_version=current_at_resolution.version,
            group=self.group,
            type=GroupResolution.Type.in_next_release,
            status=GroupResolution.Status.pending,
        )

        # Event on 1.7.0 > resolved-in 1.5.0, so this IS a regression
        assert not GroupResolution.has_resolution(self.group, event_release)
