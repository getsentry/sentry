import copy

import sentry_relay
from rest_framework import serializers

from sentry.utils import json, metrics
from sentry.utils.safe import safe_execute


def _escape_key(key):
    """
    Attempt to escape the key for PII config path selectors.

    If this fails and we cannot represent the key, return None
    """

    return "'{}'".format(key.replace("'", "''"))


def get_pii_config(project):
    def _decode(value):
        if value:
            return safe_execute(json.loads, value)

    # Order of merging is important here. We want to apply organization rules
    # before project rules. For example:
    #
    # * Organization rule: remove substrings "mypassword"
    # * Project rule: remove substrings "my"
    #
    # If we were to apply project rules before organization rules, "password"
    # would leak. We effectively disabled an organization rule using a project rule.
    #
    # Of course organization rules can also break project rules the same way,
    # but we communicate in the UI that organization options take precedence
    # here.
    return _merge_pii_configs(
        [
            ("organization:", _decode(project.organization.get_option("sentry:relay_pii_config"))),
            ("project:", _decode(project.get_option("sentry:relay_pii_config"))),
        ]
    )


def get_datascrubbing_settings(project):
    org = project.organization
    rv = {}

    exclude_fields_key = "sentry:safe_fields"
    rv["excludeFields"] = org.get_option(exclude_fields_key, []) + project.get_option(
        exclude_fields_key, []
    )

    rv["scrubData"] = org.get_option("sentry:require_scrub_data", False) or project.get_option(
        "sentry:scrub_data", True
    )

    rv["scrubIpAddresses"] = org.get_option(
        "sentry:require_scrub_ip_address", False
    ) or project.get_option("sentry:scrub_ip_address", False)

    sensitive_fields_key = "sentry:sensitive_fields"
    rv["sensitiveFields"] = org.get_option(sensitive_fields_key, []) + project.get_option(
        sensitive_fields_key, []
    )

    rv["scrubDefaults"] = org.get_option(
        "sentry:require_scrub_defaults", False
    ) or project.get_option("sentry:scrub_defaults", True)

    return rv


def get_all_pii_configs(project):
    # Note: This logic is duplicated in Relay store.
    pii_config = get_pii_config(project)
    if pii_config:
        yield pii_config

    yield sentry_relay.convert_datascrubbing_config(get_datascrubbing_settings(project))


def scrub_data(project, event):
    for config in get_all_pii_configs(project):
        metrics.timing(
            "datascrubbing.config.num_applications", len(config.get("applications") or ())
        )
        total_rules = 0
        for selector, rules in (config.get("applications") or {}).items():
            metrics.timing("datascrubbing.config.selectors.size", len(selector))
            metrics.timing("datascrubbing.config.rules_per_selector.size", len(rules))
            total_rules += len(rules)

        metrics.timing("datascrubbing.config.rules.size", total_rules)

        event = sentry_relay.pii_strip_event(config, event)

    return event


def _merge_pii_configs(prefixes_and_configs):
    """
    Merge two PII configs into one, prefixing all custom rules with a prefix in the name.

    This is used to apply organization and project configs at once,
    and still get unique references to rule names.
    """
    merged_config = {}

    for prefix, partial_config in prefixes_and_configs:
        if not partial_config:
            continue

        rules = partial_config.get("rules") or {}
        for rule_name, rule in rules.items():
            prefixed_rule_name = f"{prefix}{rule_name}"
            merged_config.setdefault("rules", {})[
                prefixed_rule_name
            ] = _prefix_rule_references_in_rule(rules, rule, prefix)

        for selector, applications in (partial_config.get("applications") or {}).items():
            merged_applications = merged_config.setdefault("applications", {}).setdefault(
                selector, []
            )

            for application in applications:
                if application in rules:
                    prefixed_rule_name = f"{prefix}{application}"
                    merged_applications.append(prefixed_rule_name)
                else:
                    merged_applications.append(application)

    return merged_config


def validate_pii_config_update(organization, value):
    if not value:
        return value

    try:
        sentry_relay.validate_pii_config(value)
    except ValueError as e:
        raise serializers.ValidationError(e)

    return value


def _prefix_rule_references_in_rule(custom_rules, rule_def, prefix):
    if not isinstance(rule_def, dict):
        return rule_def

    if rule_def.get("type") == "multiple" and rule_def.get("rules"):
        rule_def = copy.deepcopy(rule_def)
        rule_def["rules"] = list(
            f"{prefix}{x}" if x in custom_rules else x for x in rule_def["rules"]
        )
    elif (
        rule_def.get("type") == "multiple"
        and rule_def.get("rule")
        and rule_def["rule"] in custom_rules
    ):
        rule_def = copy.deepcopy(rule_def)
        rule_def["rule"] = "{}{}".format(prefix, rule_def["rule"])

    return rule_def
