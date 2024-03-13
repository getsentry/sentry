from collections import defaultdict
from typing import Any, DefaultDict

from sentry.api.serializers.models.rule import generate_rule_label
from sentry.models.environment import Environment
from sentry.models.rule import Rule


def get_updated_rule_data(rule: Rule) -> dict[str, Any]:
    rule_data = dict(rule.data)
    if rule.environment_id:
        rule_data["environment_id"] = rule.environment_id
    if rule.owner:
        rule_data["owner"] = rule.owner
    rule_data["label"] = rule.label
    return rule_data


def check_value_changed(
    rule_data: dict[str, Any], rule_data_before: dict[str, Any], key: str, word: str
) -> str:
    if rule_data.get(key) != rule_data_before.get(key):
        old_value = rule_data_before.get(key)
        new_value = rule_data.get(key)
        return f"Changed {word} from *{old_value}* to *{new_value}*"
    return ""


def check_added_or_removed(
    rule_data_after: dict[str, Any],
    rule_data_before: dict[str, Any],
    rule: Rule,
    changed_data: DefaultDict[str, list[str]],
    key: str,
    rule_section_type: str,
    added: bool,
) -> DefaultDict[str, list[str]]:
    verb = "Added" if added else "Removed"
    for data in rule_data_before.get(key, []):
        if data not in rule_data_after.get(key, []):
            label = generate_rule_label(rule.project, rule, data)
            changed_data[data["id"]].append(f"{verb} {rule_section_type} '{label}'")

    return changed_data


def get_changed_data(
    rule: Rule, rule_data: dict[str, Any], rule_data_before: dict[str, Any]
) -> dict[str, Any]:
    """
    Generate a list per type of issue alert rule data of what changes occurred on edit.
    """
    changed_data = defaultdict(list)
    changed_data = check_added_or_removed(
        rule_data_before, rule_data, rule, changed_data, "conditions", "condition", added=True
    )
    changed_data = check_added_or_removed(
        rule_data, rule_data_before, rule, changed_data, "conditions", "condition", added=False
    )
    changed_data = check_added_or_removed(
        rule_data_before, rule_data, rule, changed_data, "actions", "action", added=True
    )
    changed_data = check_added_or_removed(
        rule_data, rule_data_before, rule, changed_data, "actions", "action", added=False
    )

    frequency_text = check_value_changed(rule_data, rule_data_before, "frequency", "frequency")
    if frequency_text:
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
