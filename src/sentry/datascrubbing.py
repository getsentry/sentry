from __future__ import absolute_import

import sentry_relay
import six

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
