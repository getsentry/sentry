from __future__ import annotations

from typing import Any
from unittest.mock import patch

from sentry.grouping.component import MessageGroupingComponent, RootGroupingComponent
from sentry.grouping.ingest.grouphash_metadata import (
    check_grouphashes_for_positive_fingerprint_match,
    get_grouphash_metadata_data,
    record_grouphash_metadata_metrics,
)
from sentry.grouping.strategies.base import StrategyConfiguration
from sentry.grouping.variants import BaseVariant, ComponentVariant, SaltedComponentVariant
from sentry.models.grouphash import GroupHash
from sentry.models.grouphashmetadata import GroupHashMetadata, HashBasis
from sentry.models.project import Project
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import TestCase
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from sentry.utils import json
from tests.sentry.grouping import (
    FULL_PIPELINE_CONFIGS,
    GROUPING_INPUTS_DIR,
    MANUAL_SAVE_CONFIGS,
    GroupingInput,
    dump_variant,
    get_grouping_input_snapshotter,
    run_as_grouping_inputs_snapshot_test,
    to_json,
    with_grouping_configs,
)


@run_as_grouping_inputs_snapshot_test
def test_metadata_from_variants(
    event: Event,
    variants: dict[str, BaseVariant],
    config_name: str,
    create_snapshot: InstaSnapshotter,
    **kwargs: Any,
) -> None:
    _assert_and_snapshot_results(event, variants, config_name, create_snapshot)


@django_db_all
# This excludes NO_MSG_PARAM_CONFIG, which is only meant for use in unit tests
@with_grouping_configs(MANUAL_SAVE_CONFIGS | FULL_PIPELINE_CONFIGS)
def test_unknown_hash_basis(
    config_name: str,
    insta_snapshot: InstaSnapshotter,
    default_project: Project,
) -> None:
    grouping_input = GroupingInput(GROUPING_INPUTS_DIR, "empty.json")

    event = grouping_input.create_event(
        config_name, use_full_ingest_pipeline=True, project=default_project
    )

    # Overwrite the component ids and create fake variants so this stops being recognizable as a
    # known grouping type
    component = RootGroupingComponent(
        variant_name="not_a_known_variant_name",
        contributes=True,
        values=[MessageGroupingComponent(contributes=True)],
    )
    component.values[0].id = "dogs_are_great"
    variants: dict[str, BaseVariant] = {
        "dogs": ComponentVariant(component, None, StrategyConfiguration())
    }

    # Create a snapshot function with the output path baked in
    create_snapshot = get_grouping_input_snapshotter(
        insta_snapshot,
        folder_name="grouphash_metadata",
        # Make this match the test above, so the snapshot we generate will end up in the same folder
        test_name="test_metadata_from_variants",
        config_name=config_name,
        # Overrride the input filename since there isn't a real input which will generate the
        # unknown mock variants, but we still want to create a snapshot as if there were
        grouping_input_file="unknown-variant.json",
    )

    _assert_and_snapshot_results(event, variants, config_name, create_snapshot)


def _assert_and_snapshot_results(
    event: Event,
    variants: dict[str, BaseVariant],
    config_name: str,
    create_snapshot: InstaSnapshotter,
) -> None:
    lines: list[str] = []
    metadata = get_grouphash_metadata_data(event, event.project, variants, config_name)
    hash_basis = metadata["hash_basis"]
    hashing_metadata = metadata["hashing_metadata"]

    # Sanity checks for key values. This doesn't check every detail of what goes into the key
    # (chained vs not, for instance), but checks enough that we can be confident the UI will show
    # the right thing.
    for variant_name, variant in variants.items():
        if variant_name in ["app", "system"]:
            assert variant.key.startswith(variant_name)
        if isinstance(variant, SaltedComponentVariant):
            assert variant.key.endswith("_hybrid_fingerprint")
        if variant.contributes and hash_basis != HashBasis.UNKNOWN:
            # Look for (no pun intended) keywords in the key to show that it agrees with the hash basis
            search_strings = (
                ["message", "type", "ns_error"]
                if hash_basis == HashBasis.MESSAGE
                else (
                    ["csp", "expect", "hpkp"]
                    if hash_basis == HashBasis.SECURITY_VIOLATION
                    else [hash_basis]
                )
            )
            assert any(search_string in variant.key for search_string in search_strings)

    # Check that the right metrics are being recorded
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

    create_snapshot(output)


@django_db_all
class GroupHashMetadataTest(TestCase):
    def test_check_grouphashes_for_positive_fingerprint_match(self) -> None:
        grouphash1 = GroupHash.objects.create(hash="dogs", project_id=self.project.id)
        grouphash2 = GroupHash.objects.create(hash="are_great", project_id=self.project.id)

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
