from datetime import UTC, datetime, timedelta

from sentry.rules.filters.latest_adopted_release_filter import (
    LatestAdoptedReleaseFilter,
    is_newer_release,
)
from sentry.search.utils import LatestReleaseOrders
from sentry.testutils.cases import RuleTestCase, TestCase
from sentry.testutils.helpers.features import with_feature


class LatestAdoptedReleaseFilterTest(RuleTestCase):
    rule_cls = LatestAdoptedReleaseFilter

    def test_semver(self) -> None:
        event = self.get_event()
        now = datetime.now(UTC)
        prod = self.create_environment(name="prod")
        test = self.create_environment(name="test")
        newest_release = self.create_release(
            project=event.group.project,
            version="test@2.0",
            date_added=now - timedelta(days=2),
            environments=[test],
            adopted=now - timedelta(days=2),
        )

        oldest_release = self.create_release(
            project=event.group.project,
            version="test@1.0",
            date_added=now - timedelta(days=1),
            environments=[prod],
            adopted=now - timedelta(days=1),
        )

        middle_release = self.create_release(
            project=event.group.project,
            version="test@1.5",
            date_added=now,
            environments=[prod],
            adopted=now,
        )
        # Test no release
        data = {"oldest_or_newest": "oldest", "older_or_newer": "newer", "environment": prod.name}
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)

        self.create_group_release(group=self.event.group, release=newest_release)

        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)

        event_2 = self.store_event(data={"fingerprint": ["group2"]}, project_id=self.project.id)
        group_2 = event_2.group

        self.create_group_release(group=group_2, release=newest_release)
        self.create_group_release(group=group_2, release=oldest_release)
        self.assertDoesNotPass(rule, event_2)

        event_3 = self.store_event(data={"fingerprint": ["group3"]}, project_id=self.project.id)
        group_3 = event_3.group

        self.create_group_release(group=group_3, release=middle_release)
        self.assertDoesNotPass(rule, event_3)

        # Check that the group cache invalidation works by adding an older release to the first group
        self.create_group_release(group=self.event.group, release=oldest_release)
        self.assertDoesNotPass(rule, event)

        # Check that the project cache invalidation works by adding a newer release to the project
        event_4 = self.store_event(data={"fingerprint": ["group4"]}, project_id=self.project.id)
        group_4 = event_4.group
        self.create_group_release(group=group_4, release=newest_release)
        self.assertPasses(rule, event_4)

        self.create_release(
            project=event.group.project,
            version="test@3.0",
            date_added=now - timedelta(days=5),
            environments=[prod],
            adopted=now - timedelta(days=2),
        )
        self.assertDoesNotPass(rule, event_4)

    def test_semver_with_release_without_adoption(self) -> None:
        event = self.get_event()
        now = datetime.now(UTC)
        prod = self.create_environment(name="prod")
        test = self.create_environment(name="test")
        test_release = self.create_release(
            project=event.group.project,
            version="test@1.9",
            date_added=now,
            environments=[test],
            adopted=now,
        )
        test_bad_release = self.create_release(
            project=event.group.project,
            version="test@0.9",
            date_added=now - timedelta(days=2),
            environments=[prod],
            adopted=now - timedelta(days=2),
        )
        # Latest unadopted release
        self.create_release(
            project=event.group.project,
            version="test@2.0",
            date_added=now - timedelta(days=1),
            environments=[prod],
            adopted=None,
        )
        # Latest adopted release
        self.create_release(
            project=event.group.project,
            version="test@1.0",
            date_added=now - timedelta(days=3),
            environments=[prod],
            adopted=now - timedelta(days=3),
        )

        self.create_group_release(group=self.event.group, release=test_bad_release)
        data = {"oldest_or_newest": "oldest", "older_or_newer": "newer", "environment": prod.name}

        rule = self.get_rule(data=data)
        # Oldest release for group is .9, latest adopted release for environment is 1.0
        self.assertDoesNotPass(rule, event)

        event_2 = self.store_event(data={"fingerprint": ["group2"]}, project_id=self.project.id)
        group_2 = event_2.group
        self.create_group_release(group=group_2, release=test_release)
        # Oldest release for group is 1.9, latest adopted release for environment is 1.0
        self.assertPasses(rule, event_2)

    @with_feature("organizations:semver-ordering-with-build-code")
    def test_semver_with_build_code(self) -> None:
        """
        Test that the rule uses build number when ordering releases by semver.

        Without build code ordering, whichever release is created last will get
        picked as the latest adopted release for the env. Ie, the behavior that
        we are changing is the fallback to insertion order (id), NOT date_added.
        In prod, id and date_added are closely linked, but we specify here for
        clarity.
        """
        event = self.get_event()
        now = datetime.now(UTC)
        prod = self.create_environment(name="prod")
        test = self.create_environment(name="test")

        release_9 = self.create_release(
            project=event.group.project,
            version="test@2.0+9",
            environments=[test],
            date_added=now - timedelta(days=2),
            adopted=now - timedelta(days=2),
        )
        self.create_group_release(group=self.event.group, release=release_9)

        release_11 = self.create_release(
            project=event.group.project,
            version="test@2.0+11",
            environments=[test],
            date_added=now - timedelta(days=2),
            adopted=now - timedelta(days=2),
        )

        self.create_release(
            project=event.group.project,
            version="test@2.0+10",
            environments=[prod],
            date_added=now - timedelta(days=1),
            adopted=now - timedelta(days=1),
        )

        self.create_release(
            project=event.group.project,
            version="test@2.0+8",
            environments=[prod],
            date_added=now,
            adopted=now,
        )

        # The newest adopted release associated with the event's issue (2.0+9)
        # is older than the latest adopted release in prod (2.0+10)
        data = {"oldest_or_newest": "newest", "older_or_newer": "newer", "environment": prod.name}
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)
        data = {"oldest_or_newest": "newest", "older_or_newer": "older", "environment": prod.name}
        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)

        self.create_group_release(group=self.event.group, release=release_11)

        # The newest adopted release associated with the event's issue (2.0+11)
        # is newer than the latest adopted release in prod (2.0+10)
        data = {"oldest_or_newest": "newest", "older_or_newer": "newer", "environment": prod.name}
        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)
        data = {"oldest_or_newest": "newest", "older_or_newer": "older", "environment": prod.name}
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)

        # The oldest adopted release associated with the event's issue (2.0+9)
        # is older than the latest adopted release in prod (2.0+10)
        data = {"oldest_or_newest": "oldest", "older_or_newer": "newer", "environment": prod.name}
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)
        data = {"oldest_or_newest": "oldest", "older_or_newer": "older", "environment": prod.name}
        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)

        self.create_release(
            project=event.group.project,
            version="test@2.0+a",
            environments=[prod],
            date_added=now - timedelta(days=3),
            adopted=now - timedelta(days=3),
        )

        # The newest adopted release associated with the event's issue (2.0+11)
        # is older than the latest adopted release in prod (2.0+a)
        data = {"oldest_or_newest": "newest", "older_or_newer": "newer", "environment": prod.name}
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)
        data = {"oldest_or_newest": "newest", "older_or_newer": "older", "environment": prod.name}
        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)

    def test_no_adopted_release(self) -> None:
        event = self.get_event()
        now = datetime.now(UTC)
        prod = self.create_environment(name="prod")
        test = self.create_environment(name="test")
        test_release = self.create_release(
            project=event.group.project,
            version="test@1.9",
            date_added=now,
            environments=[test],
            adopted=now,
        )
        self.create_release(
            project=event.group.project,
            version="test@0.9",
            date_added=now - timedelta(days=2),
            environments=[prod],
            adopted=None,
        )
        self.create_group_release(group=self.event.group, release=test_release)
        data = {"oldest_or_newest": "oldest", "older_or_newer": "newer", "environment": prod.name}
        rule = self.get_rule(data=data)
        self.assertDoesNotPass(rule, event)

    def test_date(self) -> None:
        event = self.get_event()
        now = datetime.now(UTC)
        prod = self.create_environment(name="prod")
        test = self.create_environment(name="test")
        oldest_release = self.create_release(
            project=event.group.project,
            version="1",
            date_added=now - timedelta(days=2),
            environments=[prod],
            adopted=now - timedelta(days=2),
        )

        middle_release = self.create_release(
            project=event.group.project,
            version="2",
            date_added=now - timedelta(days=1),
            environments=[prod],
            adopted=now - timedelta(days=1),
        )

        newest_release = self.create_release(
            project=event.group.project,
            version="3",
            date_added=now,
            environments=[test],
            adopted=now,
        )
        self.create_group_release(group=self.event.group, release=newest_release)

        data = {"oldest_or_newest": "oldest", "older_or_newer": "newer", "environment": prod.name}
        rule = self.get_rule(data=data)
        self.assertPasses(rule, event)

        event_2 = self.store_event(data={"fingerprint": ["group2"]}, project_id=self.project.id)
        group_2 = event_2.group

        self.create_group_release(group=group_2, release=newest_release)
        self.create_group_release(group=group_2, release=oldest_release)
        self.assertDoesNotPass(rule, event_2)

        event_3 = self.store_event(data={"fingerprint": ["group3"]}, project_id=self.project.id)
        group_3 = event_3.group

        self.create_group_release(group=group_3, release=middle_release)
        self.assertDoesNotPass(rule, event_3)


class IsNewerReleaseTest(TestCase):
    def _test_is_newer_release_semver_helper(self, with_build_code: bool) -> None:
        """Test that is_newer_release correctly compares releases with semver and build code."""
        older_release = self.create_release(version="test@1.0", project=self.project)
        newer_release = self.create_release(version="test@2.0", project=self.project)
        newer_release_older_numeric = self.create_release(
            version="test@2.0+100", project=self.project
        )
        newer_release_newer_numeric = self.create_release(
            version="test@2.0+200", project=self.project
        )
        newer_release_alpha = self.create_release(version="test@2.0+zzz", project=self.project)

        if with_build_code:
            assert is_newer_release(newer_release, older_release, LatestReleaseOrders.SEMVER)

            # numeric build codes are compared numerically
            assert is_newer_release(
                newer_release_newer_numeric, newer_release_older_numeric, LatestReleaseOrders.SEMVER
            )

            # alphanumeric builds are always newer than numeric builds
            assert is_newer_release(
                newer_release_alpha, newer_release_older_numeric, LatestReleaseOrders.SEMVER
            )
            assert is_newer_release(
                newer_release_alpha, newer_release_newer_numeric, LatestReleaseOrders.SEMVER
            )

            # releases without build are always older than releases with build
            assert is_newer_release(
                newer_release_older_numeric, newer_release, LatestReleaseOrders.SEMVER
            )
            assert is_newer_release(newer_release_alpha, newer_release, LatestReleaseOrders.SEMVER)
        else:
            assert is_newer_release(newer_release, older_release, LatestReleaseOrders.SEMVER)

            # all releases with version 1.0 are considered equal

            assert not is_newer_release(
                newer_release_newer_numeric, newer_release_older_numeric, LatestReleaseOrders.SEMVER
            )
            assert not is_newer_release(
                newer_release_older_numeric, newer_release_newer_numeric, LatestReleaseOrders.SEMVER
            )

            assert not is_newer_release(
                newer_release_older_numeric, newer_release_newer_numeric, LatestReleaseOrders.SEMVER
            )
            assert not is_newer_release(
                newer_release_newer_numeric, newer_release_older_numeric, LatestReleaseOrders.SEMVER
            )

            assert not is_newer_release(
                newer_release_alpha, newer_release_older_numeric, LatestReleaseOrders.SEMVER
            )
            assert not is_newer_release(
                newer_release_older_numeric, newer_release_alpha, LatestReleaseOrders.SEMVER
            )

            assert not is_newer_release(
                newer_release, newer_release_older_numeric, LatestReleaseOrders.SEMVER
            )
            assert not is_newer_release(
                newer_release_older_numeric, newer_release, LatestReleaseOrders.SEMVER
            )

    def test_is_newer_release_semver(self) -> None:
        """Test is_newer_release compares releases by semver."""
        self._test_is_newer_release_semver_helper(with_build_code=False)

    def test_is_newer_release_semver_with_build_code(self) -> None:
        """Test is_newer_release compares releases by semver and build code."""
        with self.feature("organizations:semver-ordering-with-build-code"):
            self._test_is_newer_release_semver_helper(with_build_code=True)
