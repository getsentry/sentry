from __future__ import annotations

from collections.abc import Callable
from os import path

import pytest

from sentry.eventstore.models import Event
from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.utils import json
from tests.sentry.grouping import GroupingInput, with_grouping_inputs

GROUPING_INPUTS_DIR = path.join(path.dirname(__file__), "grouping_inputs")


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
            lines.append("{}{}:".format("  " * indent, key))
            _dump_component(value, indent + 1)
        elif key == "config":
            # We do not want to dump the config
            continue
        else:
            lines.append("{}{}: {}".format("  " * indent, key, json.dumps(value)))

    return lines


@with_grouping_inputs("grouping_input", GROUPING_INPUTS_DIR)
@pytest.mark.parametrize(
    "config_name",
    CONFIGURATIONS.keys(),
    ids=lambda config_name: config_name.replace("-", "_"),
)
def test_event_hash_variant(
    config_name: str, grouping_input: GroupingInput, insta_snapshot: Callable[[str], None]
) -> None:
    event = grouping_input.create_event(config_name)

    # This ensures we won't try to touch the DB when getting event variants
    event.project = None  # type: ignore[assignment]

    _assert_and_snapshot_results(event, config_name, grouping_input.filename, insta_snapshot)


def _assert_and_snapshot_results(
    event: Event, config_name: str, input_file: str, insta_snapshot: Callable[[str], None]
) -> None:
    # Make sure the event was annotated with the grouping config
    assert event.get_grouping_config()["id"] == config_name

    lines: list[str] = []

    for variant_name, variant in sorted(event.get_grouping_variants().items()):
        if lines:
            lines.append("-" * 74)
        lines.append("%s:" % variant_name)
        dump_variant(variant, lines, 1)
    output = "\n".join(lines)

    insta_snapshot(
        output,
        reference_file=path.join(
            path.dirname(__file__),
            "snapshots",
            path.basename(__file__).replace(".py", ""),
            "test_event_hash_variant",
            # Turn "newstyle:2012-11-21" into "newstyle@2012_11_21"
            config_name.replace("-", "_").replace(":", "@"),
            input_file.replace("-", "_").replace(".json", ".pysnap"),
        ),
    )
