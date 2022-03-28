from __future__ import annotations

from sentry.rules import EventState

from .base import TestCase


class RuleTestCase(TestCase):
    rule_cls = None

    def get_event(self):
        return self.event

    def get_rule(self, **kwargs):
        kwargs.setdefault("project", self.project)
        kwargs.setdefault("data", {})
        return self.rule_cls(**kwargs)

    def get_state(self, **kwargs):
        kwargs.setdefault("is_new", True)
        kwargs.setdefault("is_regression", True)
        kwargs.setdefault("is_new_group_environment", True)
        kwargs.setdefault("has_reappeared", True)
        return EventState(**kwargs)

    def assertPasses(self, rule, event=None, **kwargs):
        if event is None:
            event = self.event
        state = self.get_state(**kwargs)
        assert rule.passes(event, state) is True

    def assertDoesNotPass(self, rule, event=None, **kwargs):
        if event is None:
            event = self.event
        state = self.get_state(**kwargs)
        assert rule.passes(event, state) is False
