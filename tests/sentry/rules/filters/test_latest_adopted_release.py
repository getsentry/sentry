from datetime import datetime, timedelta

from sentry.rules.filters.latest_adopted_release_filter import LatestAdoptedReleaseFilter
from sentry.testutils.cases import RuleTestCase


class LatestAdoptedReleaseFilterTest(RuleTestCase):
    rule_cls = LatestAdoptedReleaseFilter

    def test_semver(self):
        event = self.get_event()
        now = datetime.now()
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

    def test_date(self):
        event = self.get_event()
        now = datetime.now()
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
