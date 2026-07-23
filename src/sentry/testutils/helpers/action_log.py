"""Test helper for asserting that actions were published to the action log.

Usage::

    from sentry.testutils.helpers.action_log import capture_action_log

    def test_resolve_emits_action(self) -> None:
        with capture_action_log() as log:
            publish_action(ResolveAction(), source="web", group_id=1, project=self.project)
        log.assert_logged(ResolveAction, group_id=1)
        log.assert_not_logged(ViewAction)
"""

from __future__ import annotations

import dataclasses
from collections.abc import Generator
from contextlib import contextmanager
from typing import Any

from sentry.issues.action_log.publish import _publish_callbacks
from sentry.issues.action_log.types import (
    GroupAction,
    GroupActionActor,
    GroupActionType,
)
from sentry.models.project import Project


@dataclasses.dataclass
class CapturedAction:
    action: GroupAction
    action_type: GroupActionType
    group_id: int
    project: Project
    source: str
    actor: GroupActionActor


class ActionLogCapture:
    def __init__(self) -> None:
        self.actions: list[CapturedAction] = []

    def _matches(
        self,
        captured: CapturedAction,
        action_type: type[GroupAction] | GroupActionType | None = None,
        group_id: int | None = None,
        source: str | None = None,
        actor: GroupActionActor | None = None,
        **action_fields: object,
    ) -> bool:
        if action_type is not None:
            if isinstance(action_type, type) and issubclass(action_type, GroupAction):
                if not isinstance(captured.action, action_type):
                    return False
            elif captured.action_type != action_type:
                return False
        if group_id is not None and captured.group_id != group_id:
            return False
        if source is not None and captured.source != source:
            return False
        if actor is not None and captured.actor != actor:
            return False
        for field, expected in action_fields.items():
            if not hasattr(captured.action, field) or getattr(captured.action, field) != expected:
                return False
        return True

    def _filter(self, **kwargs: Any) -> list[CapturedAction]:
        return [c for c in self.actions if self._matches(c, **kwargs)]

    def assert_logged(
        self,
        action_type: type[GroupAction] | GroupActionType,
        *,
        group_id: int | None = None,
        source: str | None = None,
        actor: GroupActionActor | None = None,
        count: int = 1,
        **action_fields: object,
    ) -> CapturedAction | list[CapturedAction]:
        matches = self._filter(
            action_type=action_type,
            group_id=group_id,
            source=source,
            actor=actor,
            **action_fields,
        )
        actual = len(matches)
        if actual != count:
            criteria = [f"action_type={action_type!r}"]
            if group_id is not None:
                criteria.append(f"group_id={group_id}")
            if source is not None:
                criteria.append(f"source={source!r}")
            if actor is not None:
                criteria.append(f"actor={actor!r}")
            for k, v in action_fields.items():
                criteria.append(f"{k}={v!r}")
            all_types = [c.action_type.name for c in self.actions]
            raise AssertionError(
                f"Expected {count} action(s) matching ({', '.join(criteria)}), "
                f"found {actual}. All captured: {all_types}"
            )
        if count == 1:
            return matches[0]
        return matches

    def assert_not_logged(
        self,
        action_type: type[GroupAction] | GroupActionType | None = None,
        *,
        group_id: int | None = None,
        source: str | None = None,
        actor: GroupActionActor | None = None,
        **action_fields: object,
    ) -> None:
        matches = self._filter(
            action_type=action_type,
            group_id=group_id,
            source=source,
            actor=actor,
            **action_fields,
        )
        if matches:
            matched_types = [c.action_type.name for c in matches]
            raise AssertionError(
                f"Expected no matching actions, found {len(matches)}: {matched_types}"
            )

    def for_group(self, group_id: int) -> list[CapturedAction]:
        return self._filter(group_id=group_id)


@contextmanager
def capture_action_log() -> Generator[ActionLogCapture]:
    """Capture all publish_action calls within the block via a ContextVar callback."""
    capture = ActionLogCapture()

    def _on_publish(
        action: GroupAction,
        source: str,
        group_id: int,
        project: Project,
        actor: GroupActionActor,
    ) -> None:
        capture.actions.append(
            CapturedAction(
                action=action,
                action_type=action.get_type(),
                group_id=group_id,
                project=project,
                source=source,
                actor=actor,
            )
        )

    token = _publish_callbacks.set(_publish_callbacks.get() + (_on_publish,))
    try:
        yield capture
    finally:
        _publish_callbacks.reset(token)
