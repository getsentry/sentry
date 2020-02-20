from __future__ import absolute_import

import re
import copy

import sentry_relay
import six

from sentry.utils import metrics
from sentry.utils.canonical import CanonicalKeyDict

_KEY_RE = re.compile(u"^[a-zA-Z0-9_-]+$")


def _escape_key(key):
    """
    Attempt to escape the key for PII config path selectors.

    If this fails and we cannot represent the key, return None
    """
    if _KEY_RE.match(key):
        return key

    # TODO: Quote string here once it's implemented in Relay
    return None


def _path_selectors_from_diff(old_data, data):
    """
    Datascrubbing is not idempotent, so scrubbing the same value
    twice might cause weird glitches. When data scrubbing after
    processing, we can still limit the likelihood of such glitches
    by constraining data scrubbing to fields we saw change.

    This function takes two events and yields a list of path selectors of
    fields that changed.
    """

    if type(old_data) != type(data):
        yield None
        yield u"**"

    elif isinstance(data, (CanonicalKeyDict, dict)):
        for key, value in six.iteritems(data):
            old_value = old_data.get(key)
            key = _escape_key(key)
            if key is None:
                continue

            for selector in _path_selectors_from_diff(old_value, value):
                if selector is not None:
                    yield u"{}.{}".format(key, selector)
                else:
                    yield key

    elif isinstance(data, list):
        for i, value in enumerate(data):
            old_value = old_data[i] if len(old_data) > i else None
            for selector in _path_selectors_from_diff(old_value, value):
                if selector is not None:
                    yield u"{}.{}".format(i, selector)
                else:
                    yield six.text_type(i)

    elif old_data != data:
        yield None


def _narrow_pii_config_for_processing(config, old_event, event):
    if not config.get("applications"):
        return config

    additional_selectors = u"|".join(_path_selectors_from_diff(old_event, event))

    metrics.timing("datascrubbing.config.additional_selectors.size", len(additional_selectors))

    if not additional_selectors:
        # No new data has been added, so we must not scrub
        return {}

    config = copy.deepcopy(config)

    for selector in list(config["applications"]):
        new_selector = u"(({})&{})".format(additional_selectors, selector)
        config["applications"][new_selector] = config["applications"].pop(selector)

    return config


def get_all_pii_configs(project_config):
    # Note: This logic is duplicated in Relay store.
    pii_config = project_config.config["piiConfig"]
    if pii_config:
        yield pii_config

    yield sentry_relay.convert_datascrubbing_config(project_config.config["datascrubbingSettings"])


def scrub_data(project_config, event, in_processing=False, old_event=None):
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

        if in_processing:
            assert old_event is not None
            config = _narrow_pii_config_for_processing(config, old_event, event)
        event = sentry_relay.pii_strip_event(config, event)

    return event
