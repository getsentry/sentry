from typing import Any

import pytest

from sentry.issues.action_log import SYSTEM_ACTOR, GroupActionActor, publish_action
from sentry.issues.action_log.types import (
    ActionSource,
    ArchiveAction,
    GroupAction,
    GroupActionType,
    ResolveAction,
    SetPriorityAction,
    ViewAction,
)
from sentry.issues.derived.gate import should_serve_action_log_activity
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.action_log import action_log_activity_enabled, capture_action_log


class TestCaptureActionLog(TestCase):
    def _publish(self, action: GroupAction, **kwargs: Any) -> None:
        defaults: dict[str, Any] = {
            "source": ActionSource.WEB,
            "group_id": 1,
            "project": self.project,
            "actor": GroupActionActor.user(self.user.id),
        }
        defaults.update(kwargs)
        publish_action(action, **defaults)

    def test_captures_action(self) -> None:
        with capture_action_log() as log:
            self._publish(ResolveAction(), group_id=42)
        log.assert_logged(ResolveAction, group_id=42)

    def test_no_actions_captured_outside_scope(self) -> None:
        self._publish(ResolveAction())
        with capture_action_log() as log:
            pass
        log.assert_not_logged()

    def test_assert_logged_fails_on_mismatch(self) -> None:
        with capture_action_log() as log:
            self._publish(ResolveAction())
        with pytest.raises(AssertionError):
            log.assert_logged(ViewAction)

    def test_assert_not_logged_fails_on_match(self) -> None:
        with capture_action_log() as log:
            self._publish(ResolveAction())
        with pytest.raises(AssertionError):
            log.assert_not_logged(ResolveAction)

    def test_filters_by_group_id(self) -> None:
        with capture_action_log() as log:
            self._publish(ViewAction(), group_id=1)
            self._publish(ViewAction(), group_id=2)
        assert len(log.for_group(1)) == 1
        assert len(log.for_group(2)) == 1
        log.assert_logged(ViewAction, group_id=1)
        log.assert_not_logged(ViewAction, group_id=3)

    def test_filters_by_source(self) -> None:
        with capture_action_log() as log:
            self._publish(ResolveAction(), source=ActionSource.MCP)
            self._publish(ResolveAction(), source=ActionSource.SLACK)
        log.assert_logged(ResolveAction, source=ActionSource.MCP)
        log.assert_logged(ResolveAction, source=ActionSource.SLACK)
        log.assert_not_logged(ResolveAction, source=ActionSource.API)

    def test_filters_by_actor(self) -> None:
        actor_a = GroupActionActor.user(10)
        actor_b = GroupActionActor.user(20)
        with capture_action_log() as log:
            self._publish(ResolveAction(), actor=actor_a)
            self._publish(ResolveAction(), actor=actor_b)
        log.assert_logged(ResolveAction, actor=actor_a)
        log.assert_not_logged(ResolveAction, actor=SYSTEM_ACTOR)

    def test_filters_by_action_fields(self) -> None:
        with capture_action_log() as log:
            self._publish(SetPriorityAction(priority="high"))
            self._publish(SetPriorityAction(priority="low"))
        log.assert_logged(SetPriorityAction, priority="high")
        log.assert_logged(SetPriorityAction, priority="low")
        log.assert_not_logged(SetPriorityAction, priority="medium")

    def test_count(self) -> None:
        with capture_action_log() as log:
            self._publish(ViewAction())
            self._publish(ViewAction())
            self._publish(ResolveAction())
        log.assert_logged(ViewAction, count=2)
        log.assert_logged(ResolveAction, count=1)

    def test_accepts_action_type_enum(self) -> None:
        with capture_action_log() as log:
            self._publish(ResolveAction())
        log.assert_logged(GroupActionType.RESOLVE)

    def test_nested_captures(self) -> None:
        with capture_action_log() as outer:
            self._publish(ViewAction())
            with capture_action_log() as inner:
                self._publish(ResolveAction())
            self._publish(ArchiveAction())
        # Inner only sees what happened inside its scope
        inner.assert_logged(ResolveAction)
        inner.assert_not_logged(ViewAction)
        inner.assert_not_logged(ArchiveAction)
        # Outer sees everything including actions during the inner scope
        outer.assert_logged(ViewAction)
        outer.assert_logged(ResolveAction)
        outer.assert_logged(ArchiveAction)


class TestActionLogActivityEnabled(TestCase):
    def test_opens_and_closes_the_gate(self) -> None:
        assert not should_serve_action_log_activity(self.project, self.user)

        with action_log_activity_enabled():
            assert should_serve_action_log_activity(self.project, self.user)

        assert not should_serve_action_log_activity(self.project, self.user)

    @action_log_activity_enabled()
    def test_works_as_a_decorator(self) -> None:
        assert should_serve_action_log_activity(self.project, self.user)

    @action_log_activity_enabled()
    def test_applies_to_every_project(self) -> None:
        assert should_serve_action_log_activity(self.create_project(), self.user)
