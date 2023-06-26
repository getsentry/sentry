import os

import pytest
from django.utils.functional import cached_property

from sentry import eventstore
from sentry.event_manager import EventManager, get_event_type, materialize_metadata
from sentry.grouping.api import apply_server_fingerprinting, load_grouping_config
from sentry.grouping.enhancer import Enhancements
from sentry.grouping.fingerprinting import FingerprintingRules
from sentry.stacktraces.processing import normalize_stacktraces_for_grouping
from sentry.utils import json

_grouping_fixture_path = os.path.join(os.path.dirname(__file__), "grouping_inputs")


class GroupingInput:
    def __init__(self, filename):
        self.filename = filename

    @cached_property
    def data(self):
        with open(os.path.join(_grouping_fixture_path, self.filename)) as f:
            return json.load(f)

    def create_event(self, grouping_config):
        grouping_input = dict(self.data)
        # Customize grouping config from the _grouping config
        grouping_info = grouping_input.pop("_grouping", None) or {}
        enhancements = grouping_info.get("enhancements")
        if enhancements:
            enhancement_bases = Enhancements.loads(grouping_config["enhancements"]).bases
            e = Enhancements.from_config_string(enhancements or "", bases=enhancement_bases)
            grouping_config["enhancements"] = e.dumps()

        # Normalize the event
        mgr = EventManager(data=grouping_input, grouping_config=grouping_config)
        mgr.normalize()
        data = mgr.get_data()

        # Normalize the stacktrace for grouping.  This normally happens in
        # save()
        normalize_stacktraces_for_grouping(data, load_grouping_config(grouping_config))
        evt = eventstore.backend.create_event(data=data)

        return evt


grouping_input = list(
    GroupingInput(filename)
    for filename in os.listdir(_grouping_fixture_path)
    if filename.endswith(".json")
)


def with_grouping_input(name):
    return pytest.mark.parametrize(
        name, grouping_input, ids=lambda x: x.filename[:-5].replace("-", "_")
    )


_fingerprint_fixture_path = os.path.join(os.path.dirname(__file__), "fingerprint_inputs")


class FingerprintInput:
    def __init__(self, filename):
        self.filename = filename

    @cached_property
    def data(self):
        with open(os.path.join(_fingerprint_fixture_path, self.filename)) as f:
            return json.load(f)

    def create_event(self, grouping_config=None):
        input = dict(self.data)

        config = FingerprintingRules.from_json(
            {"rules": input.pop("_fingerprinting_rules"), "version": 1}
        )
        mgr = EventManager(data=input, grouping_config=grouping_config)
        mgr.normalize()
        data = mgr.get_data()

        data.setdefault("fingerprint", ["{{ default }}"])
        apply_server_fingerprinting(data, config)
        event_type = get_event_type(data)
        event_metadata = event_type.get_metadata(data)
        data.update(materialize_metadata(data, event_type, event_metadata))

        evt = eventstore.backend.create_event(data=data)
        return config, evt


fingerprint_input = list(
    FingerprintInput(filename)
    for filename in os.listdir(_fingerprint_fixture_path)
    if filename.endswith(".json")
)


def with_fingerprint_input(name):
    return pytest.mark.parametrize(
        name, fingerprint_input, ids=lambda x: x.filename[:-5].replace("-", "_")
    )
