from collections import defaultdict
from typing import Any, DefaultDict

from sentry.api.serializers.models.rule import generate_rule_label
from sentry.models.environment import Environment
from sentry.models.rule import Rule

ONE_HOUR = 60
ONE_DAY = ONE_HOUR * 24
ONE_WEEK = ONE_DAY * 7


def get_updated_rule_data(rule: Rule) -> dict[str, Any]:
    rule_data = dict(rule.data)
    if rule.environment_id:
        rule_data["environment_id"] = rule.environment_id
    if rule.owner:
        rule_data["owner"] = rule.owner
    rule_data["label"] = rule.label
    return rule_data


def check_value_changed(
    present_state: dict[str, Any], prior_state: dict[str, Any], key: str, word: str
) -> str | None:
    if present_state.get(key) != prior_state.get(key):
        old_value = prior_state.get(key)
        new_value = present_state.get(key)
        return f"Changed {word} from *{old_value}* to *{new_value}*"
    return None


def generate_diff_labels(
    present_state: dict[str, Any],
    prior_state: dict[str, Any],
    rule: Rule,
    changed_data: DefaultDict[str, list[str]],
    key: str,
    statement: str,
) -> DefaultDict[str, list[str]]:
    for data in prior_state.get(key, []):
        if data not in present_state.get(key, []):
            label = generate_rule_label(rule.project, rule, data)
            changed_data[data["id"]].append(statement.format(label))

    return changed_data


def get_frequency_label(value: str) -> str | None:
    if not value:
        return None

    value = int(value)
    if value < 60:
        return f"{value} minutes"
    elif value >= 60 and value < 10080:
        return f"{int(value / ONE_HOUR)} hours"
    elif value == ONE_WEEK:
        return f"{int(value / ONE_WEEK)} week"
    elif value == ONE_DAY * 30:
        return f"{int(value / ONE_DAY)} days"
    return None


def get_changed_data(
    rule: Rule, rule_data: dict[str, Any], rule_data_before: dict[str, Any]
) -> dict[str, Any]:
    """
    Generate a list per type of issue alert rule data of what changes occurred on edit.
    """
    changed_data: DefaultDict[str, list[str]] = defaultdict(list)
    changed_data = generate_diff_labels(
        rule_data_before, rule_data, rule, changed_data, "conditions", "Added condition '{}'"
    )
    changed_data = generate_diff_labels(
        rule_data, rule_data_before, rule, changed_data, "conditions", "Removed condition '{}'"
    )
    changed_data = generate_diff_labels(
        rule_data_before, rule_data, rule, changed_data, "actions", "Added action '{}'"
    )
    changed_data = generate_diff_labels(
        rule_data, rule_data_before, rule, changed_data, "actions", "Removed action '{}'"
    )

    current_frequency = get_frequency_label(rule_data.get("frequency"))
    previous_frequency = get_frequency_label(rule_data_before.get("frequency"))
    if current_frequency != previous_frequency:
        frequency_text = f"Changed frequency from *{previous_frequency}* to *{current_frequency}*"
        changed_data["changed_frequency"].append(frequency_text)

    if rule_data.get("environment_id") and not rule_data_before.get("environment_id"):
        environment = None
        try:
            environment = Environment.objects.get(id=rule_data.get("environment_id"))
        except Environment.DoesNotExist:
            pass

        if environment:
            changed_data["environment"].append(f"Added *{environment.name}* environment")

    if rule_data_before.get("environment_id") and not rule_data.get("environment_id"):
        environment = None
        try:
            environment = Environment.objects.get(id=rule_data.get("environment_id"))
        except Environment.DoesNotExist:
            pass

        if environment:
            changed_data["environment"].append(f"Removed *{environment.name}* environment")

    label_text = check_value_changed(rule_data, rule_data_before, "label", "rule name")
    if label_text:
        changed_data["changed_label"].append(label_text)

    action_match_text = check_value_changed(rule_data, rule_data_before, "action_match", "trigger")
    if action_match_text:
        changed_data["action_match"].append(action_match_text)

    filter_match_text = check_value_changed(rule_data, rule_data_before, "filter_match", "filter")
    if filter_match_text:
        changed_data["filter_match"].append(filter_match_text)

    if rule_data_before.get("owner") != rule_data.get("owner"):
        old_owner = rule_data_before.get("owner")
        old_actor = "Unassigned"
        if old_owner:
            old_actor = old_owner.resolve()

        new_owner = rule_data.get("owner")
        new_actor = "Unassigned"
        if new_owner:
            new_actor = new_owner.resolve()
        owner_changed_text = f"Changed owner from *{old_actor}* to *{new_actor}*"
        changed_data["owner"].append(owner_changed_text)

    return changed_data
