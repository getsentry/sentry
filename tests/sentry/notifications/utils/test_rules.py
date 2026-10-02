from sentry.models.project import Project
from sentry.notifications.types import NotificationRule
from sentry.notifications.utils.rules import get_rule_or_workflow_id


def _rule(*, legacy_rule_id: int | None, workflow_id: int | None) -> NotificationRule:
    return NotificationRule(
        action_id=None,
        label="Test rule",
        data={"actions": [{}]},
        project=Project(id=1),
        environment_id=None,
        workflow_id=workflow_id,
        legacy_rule_id=legacy_rule_id,
    )


def test_get_rule_or_workflow_id_prefers_legacy_rule_id_by_default() -> None:
    rule = _rule(legacy_rule_id=1, workflow_id=2)
    assert get_rule_or_workflow_id(rule) == ("legacy_rule_id", "1")


def test_get_rule_or_workflow_id_prefer_workflow() -> None:
    rule = _rule(legacy_rule_id=1, workflow_id=2)
    assert get_rule_or_workflow_id(rule, prefer="workflow_id") == ("workflow_id", "2")


def test_get_rule_or_workflow_id_falls_back_to_available_id() -> None:
    assert get_rule_or_workflow_id(
        _rule(legacy_rule_id=1, workflow_id=None), prefer="workflow_id"
    ) == (
        "legacy_rule_id",
        "1",
    )
    assert get_rule_or_workflow_id(_rule(legacy_rule_id=None, workflow_id=2)) == (
        "workflow_id",
        "2",
    )
