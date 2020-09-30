# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import GroupRuleStatus, Rule, GroupStatus
from sentry.mail.actions import ActionTargetType
from sentry.testutils import TestCase
from sentry.utils.compat.mock import patch
from sentry.rules import init_registry
from sentry.rules.processor import RuleProcessor
from sentry.rules.filters.base import EventFilter

EMAIL_ACTION_DATA = {
    "id": "sentry.mail.actions.NotifyEmailAction",
    "targetType": ActionTargetType.ISSUE_OWNERS.value,
    "targetIdentifier": None,
}

EVERY_EVENT_COND_DATA = {"id": "sentry.rules.conditions.every_event.EveryEventCondition"}


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

        # should not apply twice due to default frequency
        results = list(rp.apply())
        assert len(results) == 0

        # now ensure that moving the last update backwards
        # in time causes the rule to trigger again
        GroupRuleStatus.objects.filter(rule=self.rule).update(
            last_active=timezone.now() - timedelta(minutes=Rule.DEFAULT_FREQUENCY + 1)
        )

        results = list(rp.apply())
        assert len(results) == 1

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

    @patch("sentry.constants.SENTRY_RULES", MOCK_SENTRY_RULES_WITH_FILTERS)
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

    @patch("sentry.constants.SENTRY_RULES", MOCK_SENTRY_RULES_WITH_FILTERS)
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
