# -*- coding: utf-8 -*-

from __future__ import absolute_import, print_function

import os
import sys
import json
import pytest

from sentry.models import Event
from sentry.event_manager import EventManager
from sentry.event_hashing import GroupingComponent


def log(x):
    return sys.stdout.write(x + '\n')


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


_fixture_path = os.path.join(os.path.dirname(__file__), 'fixtures')


@pytest.mark.parametrize('infile', list(x[:-5] for x in os.listdir(_fixture_path)
                                        if x.endswith('.json')))
def test_event_hash_variant(infile):
    with open(os.path.join(_fixture_path, infile + '.json')) as f:
        input = json.load(f)
    with open(os.path.join(_fixture_path, infile + '.out')) as f:
        refval = f.read().decode('utf-8').rstrip()

    mgr = EventManager(data=input)
    mgr.normalize()
    evt = Event(data=mgr.get_data())

    rv = []
    for (key, value) in sorted(evt.get_grouping_variants().items()):
        if rv:
            rv.append('-' * 74)
        rv.append('%s:' % key)
        dump_variant(value, rv, 1)
    output = '\n'.join(rv)
    if not refval:
        log(output)
    log(repr(evt.get_hashes()))

    assert sorted(evt.get_hashes()) == sorted(
        filter(None, [x.get_hash() for x in evt.get_grouping_variants().values()]))

    assert refval == output
