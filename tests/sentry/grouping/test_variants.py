from __future__ import annotations

from typing import cast
from unittest import mock
from unittest.mock import MagicMock, patch

from sentry.grouping.fingerprinting.rules import FingerprintRuleJSON
from sentry.grouping.variants import CustomFingerprintVariant, expose_fingerprint_dict
from sentry.models.project import Project
from sentry.services.eventstore.models import Event
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from tests.sentry.grouping import (
    FULL_PIPELINE_CONFIGS,
    GROUPING_INPUTS_DIR,
    MANUAL_SAVE_CONFIGS,
    GroupingInput,
    dump_variant,
    get_snapshot_path,
    with_grouping_configs,
    with_grouping_inputs,
)


@django_db_all
@with_grouping_inputs("grouping_input", GROUPING_INPUTS_DIR)
@with_grouping_configs(MANUAL_SAVE_CONFIGS)
@patch("sentry.grouping.strategies.newstyle.logging.exception")
def test_variants_with_manual_save(
    mock_exception_logger: MagicMock,
    config_name: str,
    grouping_input: GroupingInput,
    insta_snapshot: InstaSnapshotter,
) -> None:
    """
    Run the variant snapshot tests using a minimal (and much more performant) save process.

    Because manually cherry-picking only certain parts of the save process to run makes us much more
    likely to fall out of sync with reality, when we're in CI, for safety we only do this when
    testing older grouping configs. Locally, if `SENTRY_FAST_GROUPING_SNAPSHOTS` is set in the
    environment, this is used for the default confing, too.
    """
    event = grouping_input.create_event(config_name, use_full_ingest_pipeline=False)

    # This ensures we won't try to touch the DB when getting event variants
    event.project = mock.Mock(id=11211231)

    _assert_and_snapshot_results(
        event, config_name, grouping_input.filename, insta_snapshot, mock_exception_logger
    )


@django_db_all
@with_grouping_inputs("grouping_input", GROUPING_INPUTS_DIR)
@with_grouping_configs(FULL_PIPELINE_CONFIGS)
@patch("sentry.grouping.strategies.newstyle.logging.exception")
def test_variants_with_full_pipeline(
    mock_exception_logger: MagicMock,
    config_name: str,
    grouping_input: GroupingInput,
    insta_snapshot: InstaSnapshotter,
    default_project: Project,
) -> None:
    """
    Run the variant snapshot tests using the full `EventManager.save` process.

    This is the most realistic way to test, but it's also slow, because it requires the overhead of
    set-up/tear-down/general interaction with our full postgres database. We therefore only do it
    when testing the current grouping config in CI, and rely on a much faster manual test (above)
    when testing previous grouping configs. (When testing locally, the faster test can be used for
    the default config as well if `SENTRY_FAST_GROUPING_SNAPSHOTS` is set in the environment.)
    """

    event = grouping_input.create_event(
        config_name, use_full_ingest_pipeline=True, project=default_project
    )

    _assert_and_snapshot_results(
        event, config_name, grouping_input.filename, insta_snapshot, mock_exception_logger
    )


def _assert_and_snapshot_results(
    event: Event,
    config_name: str,
    input_file: str,
    insta_snapshot: InstaSnapshotter,
    mock_exception_logger: MagicMock,
) -> None:
    grouping_variants = event.get_grouping_variants()

    # Make sure the event was annotated with the grouping config
    assert event.get_grouping_config()["id"] == config_name

    # Check that we didn't end up with a caught but unexpected error in any of our strategies
    assert mock_exception_logger.call_count == 0

    lines: list[str] = []

    for variant_name, variant in sorted(grouping_variants.items()):
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


@django_db_all
# TODO: This can be deleted after Jan 2025, when affected events have aged out
def test_old_event_with_no_fingerprint_rule_text() -> None:
    variant = CustomFingerprintVariant(
        ["dogs are great"],
        {
            # Cast here to compensate for missing `text` entry. (This allows us to avoid creating
            # another place we have to remember to update when this temporary test (and the
            # temporary fix it tests) is removed.)
            "matched_rule": cast(
                FingerprintRuleJSON,
                {
                    "attributes": {},
                    "fingerprint": ["dogs are great"],
                    "matchers": [["message", "*dogs*"]],
                    # newer events have a `text` entry here
                },
            )
        },
    )
    assert expose_fingerprint_dict(variant.values, variant.fingerprint_info) == {
        "values": ["dogs are great"],
        "matched_rule": 'message:"*dogs*" -> "dogs are great"',
    }
