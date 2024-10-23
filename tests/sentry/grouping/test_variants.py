from __future__ import annotations

from os import path
from typing import Any

import orjson
import pytest

from sentry.eventstore.models import Event
from sentry.grouping.component import GroupingComponent
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.grouping.variants import BaseVariant
from sentry.models.project import Project
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from tests.sentry.grouping import GROUPING_INPUTS_DIR, GroupingInput, with_grouping_inputs


def to_json(value: Any) -> str:
    return orjson.dumps(value, option=orjson.OPT_SORT_KEYS).decode()


def dump_variant(
    variant: BaseVariant, lines: list[str] | None = None, indent: int = 0
) -> list[str]:
    if lines is None:
        lines = []

    def _dump_component(component: GroupingComponent, indent: int) -> None:
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
                lines.append("{}{}".format("  " * (indent + 1), to_json(value)))

    lines.append("{}hash: {}".format("  " * indent, to_json(variant.get_hash())))

    for key, value in sorted(variant.__dict__.items()):
        if isinstance(value, GroupingComponent):
            lines.append("{}{}:".format("  " * indent, key))
            _dump_component(value, indent + 1)
        elif key == "config":
            # We do not want to dump the config
            continue
        else:
            lines.append("{}{}: {}".format("  " * indent, key, to_json(value)))

    return lines


@with_grouping_inputs("grouping_input", GROUPING_INPUTS_DIR)
@pytest.mark.parametrize(
    "config_name",
    set(CONFIGURATIONS.keys()) - {DEFAULT_GROUPING_CONFIG},
    ids=lambda config_name: config_name.replace("-", "_"),
)
def test_variants_with_legacy_configs(
    config_name: str, grouping_input: GroupingInput, insta_snapshot: InstaSnapshotter
) -> None:
    """
    Run the variant snapshot tests using an minimal (and much more performant) save process.

    Because manually cherry-picking only certain parts of the save process to run makes us much more
    likely to fall out of sync with reality, for safety we only do this when testing legacy,
    inactive grouping configs.
    """
    event = grouping_input.create_event(config_name, use_full_ingest_pipeline=False)

    # This ensures we won't try to touch the DB when getting event variants
    event.project = None  # type: ignore[assignment]

    _assert_and_snapshot_results(event, config_name, grouping_input.filename, insta_snapshot)


@django_db_all
@with_grouping_inputs("grouping_input", GROUPING_INPUTS_DIR)
@pytest.mark.parametrize(
    "config_name",
    # Technically we don't need to parameterize this since there's only one option, but doing it
    # this way makes snapshots from this test organize themselves neatly alongside snapshots from
    # the test of the legacy configs above
    {DEFAULT_GROUPING_CONFIG},
    ids=lambda config_name: config_name.replace("-", "_"),
)
def test_variants_with_current_default_config(
    config_name: str,
    grouping_input: GroupingInput,
    insta_snapshot: InstaSnapshotter,
    default_project: Project,
):
    """
    Run the variant snapshot tests using the full `EventManager.save` process.

    This is the most realistic way to test, but it's also slow, because it requires the overhead of
    set-up/tear-down/general interaction with our full postgres database. We therefore only do it
    when testing the current grouping config, and rely on a much faster manual test (below) for
    previous grouping configs.
    """

    event = grouping_input.create_event(
        config_name, use_full_ingest_pipeline=True, project=default_project
    )

    _assert_and_snapshot_results(
        event, DEFAULT_GROUPING_CONFIG, grouping_input.filename, insta_snapshot
    )


def _assert_and_snapshot_results(
    event: Event, config_name: str, input_file: str, insta_snapshot: InstaSnapshotter
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
        # Manually set the snapshot path so that both of the tests above will file their snapshots
        # in the same spot
        reference_file=path.join(
            path.dirname(__file__),
            "snapshots",
            path.basename(__file__).replace(".py", ""),
            "test_event_hash_variant",
            config_name.replace("-", "_").replace(":", "@"),
            input_file.replace("-", "_").replace(".json", ".pysnap"),
        ),
    )
