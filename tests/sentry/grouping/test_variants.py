from __future__ import absolute_import, print_function

import os
import pytest

from sentry import eventstore
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping
from sentry.event_manager import EventManager
from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.grouping.enhancer import Enhancements
from sentry.grouping.api import get_default_grouping_config_dict, load_grouping_config
from sentry.utils import json


def dump_variant(variant, lines=None, indent=0):
    if lines is None:
        lines = []

    def _dump_component(component, indent):
        if not component.hint and not component.values:
            return
        lines.append(
            "%s%s%s%s"
            % (
                "  " * indent,
                component.id,
                component.contributes and "*" or "",
                component.hint and " (%s)" % component.hint or "",
            )
        )
        for value in component.values:
            if isinstance(value, GroupingComponent):
                _dump_component(value, indent + 1)
            else:
                lines.append("%s%s" % ("  " * (indent + 1), json.dumps(value)))

    lines.append("%shash: %s" % ("  " * indent, json.dumps(variant.get_hash())))
    for (key, value) in sorted(variant.__dict__.items()):
        if isinstance(value, GroupingComponent):
            lines.append("%s%s:" % ("  " * indent, key))
            _dump_component(value, indent + 1)
        elif key == "config":
            # We do not want to dump the config
            continue
        else:
            lines.append("%s%s: %s" % ("  " * indent, key, json.dumps(value)))

    return lines


_fixture_path = os.path.join(os.path.dirname(__file__), "grouping_inputs")


def load_configs():
    configs = CONFIGURATIONS.keys()

    rv = []
    for filename in os.listdir(_fixture_path):
        if filename.endswith(".json"):
            for config in configs:
                rv.append((config, filename[:-5]))

    rv.sort()

    return rv


@pytest.mark.parametrize(
    "config_name,test_name",
    load_configs(),
    ids=lambda x: x.replace("-", "_"),  # Nicer folder structure for insta_snapshot
)
def test_event_hash_variant(insta_snapshot, config_name, test_name, log):
    with open(os.path.join(_fixture_path, test_name + ".json")) as f:
        input = json.load(f)

    # Customize grouping config from the _grouping config
    grouping_config = get_default_grouping_config_dict(config_name)
    grouping_info = input.pop("_grouping", None) or {}
    enhancement_base = grouping_info.get("enhancement_base")
    enhancements = grouping_info.get("enhancements")
    if enhancement_base or enhancements:
        enhancement_bases = [enhancement_base] if enhancement_base else []
        e = Enhancements.from_config_string(enhancements or "", bases=enhancement_bases)
        grouping_config["enhancements"] = e.dumps()

    # Normalize the event
    mgr = EventManager(data=input, grouping_config=grouping_config)
    mgr.normalize()
    data = mgr.get_data()

    # Normalize the stacktrace for grouping.  This normally happens in
    # save()
    normalize_stacktraces_for_grouping(data, load_grouping_config(grouping_config))
    evt = eventstore.create_event(data=data)

    # Make sure we don't need to touch the DB here because this would
    # break stuff later on.
    evt.project = None

    rv = []
    for (key, value) in sorted(evt.get_grouping_variants().items()):
        if rv:
            rv.append("-" * 74)
        rv.append("%s:" % key)
        dump_variant(value, rv, 1)
    output = "\n".join(rv)
    log(repr(evt.get_hashes()))

    assert evt.get_grouping_config() == grouping_config

    insta_snapshot(output)
