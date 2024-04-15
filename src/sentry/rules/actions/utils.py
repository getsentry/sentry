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
    prior_state: dict[str, dict[str, str | int]],
    present_state: dict[str, dict[str, str | int]],
    rule: Rule,
    key: str,
) -> DefaultDict[str, list[str]]:
    added_statement = "Added {} '{}'"
    removed_statement = "Removed {} '{}'"
    changed_data: DefaultDict[str, list[str]] = defaultdict(list)

    prior_ids = set(prior_state.keys())
    present_ids = set(present_state.keys())

    # Added items that are not seen in the prior rule data
    for added_id in present_ids.difference(prior_ids):
        label = generate_rule_label(rule.project, rule, present_state.get(added_id))
        changed_data[added_id].append(added_statement.format(key, label))

    # Check if the id is in both but the data has changed
    for changed_id in set(prior_ids & present_ids):
        if prior_state.get(changed_id) != present_state.get(changed_id):
            old_label = generate_rule_label(rule.project, rule, prior_state.get(changed_id))
            new_label = generate_rule_label(rule.project, rule, present_state.get(changed_id))
            changed_data[changed_id] = [(f"Changed {key} from *{old_label}* to *{new_label}*")]

    # Removed items
    for removed_id in prior_ids.difference(present_ids):
        label = generate_rule_label(rule.project, rule, prior_state.get(removed_id))
        changed_data[removed_id].append(removed_statement.format(key, label))

    return changed_data


def get_frequency_label(value_str: str | None) -> str | None:
    if not value_str:
        return None

    value = int(value_str)
    if value < 60:
        return f"{value} minutes"
    elif value >= 60 and value < 10080:
        return f"{int(value / ONE_HOUR)} hours"
    elif value == ONE_WEEK:
        return f"{int(value / ONE_WEEK)} week"
    elif value == ONE_DAY * 30:
        return f"{int(value / ONE_DAY)} days"
    return None


def convert_data(data: list[dict[str, str | int]]) -> dict[str, dict[str, str | int]]:
    converted_data: dict[str, dict] = {}
    for datum in data:
        converted_data[str(datum.get("id"))] = datum

    return converted_data


def get_changed_data(
    rule: Rule, rule_data: dict[str, Any], rule_data_before: dict[str, Any]
) -> dict[str, Any]:
    """
    Generate a list per type of issue alert rule data of what changes occurred on edit.
    """
    prior_conditions_data = convert_data(rule_data_before.get("conditions", []))
    present_conditions_data = convert_data(rule_data.get("conditions", []))
    changed_conditions = generate_diff_labels(
        prior_conditions_data, present_conditions_data, rule, "condition"
    )

    prior_actions_data = convert_data(rule_data_before.get("actions", []))
    present_actions_data = convert_data(rule_data.get("actions", []))
    changed_actions = generate_diff_labels(prior_actions_data, present_actions_data, rule, "action")

    changed_conditions_actions = {**changed_conditions, **changed_actions}
    changed_data: DefaultDict[str, list[str]] = defaultdict(list, changed_conditions_actions)

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
