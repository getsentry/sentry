from __future__ import annotations

from typing import cast
from unittest.mock import MagicMock, patch

import pytest

from sentry.eventstore.models import Event
from sentry.grouping.api import get_default_grouping_config_dict
from sentry.grouping.component import GroupingComponent
from sentry.grouping.ingest.grouphash_metadata import _get_hash_basis
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.grouping.variants import ComponentVariant
from sentry.models.project import Project
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from tests.sentry.grouping import (
    GROUPING_INPUTS_DIR,
    GroupingInput,
    dump_variant,
    get_snapshot_path,
    with_grouping_inputs,
)


class DummyProject:
    id: int = 11211231


dummy_project = cast(Project, DummyProject())


@with_grouping_inputs("grouping_input", GROUPING_INPUTS_DIR)
@pytest.mark.parametrize(
    "config_name",
    set(CONFIGURATIONS.keys()) - {DEFAULT_GROUPING_CONFIG},
    ids=lambda config_name: config_name.replace("-", "_"),
)
def test_hash_basis_with_legacy_configs(
    config_name: str, grouping_input: GroupingInput, insta_snapshot: InstaSnapshotter
) -> None:
    """
    Run the grouphash metadata snapshot tests using a minimal (and much more performant) save
    process.

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
def test_hash_basis_with_current_default_config(
    config_name: str,
    grouping_input: GroupingInput,
    insta_snapshot: InstaSnapshotter,
    default_project: Project,
):
    """
    Run the grouphash metadata snapshot tests using the full `EventManager.save` process.

    This is the most realistic way to test, but it's also slow, because it requires the overhead of
    set-up/tear-down/general interaction with our full postgres database. We therefore only do it
    when testing the current grouping config, and rely on a much faster manual test (above) for
    previous grouping configs.
    """

    event = grouping_input.create_event(
        config_name, use_full_ingest_pipeline=True, project=default_project
    )

    _assert_and_snapshot_results(event, config_name, grouping_input.filename, insta_snapshot)


@django_db_all
@pytest.mark.parametrize(
    "config_name",
    CONFIGURATIONS.keys(),
    ids=lambda config_name: config_name.replace("-", "_"),
)
def test_unknown_hash_basis(
    config_name: str,
    insta_snapshot: InstaSnapshotter,
    default_project: Project,
) -> None:
    grouping_input = GroupingInput(GROUPING_INPUTS_DIR, "empty.json")

    event = grouping_input.create_event(
        config_name, use_full_ingest_pipeline=True, project=default_project
    )

    unknown_variants = {
        "dogs": ComponentVariant(
            GroupingComponent(
                id="not_a_known_component_type",
                contributes=True,
                values=[GroupingComponent(id="dogs_are_great", contributes=True)],
            ),
            get_default_grouping_config_dict(),
        )
    }
    with patch.object(event, "get_grouping_variants", new=MagicMock(return_value=unknown_variants)):
        # Overrride the input filename since there isn't a real input which will generate the mock
        # variants above, but we still want the snapshot.
        _assert_and_snapshot_results(event, config_name, "unknown_variant.json", insta_snapshot)


def _assert_and_snapshot_results(
    event: Event,
    config_name: str,
    input_file: str,
    insta_snapshot: InstaSnapshotter,
    project: Project = dummy_project,
) -> None:
    lines: list[str] = []
    variants = event.get_grouping_variants()

    hash_basis = _get_hash_basis(event, project, variants)
    lines.append("hash_basis: %s" % hash_basis)
    lines.append("-" * 3)

    lines.append("contributing variants:")
    for variant_name, variant in sorted(variants.items()):
        if not variant.contributes:
            continue
        lines.append("  %s*" % variant_name)
        dump_variant(variant, lines, 2, include_non_contributing=False)

    output = "\n".join(lines)

    insta_snapshot(
        output,
        # Manually set the snapshot path so that both of the tests above will file their snapshots
        # in the same spot
        reference_file=get_snapshot_path(
            __file__, input_file, "test_metadata_from_variants", config_name
        ),
    )
