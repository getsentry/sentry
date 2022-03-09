from datetime import datetime, timedelta
from unittest import mock
from unittest.mock import patch

from django.core.cache import cache
from django.db import DEFAULT_DB_ALIAS, connections
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from sentry.models import GroupRuleStatus, GroupStatus, Rule, RuleFireHistory
from sentry.notifications.types import ActionTargetType
from sentry.rules import init_registry
from sentry.rules.conditions import EventCondition
from sentry.rules.filters.base import EventFilter
from sentry.rules.processor import RuleProcessor
from sentry.testutils import TestCase

EMAIL_ACTION_DATA = {
    "id": "sentry.mail.actions.NotifyEmailAction",
    "targetType": ActionTargetType.ISSUE_OWNERS.value,
    "targetIdentifier": None,
}

EVERY_EVENT_COND_DATA = {"id": "sentry.rules.conditions.every_event.EveryEventCondition"}


class MockConditionTrue(EventCondition):
    def passes(self, event, state):
        return True


class RuleProcessorTest(TestCase):
    def setUp(self):
        self.event = self.store_event(data={}, project_id=self.project.id)

        Rule.objects.filter(project=self.event.project).delete()
        self.rule = Rule.objects.create(
            project=self.event.project,
            data={"conditions": [EVERY_EVENT_COND_DATA], "actions": [EMAIL_ACTION_DATA]},
        )

    # this test relies on a few other tests passing
    def test_integrated(self):
        rp = RuleProcessor(
            self.event,
            is_new=True,
            is_regression=True,
            is_new_group_environment=True,
            has_reappeared=True,
        )
        results = list(rp.apply())
        assert len(results) == 1
        callback, futures = results[0]
        assert len(futures) == 1
        assert futures[0].rule == self.rule
        assert futures[0].kwargs == {}
        assert RuleFireHistory.objects.filter(rule=self.rule, group=self.event.group).count() == 1

        # should not apply twice due to default frequency
        results = list(rp.apply())
        assert len(results) == 0
        assert RuleFireHistory.objects.filter(rule=self.rule, group=self.event.group).count() == 1

        # now ensure that moving the last update backwards
        # in time causes the rule to trigger again
        GroupRuleStatus.objects.filter(rule=self.rule).update(
            last_active=timezone.now() - timedelta(minutes=Rule.DEFAULT_FREQUENCY + 1)
        )

        results = list(rp.apply())
        assert len(results) == 1
        assert RuleFireHistory.objects.filter(rule=self.rule, group=self.event.group).count() == 2

    def test_ignored_issue(self):
        self.event.group.status = GroupStatus.IGNORED
        self.event.group.save()
        rp = RuleProcessor(
            self.event,
            is_new=True,
            is_regression=True,
            is_new_group_environment=True,
            has_reappeared=True,
        )
        results = list(rp.apply())
        assert len(results) == 0

    def test_resolved_issue(self):
        self.event.group.status = GroupStatus.RESOLVED
        self.event.group.save()
        rp = RuleProcessor(
            self.event,
            is_new=True,
            is_regression=True,
            is_new_group_environment=True,
            has_reappeared=True,
        )
        results = list(rp.apply())
        assert len(results) == 0

    def run_query_test(self, rp, expected_queries):
        with CaptureQueriesContext(connections[DEFAULT_DB_ALIAS]) as queries:
            results = list(rp.apply())
        status_queries = [
            q
            for q in queries.captured_queries
            if "grouprulestatus" in str(q) and "UPDATE" not in str(q)
        ]
        assert len(status_queries) == expected_queries, "\n".join(
            "%d. %s" % (i, query["sql"]) for i, query in enumerate(status_queries, start=1)
        )
        assert len(results) == 2

    def test_multiple_rules(self):
        rule_2 = Rule.objects.create(
            project=self.event.project,
            data={"conditions": [EVERY_EVENT_COND_DATA], "actions": [EMAIL_ACTION_DATA]},
        )
        rp = RuleProcessor(
            self.event,
            is_new=True,
            is_regression=True,
            is_new_group_environment=True,
            has_reappeared=True,
        )
        self.run_query_test(rp, 3)

        GroupRuleStatus.objects.filter(rule__in=[self.rule, rule_2]).update(
            last_active=timezone.now() - timedelta(minutes=Rule.DEFAULT_FREQUENCY + 1)
        )

        # GroupRuleStatus queries should be cached
        self.run_query_test(rp, 0)

        cache.clear()
        GroupRuleStatus.objects.filter(rule__in=[self.rule, rule_2]).update(
            last_active=timezone.now() - timedelta(minutes=Rule.DEFAULT_FREQUENCY + 1)
        )

        # GroupRuleStatus rows should be created, so we should perform two fewer queries since we
        # don't need to create/fetch the rows
        self.run_query_test(rp, 1)

        cache.clear()
        GroupRuleStatus.objects.filter(rule__in=[self.rule, rule_2]).update(
            last_active=timezone.now() - timedelta(minutes=Rule.DEFAULT_FREQUENCY + 1)
        )

        # Test that we don't get errors if we try to create statuses that already exist due to a
        # race condition
        with mock.patch("sentry.rules.processor.GroupRuleStatus") as mocked_GroupRuleStatus:
            call_count = 0

            def mock_filter(*args, **kwargs):
                nonlocal call_count
                if call_count == 0:
                    call_count += 1
                    # Make a query here to not throw the query counts off
                    return GroupRuleStatus.objects.filter(id=-1)
                return GroupRuleStatus.objects.filter(*args, **kwargs)

            mocked_GroupRuleStatus.objects.filter.side_effect = mock_filter
            # Even though the rows already exist, we should go through the creation step and make
            # the extra queries. The conflicting insert doesn't seem to be counted here since it
            # creates no rows.
            self.run_query_test(rp, 2)

    @patch(
        "sentry.constants._SENTRY_RULES",
        [
            "sentry.mail.actions.NotifyEmailAction",
            "sentry.rules.conditions.event_frequency.EventFrequencyCondition",
            "tests.sentry.rules.test_processor.MockConditionTrue",
        ],
    )
    def test_slow_conditions_evaluate_last(self):
        # Make sure slow/expensive conditions are evaluated last, so that we can skip evaluating
        # them if cheaper conditions satisfy the rule.
        self.rule.update(
            data={
                "conditions": [
                    {"id": "sentry.rules.conditions.event_frequency.EventFrequencyCondition"},
                    {"id": "tests.sentry.rules.test_processor.MockConditionTrue"},
                ],
                "action_match": "any",
                "actions": [EMAIL_ACTION_DATA],
            },
        )
        with patch("sentry.rules.processor.rules", init_registry()), patch(
            "sentry.rules.conditions.event_frequency.BaseEventFrequencyCondition.passes"
        ) as passes:
            rp = RuleProcessor(
                self.event,
                is_new=True,
                is_regression=True,
                is_new_group_environment=True,
                has_reappeared=True,
            )
            results = rp.apply()
        assert len(results) == 1
        # We should never call `passes` on the frequency condition since we should run the cheap
        # mock condition first.
        assert passes.call_count == 0


# mock filter which always passes
class MockFilterTrue(EventFilter):
    def passes(self, event, state):
        return True


# mock filter which never passes
class MockFilterFalse(EventFilter):
    def passes(self, event, state):
        return False


class RuleProcessorTestFilters(TestCase):
    MOCK_SENTRY_RULES_WITH_FILTERS = (
        "sentry.mail.actions.NotifyEmailAction",
        "sentry.rules.conditions.every_event.EveryEventCondition",
        "tests.sentry.rules.test_processor.MockFilterTrue",
        "tests.sentry.rules.test_processor.MockFilterFalse",
    )

    @patch("sentry.constants._SENTRY_RULES", MOCK_SENTRY_RULES_WITH_FILTERS)
    def test_filter_passes(self):
        # setup a simple alert rule with 1 condition and 1 filter that always pass
        self.event = self.store_event(data={}, project_id=self.project.id)

        filter_data = {"id": "tests.sentry.rules.test_processor.MockFilterTrue"}

        Rule.objects.filter(project=self.event.project).delete()
        self.rule = Rule.objects.create(
            project=self.event.project,
            data={
                "conditions": [EVERY_EVENT_COND_DATA, filter_data],
                "actions": [EMAIL_ACTION_DATA],
            },
        )
        # patch the rule registry to contain the mocked rules
        with patch("sentry.rules.processor.rules", init_registry()):
            rp = RuleProcessor(
                self.event,
                is_new=True,
                is_regression=True,
                is_new_group_environment=True,
                has_reappeared=True,
            )
            results = list(rp.apply())
            assert len(results) == 1
            callback, futures = results[0]
            assert len(futures) == 1
            assert futures[0].rule == self.rule
            assert futures[0].kwargs == {}

    @patch("sentry.constants._SENTRY_RULES", MOCK_SENTRY_RULES_WITH_FILTERS)
    def test_filter_fails(self):
        # setup a simple alert rule with 1 condition and 1 filter that doesn't pass
        self.event = self.store_event(data={}, project_id=self.project.id)

        filter_data = {"id": "tests.sentry.rules.test_processor.MockFilterFalse"}

        Rule.objects.filter(project=self.event.project).delete()
        self.rule = Rule.objects.create(
            project=self.event.project,
            data={
                "conditions": [EVERY_EVENT_COND_DATA, filter_data],
                "actions": [EMAIL_ACTION_DATA],
            },
        )
        # patch the rule registry to contain the mocked rules
        with patch("sentry.rules.processor.rules", init_registry()):
            rp = RuleProcessor(
                self.event,
                is_new=True,
                is_regression=True,
                is_new_group_environment=True,
                has_reappeared=True,
            )
            results = list(rp.apply())
            assert len(results) == 0

    def test_no_filters(self):
        # setup an alert rule with 1 conditions and no filters that passes
        self.event = self.store_event(data={}, project_id=self.project.id)

        Rule.objects.filter(project=self.event.project).delete()
        self.rule = Rule.objects.create(
            project=self.event.project,
            data={
                "conditions": [EVERY_EVENT_COND_DATA],
                "actions": [EMAIL_ACTION_DATA],
                "filter_match": "any",
            },
        )

        rp = RuleProcessor(
            self.event,
            is_new=True,
            is_regression=True,
            is_new_group_environment=True,
            has_reappeared=True,
        )
        results = list(rp.apply())
        assert len(results) == 1
        callback, futures = results[0]
        assert len(futures) == 1
        assert futures[0].rule == self.rule
        assert futures[0].kwargs == {}

    def test_no_conditions(self):
        # if a rule has no conditions/triggers it should still pass
        self.event = self.store_event(data={}, project_id=self.project.id)

        Rule.objects.filter(project=self.event.project).delete()
        self.rule = Rule.objects.create(
            project=self.event.project,
            data={"actions": [EMAIL_ACTION_DATA], "action_match": "any"},
        )

        rp = RuleProcessor(
            self.event,
            is_new=True,
            is_regression=True,
            is_new_group_environment=True,
            has_reappeared=True,
        )
        results = list(rp.apply())
        assert len(results) == 1
        callback, futures = results[0]
        assert len(futures) == 1
        assert futures[0].rule == self.rule
        assert futures[0].kwargs == {}

    def test_latest_release(self):
        # setup an alert rule with 1 conditions and no filters that passes
        self.create_release(project=self.project, version="2021-02.newRelease")

        self.event = self.store_event(
            data={"release": "2021-02.newRelease"}, project_id=self.project.id
        )

        Rule.objects.filter(project=self.event.project).delete()
        self.rule = Rule.objects.create(
            project=self.event.project,
            data={
                "actions": [EMAIL_ACTION_DATA],
                "filter_match": "any",
                "conditions": [
                    {
                        "id": "sentry.rules.filters.latest_release.LatestReleaseFilter",
                        "name": "The event is from the latest release",
                    },
                ],
            },
        )

        rp = RuleProcessor(
            self.event,
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            has_reappeared=False,
        )
        results = list(rp.apply())
        assert len(results) == 1
        callback, futures = results[0]
        assert len(futures) == 1
        assert futures[0].rule == self.rule
        assert futures[0].kwargs == {}

    def test_latest_release_environment(self):
        # setup an alert rule with 1 conditions and no filters that passes
        release = self.create_release(
            project=self.project,
            version="2021-02.newRelease",
            date_added=datetime(2020, 9, 1, 3, 8, 24, 880386),
            environments=[self.environment],
        )

        self.event = self.store_event(
            data={
                "release": release.version,
                "tags": [["environment", self.environment.name]],
            },
            project_id=self.project.id,
        )

        Rule.objects.filter(project=self.event.project).delete()
        self.rule = Rule.objects.create(
            environment_id=self.environment.id,
            project=self.event.project,
            data={
                "actions": [EMAIL_ACTION_DATA],
                "filter_match": "any",
                "conditions": [
                    {
                        "id": "sentry.rules.filters.latest_release.LatestReleaseFilter",
                        "name": "The event is from the latest release",
                    },
                ],
            },
        )

        rp = RuleProcessor(
            self.event,
            is_new=True,
            is_regression=False,
            is_new_group_environment=True,
            has_reappeared=False,
        )
        results = list(rp.apply())
        assert len(results) == 1
        callback, futures = results[0]
        assert len(futures) == 1
        assert futures[0].rule == self.rule
        assert futures[0].kwargs == {}
