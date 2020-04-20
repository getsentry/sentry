# -*- coding: utf-8 -*-

from __future__ import absolute_import

from datetime import timedelta
from django.utils import timezone

from sentry.models import GroupRuleStatus, Rule, GroupStatus
from sentry.mail.actions import ActionTargetType
from sentry.testutils import TestCase
from sentry.rules.processor import RuleProcessor


class RuleProcessorTest(TestCase):
    def setUp(self):
        self.event = self.store_event(data={}, project_id=self.project.id)

        action_data = {
            "id": "sentry.mail.actions.NotifyEmailAction",
            "targetType": ActionTargetType.ISSUE_OWNERS.value,
            "targetIdentifier": None,
        }
        condition_data = {"id": "sentry.rules.conditions.every_event.EveryEventCondition"}

        Rule.objects.filter(project=self.event.project).delete()
        self.rule = Rule.objects.create(
            project=self.event.project,
            data={"conditions": [condition_data], "actions": [action_data]},
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
