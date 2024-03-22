from __future__ import annotations

import pytest

from sentry.eventtypes.base import format_title_from_tree_label
from sentry.grouping.api import (
    detect_synthetic_exception,
    get_default_grouping_config_dict,
    load_grouping_config,
)
from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json
from tests.sentry.grouping import with_grouping_input


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
                lines.append("{}{}".format("  " * (indent + 1), json.dumps(value)))

    lines.append("{}hash: {}".format("  " * indent, json.dumps(variant.get_hash())))

    for key, value in sorted(variant.__dict__.items()):
        if isinstance(value, GroupingComponent):
            if value.tree_label:
                lines.append(
                    '{}tree_label: "{}"'.format(
                        "  " * indent, format_title_from_tree_label(value.tree_label)
                    )
                )
            lines.append("{}{}:".format("  " * indent, key))
            _dump_component(value, indent + 1)
        elif key == "config":
            # We do not want to dump the config
            continue
        else:
            lines.append("{}{}: {}".format("  " * indent, key, json.dumps(value)))

    return lines


@with_grouping_input("grouping_input")
@pytest.mark.parametrize("config_name", CONFIGURATIONS.keys(), ids=lambda x: x.replace("-", "_"))
@django_db_all  # because of `options` usage
@override_options({"grouping.rust_enhancers.compare_components": 1.0})
def test_event_hash_variant(config_name, grouping_input, insta_snapshot, log):
    grouping_config = get_default_grouping_config_dict(config_name)
    evt = grouping_input.create_event(grouping_config)

    # Make sure we don't need to touch the DB here because this would
    # break stuff later on.
    evt.project = None

    # Set the synthetic marker if detected
    detect_synthetic_exception(evt.data, load_grouping_config(grouping_config))

    rv: list[str] = []
    for key, value in sorted(evt.get_grouping_variants().items()):
        if rv:
            rv.append("-" * 74)
        rv.append("%s:" % key)
        dump_variant(value, rv, 1)
    output = "\n".join(rv)

    hashes = evt.get_hashes()
    log(repr(hashes))

    assert evt.get_grouping_config() == grouping_config

    insta_snapshot(output)

    with override_options(
        {
            "grouping.rust_enhancers.prefer_rust_components": 1.0,
        }
    ):
        evt = grouping_input.create_event(grouping_config)
        evt.project = None

        rust_hashes = evt.get_hashes()
        assert rust_hashes.hashes == hashes.hashes

        # rv = []
        # for key, value in sorted(evt.get_grouping_variants().items()):
        #     if rv:
        #         rv.append("-" * 74)
        #     rv.append("%s:" % key)
        #     dump_variant(value, rv, 1)
        # rust_output = "\n".join(rv)

        # FIXME: the `hint` output does not (yet) fully match what Python produces
        # assert rust_output == output
