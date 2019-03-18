# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import os
import json
import pytest

from sentry.models import Event
from sentry.event_manager import EventManager
from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.configurations import CONFIGURATIONS


def dump_variant(variant, lines=None, indent=0):
    if lines is None:
        lines = []

    def _dump_component(component, indent):
        if not component.hint and not component.values:
            return
        lines.append('%s%s%s%s' % (
            '  ' * indent,
            component.id,
            component.contributes and '*' or '',
            component.hint and ' (%s)' % component.hint or '',
        ))
        for value in component.values:
            if isinstance(value, GroupingComponent):
                _dump_component(value, indent + 1)
            else:
                lines.append('  ' * (indent + 1) + repr(value))

    lines.append('%shash: %r' % ('  ' * indent, variant.get_hash()))
    for (key, value) in sorted(variant.__dict__.items()):
        if isinstance(value, GroupingComponent):
            lines.append('%s%s:' % ('  ' * indent, key))
            _dump_component(value, indent + 1)
        else:
            lines.append('%s%s: %r' % ('  ' * indent, key, value))

    return lines


_fixture_path = os.path.join(os.path.dirname(__file__), 'inputs')


def load_configs():
    configs = CONFIGURATIONS.keys()

    rv = []
    for filename in os.listdir(_fixture_path):
        if filename.endswith('.json'):
            for config in configs:
                rv.append((config, filename[:-5]))

    rv.sort()

    return rv


@pytest.mark.parametrize(
    'config_name,test_name',
    load_configs(),
    ids=lambda x: x.replace("-", "_")  # Nicer folder structure for insta_snapshot
)
def test_event_hash_variant(insta_snapshot, config_name, test_name, log):
    with open(os.path.join(_fixture_path, test_name + '.json')) as f:
        input = json.load(f)

    mgr = EventManager(data=input)
    mgr.normalize()
    data = mgr.get_data()
    evt = Event(data=data, platform=data['platform'])

    rv = []
    for (key, value) in sorted(evt.get_grouping_variants(force_config=config_name).items()):
        if rv:
            rv.append('-' * 74)
        rv.append('%s:' % key)
        dump_variant(value, rv, 1)
    output = '\n'.join(rv)
    log(repr(evt.get_hashes()))

    insta_snapshot(output)
