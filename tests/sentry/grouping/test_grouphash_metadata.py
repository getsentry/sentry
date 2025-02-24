from __future__ import annotations

from typing import Any
from unittest.mock import Mock, patch

import pytest

from sentry.eventstore.models import Event
from sentry.grouping.component import DefaultGroupingComponent, MessageGroupingComponent
from sentry.grouping.ingest.grouphash_metadata import (
    check_grouphashes_for_positive_fingerprint_match,
    get_grouphash_metadata_data,
    record_grouphash_metadata_metrics,
)
from sentry.grouping.strategies.base import StrategyConfiguration
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from sentry.grouping.variants import ComponentVariant
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata, HashBasis
from sentry.models.project import Project
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.options import override_options
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from sentry.utils import json
from tests.sentry.grouping import (
    GROUPING_INPUTS_DIR,
    GroupingInput,
    dump_variant,
    get_snapshot_path,
    to_json,
    with_grouping_inputs,
)

dummy_project = Mock(id=11211231)


@django_db_all
@with_grouping_inputs("grouping_input", GROUPING_INPUTS_DIR)
@override_options({"grouping.experiments.parameterization.uniq_id": 0})
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
    event.project = dummy_project

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

    component = DefaultGroupingComponent(
        contributes=True, values=[MessageGroupingComponent(contributes=True)]
    )

    # Overwrite the component ids so this stops being recognizable as a known grouping type
    component.id = "not_a_known_component_type"
    component.values[0].id = "dogs_are_great"

    with patch.object(
        event,
        "get_grouping_variants",
        return_value={"dogs": ComponentVariant(component, None, StrategyConfiguration())},
    ):
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

    metadata = get_grouphash_metadata_data(event, project, variants, config_name)
    hash_basis = metadata["hash_basis"]
    hashing_metadata = metadata["hashing_metadata"]

    with patch("sentry.grouping.ingest.grouphash_metadata.metrics.incr") as mock_metrics_incr:
        record_grouphash_metadata_metrics(
            GroupHashMetadata(hash_basis=hash_basis, hashing_metadata=hashing_metadata),
            event.platform,
        )

        metric_names = [call.args[0] for call in mock_metrics_incr.mock_calls]
        tags = [call.kwargs["tags"] for call in mock_metrics_incr.mock_calls]
        # Filter out all the `platform` tags, because many of the inputs don't have a `platform`
        # value, so we're going to get a lot of Nones. The fact that we're not providing a default
        # value to `pop` also ensures that if `platform` is ever missing from the tags, this test
        # will error out.
        [t.pop("platform") for t in tags]
        metrics_data = dict(zip(metric_names, tags))

        expected_metric_names = ["grouping.grouphashmetadata.event_hash_basis"]
        if hash_basis not in [HashBasis.CHECKSUM, HashBasis.TEMPLATE, HashBasis.UNKNOWN]:
            expected_metric_names.append(
                f"grouping.grouphashmetadata.event_hashing_metadata.{hash_basis}"
            )
        assert metric_names == expected_metric_names

    # Convert any fingerprint value from json to a string before jsonifying the entire metadata dict
    # below to avoid a bunch of escaping which would be caused by double jsonification
    _hashing_metadata: Any = hashing_metadata  # Alias for typing purposes
    if "fingerprint" in hashing_metadata:
        _hashing_metadata["fingerprint"] = str(json.loads(_hashing_metadata["fingerprint"]))
    if "client_fingerprint" in hashing_metadata:
        _hashing_metadata["client_fingerprint"] = str(
            json.loads(_hashing_metadata["client_fingerprint"])
        )

    lines.append("hash_basis: %s" % hash_basis)
    lines.append("hashing_metadata: %s" % to_json(hashing_metadata, pretty_print=True))
    lines.append("-" * 3)
    lines.append("metrics with tags: %s" % to_json(metrics_data, pretty_print=True))
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


@django_db_all
class GroupHashMetadataTest(TestCase):
    def test_check_grouphashes_for_positive_fingerprint_match(self):
        grouphash1 = GroupHash.objects.create(hash="dogs", project_id=self.project.id)
        grouphash2 = GroupHash.objects.create(hash="are great", project_id=self.project.id)

        for fingerprint1, fingerprint2, expected_result in [
            # All combos of default, hybrid (matching or not), custom (matching or not), and missing
            # fingerprints
            (["{{ default }}"], ["{{ default }}"], True),
            (["{{ default }}"], ["{{ default }}", "maisey"], False),
            (["{{ default }}"], ["charlie"], False),
            (["{{ default }}"], None, False),
            (["{{ default }}", "maisey"], ["{{ default }}", "maisey"], True),
            (["{{ default }}", "maisey"], ["{{ default }}", "charlie"], False),
            (["{{ default }}", "maisey"], ["charlie"], False),
            (["{{ default }}", "maisey"], None, False),
            (["charlie"], ["charlie"], True),
            (["charlie"], ["maisey"], False),
            (["charlie"], None, False),
            (None, None, False),
        ]:
            with (
                patch.object(grouphash1, "get_associated_fingerprint", return_value=fingerprint1),
                patch.object(grouphash2, "get_associated_fingerprint", return_value=fingerprint2),
            ):
                assert (
                    check_grouphashes_for_positive_fingerprint_match(grouphash1, grouphash2)
                    == expected_result
                ), f"Case {fingerprint1}, {fingerprint2} failed"
