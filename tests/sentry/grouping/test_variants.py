from __future__ import annotations

from unittest import mock

import pytest

from sentry.eventstore.models import Event
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.models.project import Project
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from tests.sentry.grouping import (
    GROUPING_INPUTS_DIR,
    GroupingInput,
    dump_variant,
    get_snapshot_path,
    with_grouping_inputs,
)


@django_db_all
@with_grouping_inputs("grouping_input", GROUPING_INPUTS_DIR)
@override_options({"grouping.experiments.parameterization.uniq_id": 0})
@pytest.mark.parametrize(
    "config_name",
    set(CONFIGURATIONS.keys()) - {DEFAULT_GROUPING_CONFIG},
    ids=lambda config_name: config_name.replace("-", "_"),
)
def test_variants_with_legacy_configs(
    config_name: str, grouping_input: GroupingInput, insta_snapshot: InstaSnapshotter
) -> None:
    """
    Run the variant snapshot tests using a minimal (and much more performant) save process.

    Because manually cherry-picking only certain parts of the save process to run makes us much more
    likely to fall out of sync with reality, for safety we only do this when testing legacy,
    inactive grouping configs.
    """
    event = grouping_input.create_event(config_name, use_full_ingest_pipeline=False)

    # This ensures we won't try to touch the DB when getting event variants
    event.project = mock.Mock(id=11211231)

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
        reference_file=get_snapshot_path(
            __file__, input_file, "test_event_hash_variant", config_name
        ),
    )
