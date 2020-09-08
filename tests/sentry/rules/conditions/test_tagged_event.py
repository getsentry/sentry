from __future__ import absolute_import

from datetime import datetime

from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.tagged_event import TaggedEventCondition, MatchType
from sentry.models import Release
from sentry.signals import release_created


class TaggedEventConditionTest(RuleTestCase):
    rule_cls = TaggedEventCondition

    def get_event(self):
        event = self.event
        event.data["tags"] = (
            ("logger", "sentry.example"),
            ("logger", "foo.bar"),
            ("notlogger", "sentry.other.example"),
            ("notlogger", "bar.foo.baz"),
        )
        return event

    def test_render_label(self):
        rule = self.get_rule(data={"match": MatchType.EQUAL, "key": u"\xc3", "value": u"\xc4"})
        assert rule.render_label() == u"An event's tags match \xc3 equals \xc4"

    def test_equals(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "key": "LOGGER", "value": "sentry.example"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "key": "logger", "value": "sentry.other.example"}
        )
        self.assertDoesNotPass(rule, event)

    def test_does_not_equal(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_EQUAL, "key": "logger", "value": "sentry.example"}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.NOT_EQUAL, "key": "logger", "value": "sentry.other.example"}
        )
        self.assertPasses(rule, event)

    def test_starts_with(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.STARTS_WITH, "key": "logger", "value": "sentry."}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.STARTS_WITH, "key": "logger", "value": "bar."}
        )
        self.assertDoesNotPass(rule, event)

    def test_ends_with(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.ENDS_WITH, "key": "logger", "value": ".example"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(data={"match": MatchType.ENDS_WITH, "key": "logger", "value": ".foo"})
        self.assertDoesNotPass(rule, event)

    def test_contains(self):
        event = self.get_event()
        rule = self.get_rule(data={"match": MatchType.CONTAINS, "key": "logger", "value": "sentry"})
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.CONTAINS, "key": "logger", "value": "bar.foo"}
        )
        self.assertDoesNotPass(rule, event)

    def test_does_not_contain(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_CONTAINS, "key": "logger", "value": "sentry"}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.NOT_CONTAINS, "key": "logger", "value": "bar.foo"}
        )
        self.assertPasses(rule, event)

    def test_is_set(self):
        event = self.get_event()

        rule = self.get_rule(data={"match": MatchType.IS_SET, "key": "logger"})
        self.assertPasses(rule, event)

        rule = self.get_rule(data={"match": MatchType.IS_SET, "key": "missing"})
        self.assertDoesNotPass(rule, event)

    def test_is_not_set(self):
        event = self.get_event()
        rule = self.get_rule(data={"match": MatchType.NOT_SET, "key": "logger"})
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(data={"match": MatchType.NOT_SET, "key": "missing"})
        self.assertPasses(rule, event)

    def test_latest_release(self):
        event = self.get_event()
        oldRelease = Release.objects.create(
            organization_id=self.organization.id,
            version="1",
            date_added=datetime(2020, 9, 1, 3, 8, 24, 880386),
        )
        oldRelease.add_project(self.project)

        newRelease = Release.objects.create(
            organization_id=self.organization.id,
            version="2",
            date_added=datetime(2020, 9, 2, 3, 8, 24, 880386),
        )
        newRelease.add_project(self.project)

        event.data["tags"] = (("release", newRelease.version),)
        rule = self.get_rule(data={"match": MatchType.EQUAL, "key": "release", "value": "latest"})
        self.assertPasses(rule, event)

    def test_latest_release_no_match(self):
        event = self.get_event()
        oldRelease = Release.objects.create(
            organization_id=self.organization.id,
            version="1",
            date_added=datetime(2020, 9, 1, 3, 8, 24, 880386),
        )
        oldRelease.add_project(self.project)

        newRelease = Release.objects.create(
            organization_id=self.organization.id,
            version="2",
            date_added=datetime(2020, 9, 2, 3, 8, 24, 880386),
        )
        newRelease.add_project(self.project)

        event.data["tags"] = (("release", oldRelease.version),)
        rule = self.get_rule(data={"match": MatchType.EQUAL, "key": "release", "value": "latest"})
        self.assertDoesNotPass(rule, event)

    def test_caching(self):
        event = self.get_event()
        oldRelease = Release.objects.create(
            organization_id=self.organization.id,
            version="1",
            date_added=datetime(2020, 9, 1, 3, 8, 24, 880386),
        )
        oldRelease.add_project(self.project)
        event.data["tags"] = (("release", oldRelease.version),)
        rule = self.get_rule(data={"match": MatchType.EQUAL, "key": "release", "value": "latest"})
        self.assertPasses(rule, event)

        newRelease = Release.objects.create(
            organization_id=self.organization.id,
            version="2",
            date_added=datetime(2020, 9, 2, 3, 8, 24, 880386),
        )
        newRelease.add_project(self.project)
        # confirm the rule still passes on an old release due to caching
        self.assertPasses(rule, event)

        # now send the appropriate signal to trigger cache clear
        release_created.send_robust(release=newRelease, sender=self.__class__)
        # now that cache is cleared rule should not pass on an old release
        self.assertDoesNotPass(rule, event)
