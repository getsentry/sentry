from sentry.models.rule import Rule


def get_key_from_rule_data(rule: Rule, key: str) -> str:
    value = rule.data.get("actions", [{}])[0].get(key)
    assert value is not None
    return value


def get_rule_or_workflow_id(rule: Rule) -> tuple[str, str]:
    try:
        return ("legacy_rule_id", get_key_from_rule_data(rule, "legacy_rule_id"))
    except AssertionError:
        return ("workflow_id", get_key_from_rule_data(rule, "workflow_id"))
