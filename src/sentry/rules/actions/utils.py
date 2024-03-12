from collections import defaultdict
from typing import Any

from sentry.api.serializers.models.rule import generate_rule_label
from sentry.models.environment import Environment
from sentry.models.rule import Rule


def get_changed_data(
    rule: Rule, rule_data: dict[str, list[Any]], rule_data_before: dict[str, list[Any]]
) -> dict[str, list[Any]]:
    changed_data = defaultdict(list)

    for condition in rule_data.get("conditions", []):
        if condition not in rule_data_before["conditions"]:
            label = generate_rule_label(rule_data.get("project"), rule, condition)
            changed_data[condition["id"]].append(f"Added condition '{label}'")

    for condition in rule_data_before["conditions"]:
        if condition not in rule_data["conditions"]:
            label = generate_rule_label(rule.project, rule, condition)
            changed_data[condition["id"]].append(f"Removed condition '{label}'")

    for action in rule_data.get("actions", []):
        if action not in rule_data_before["actions"]:
            label = generate_rule_label(rule.project, rule, action)
            changed_data[condition["id"]].append(f"Added action '{label}'")

    for action in rule_data_before["actions"]:
        if action not in rule_data.get("actions", []):
            label = generate_rule_label(rule.project, rule, action)
            changed_data[condition["id"]].append(f"Added action '{label}'")

    if rule_data.get("frequency") != rule_data_before.get("frequency"):
        old_frequency = rule_data_before.get("frequency")
        new_frequency = rule_data.get("frequency")
        changed_data["changed_frequency"].append(
            f"Changed frequency from *{old_frequency}* to *{new_frequency}*"
        )

    if rule_data.get("environment_id") and not rule_data_before.get("environment_id"):
        try:
            environment = Environment.objects.get(id=rule_data.get("environment_id"))
        except Environment.DoesNotExist:
            pass

        if environment:
            changed_data["environment"].append(f"Added *{environment.name}* environment")

    if rule_data_before.get("environment_id") and not rule_data.get("environment_id"):
        try:
            environment = Environment.objects.get(id=rule_data.get("environment_id"))
        except Environment.DoesNotExist:
            pass

        if environment:
            changed_data["environment"].append(f"Removed *{environment.name}* environment")

    if rule_data_before.get("label") != rule_data.get("label"):
        old_label = rule_data_before.get("label")
        new_label = rule_data.get("label")
        changed_data["changed_label"].append(
            f"Changed rule name from *{old_label}* to *{new_label}*"
        )

    if rule_data_before.get("action_match") != rule_data.get("action_match"):
        old_action_match = rule_data_before.get("action_match")
        new_action_match = rule_data.get("action_match")
        action_match_text = f"Changed trigger from *{old_action_match}* to *{new_action_match}*"
        changed_data["action_match"].append(action_match_text)

    if rule_data_before.get("filter_match") != rule_data.get("filter_match"):
        old_action_match = rule_data_before.get("filter_match")
        new_action_match = rule_data.get("filter_match")
        action_match_text = f"Changed filter from *{old_action_match}* to *{new_action_match}*"
        changed_data["filter_match"].append(action_match_text)

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
