from __future__ import annotations

from typing import Any, cast
from unittest.mock import MagicMock, patch

from sentry.grouping.fingerprinting.types import FingerprintRuleJSON
from sentry.grouping.variants import BaseVariant, CustomFingerprintVariant, expose_fingerprint_dict
from sentry.services.eventstore.models import Event
from sentry.testutils.pytest.fixtures import InstaSnapshotter, django_db_all
from tests.sentry.grouping import dump_variant, run_as_grouping_inputs_snapshot_test


@run_as_grouping_inputs_snapshot_test
@patch("sentry.grouping.strategies.newstyle.logging.exception")
def test_variants(
    mock_exception_logger: MagicMock,
    event: Event,
    variants: dict[str, BaseVariant],
    config_name: str,
    create_snapshot: InstaSnapshotter,
    **kwargs: Any,
) -> None:
    # Make sure the event was annotated with the grouping config
    assert event.get_grouping_config()["id"] == config_name

    # Check that we didn't end up with a caught but unexpected error in any of our strategies
    assert mock_exception_logger.call_count == 0

    lines: list[str] = []

    for variant_name, variant in sorted(variants.items()):
        if lines:
            lines.append("-" * 74)
        lines.append("%s:" % variant_name)
        dump_variant(variant, lines, 1)
    output = "\n".join(lines)

    create_snapshot(output)


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
