from unittest import mock

from sentry.models.rule import Rule
from sentry.notifications.utils.rules import get_rule_or_workflow_id


def _rule(action: dict[str, str]) -> Rule:
    return Rule(id=99, data={"actions": [action]})


@mock.patch("sentry.notifications.utils.rules.options.get", new=mock.Mock(return_value=False))
def test_get_rule_or_workflow_id_prefers_legacy_rule_id_by_default() -> None:
    rule = _rule({"legacy_rule_id": "1", "workflow_id": "2"})
    assert get_rule_or_workflow_id(rule) == ("legacy_rule_id", "1")


@mock.patch("sentry.notifications.utils.rules.options.get", new=mock.Mock(return_value=False))
def test_get_rule_or_workflow_id_prefer_workflow() -> None:
    rule = _rule({"legacy_rule_id": "1", "workflow_id": "2"})
    assert get_rule_or_workflow_id(rule, prefer="workflow_id") == ("workflow_id", "2")


@mock.patch("sentry.notifications.utils.rules.options.get", new=mock.Mock(return_value=False))
def test_get_rule_or_workflow_id_falls_back_to_available_id() -> None:
    assert get_rule_or_workflow_id(_rule({"legacy_rule_id": "1"}), prefer="workflow_id") == (
        "legacy_rule_id",
        "1",
    )
    assert get_rule_or_workflow_id(_rule({"workflow_id": "2"})) == ("workflow_id", "2")


@mock.patch("sentry.notifications.utils.rules.options.get", new=mock.Mock(return_value=False))
def test_get_rule_or_workflow_id_falls_back_to_rule_id() -> None:
    assert get_rule_or_workflow_id(_rule({}), prefer="workflow_id") == ("legacy_rule_id", "99")
