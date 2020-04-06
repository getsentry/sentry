from __future__ import absolute_import

import copy
import six

import sentry_relay
from rest_framework import serializers

from sentry import features
from sentry.utils import metrics


def _escape_key(key):
    """
    Attempt to escape the key for PII config path selectors.

    If this fails and we cannot represent the key, return None
    """

    return u"'{}'".format(key.replace("'", "''"))


def get_all_pii_configs(project_config):
    # Note: This logic is duplicated in Relay store.
    pii_config = project_config.config["piiConfig"]
    if pii_config:
        yield pii_config

    yield sentry_relay.convert_datascrubbing_config(project_config.config["datascrubbingSettings"])


def scrub_data(project_config, event):
    for config in get_all_pii_configs(project_config):
        metrics.timing(
            "datascrubbing.config.num_applications", len(config.get("applications") or ())
        )
        total_rules = 0
        for selector, rules in six.iteritems(config.get("applications") or {}):
            metrics.timing("datascrubbing.config.selectors.size", len(selector))
            metrics.timing("datascrubbing.config.rules_per_selector.size", len(rules))
            total_rules += len(rules)

        metrics.timing("datascrubbing.config.rules.size", total_rules)

        event = sentry_relay.pii_strip_event(config, event)

    return event


def merge_pii_configs(prefixes_and_configs):
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
        for rule_name, rule in six.iteritems(rules):
            prefixed_rule_name = "{}{}".format(prefix, rule_name)
            merged_config.setdefault("rules", {})[
                prefixed_rule_name
            ] = _prefix_rule_references_in_rule(rules, rule, prefix)

        for selector, applications in six.iteritems(partial_config.get("applications") or {}):
            merged_applications = merged_config.setdefault("applications", {}).setdefault(
                selector, []
            )

            for application in applications:
                if application in rules:
                    prefixed_rule_name = "{}{}".format(prefix, application)
                    merged_applications.append(prefixed_rule_name)
                else:
                    merged_applications.append(application)

    return merged_config


def validate_pii_config_update(organization, value):
    if not value:
        return value

    has_datascrubbers_v2 = features.has("organizations:datascrubbers-v2", organization)
    if not has_datascrubbers_v2:
        raise serializers.ValidationError(
            "Organization does not have the datascrubbers-v2 feature enabled"
        )

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
            "{}{}".format(prefix, x) if x in custom_rules else x for x in rule_def["rules"]
        )
    elif (
        rule_def.get("type") == "multiple"
        and rule_def.get("rule")
        and rule_def["rule"] in custom_rules
    ):
        rule_def = copy.deepcopy(rule_def)
        rule_def["rule"] = "{}{}".format(prefix, rule_def["rule"])

    return rule_def
