from __future__ import annotations

from typing import Any, cast
from unittest.mock import MagicMock, patch

import pytest

from sentry.conf.server import (
    FALL_2025_GROUPING_CONFIG,
    FALL_2026_GROUPING_CONFIG,
    WINTER_2023_GROUPING_CONFIG,
)
from sentry.grouping.api import (
    get_default_grouping_config_dict,
    get_grouping_variants_for_event,
    load_grouping_config,
)
from sentry.grouping.component import (
    ErrorTypeGroupingComponent,
    ErrorValueGroupingComponent,
    ExceptionGroupingComponent,
    RootGroupingComponent,
)
from sentry.grouping.fingerprinting.types import FingerprintRuleJSON
from sentry.grouping.strategies.base import StrategyConfiguration
from sentry.grouping.utils import hash_from_values
from sentry.grouping.variants import (
    BaseVariant,
    CustomFingerprintVariant,
    SaltedComponentVariant,
    expose_fingerprint_dict,
)
from sentry.services.eventstore.models import Event
from sentry.testutils.helpers.options import override_options
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


@pytest.fixture
def beta_grouping_config() -> StrategyConfiguration:
    return load_grouping_config(get_default_grouping_config_dict(FALL_2026_GROUPING_CONFIG))


@pytest.mark.parametrize(
    "fingerprints",
    [
        [["checkout", "12", "34"], ["checkout", "123", "4"]],
        [["tenant", "12", "3"], ["tenant", "1", "23"], ["tenant", "123"]],
        [["ab", "c"], ["a", "bc"], ["abc"]],
        [["ab"], ["", "ab"], ["a", "", "b"], ["ab", ""]],
        [["a\x00", "b"], ["a", "\x00b"], ["a\x00b"]],
        [["a:", "b"], ["a", ":b"], ["a:b"]],
        [["é", "猫"], ["é猫"]],
        [["a", "b"], ["b", "a"]],
    ],
)
@pytest.mark.parametrize(
    "default_position, default_values",
    [(0, []), (0, ["{{ default }}"]), (1, ["{{ default }}"]), (99, ["{{ default }}"])],
)
def test_fingerprint_value_boundaries(
    beta_grouping_config: StrategyConfiguration,
    fingerprints: list[list[str]],
    default_position: int,
    default_values: list[str],
) -> None:
    hashes = []
    with override_options({"grouping.experimental_parameterization": 0.0}):
        for fingerprint in fingerprints:
            values = fingerprint.copy()
            values[default_position:default_position] = default_values
            event = Event(
                project_id=1,
                event_id="a" * 32,
                data={"logentry": {"message": "Checkout failed"}, "fingerprint": values},
            )
            variants = get_grouping_variants_for_event(event, beta_grouping_config)
            contributing_hashes = [v.get_hash() for v in variants.values() if v.contributes]
            assert len(contributing_hashes) == 1
            assert contributing_hashes[0] is not None
            hashes.extend(contributing_hashes)

    assert len(set(hashes)) == len(fingerprints)


@pytest.mark.parametrize("config_id", [WINTER_2023_GROUPING_CONFIG, FALL_2025_GROUPING_CONFIG])
@pytest.mark.parametrize(
    "fingerprint, expected_hash",
    [
        (["checkout", "12", "34"], "9c586ffc6a6ca3d7abd874376424b48d"),
        (["checkout", "123", "4"], "9c586ffc6a6ca3d7abd874376424b48d"),
        (["tenant", "12", "3"], "e71a10fcac4dabace79d8ff4c903ead6"),
        (["tenant", "1", "23"], "e71a10fcac4dabace79d8ff4c903ead6"),
        (["tenant", "123"], "e71a10fcac4dabace79d8ff4c903ead6"),
        (["{{ default }}", "12", "3"], "d512cea612c731c5f303c987cff24f75"),
        (["{{ default }}", "1", "23"], "d512cea612c731c5f303c987cff24f75"),
    ],
)
def test_legacy_fingerprint_hashes(
    config_id: str, fingerprint: list[str], expected_hash: str
) -> None:
    event = Event(
        project_id=1,
        event_id="a" * 32,
        data={"logentry": {"message": "Checkout failed"}, "fingerprint": fingerprint},
    )
    with override_options({"grouping.experimental_parameterization": 0.0}):
        variants = get_grouping_variants_for_event(
            event, load_grouping_config(get_default_grouping_config_dict(config_id))
        )
    assert [v.get_hash() for v in variants.values() if v.contributes] == [expected_hash]


@pytest.mark.parametrize(
    "data",
    [
        {},
        {"logentry": {"message": "Checkout failed"}},
        {"logentry": {"message": "Checkout failed"}, "fingerprint": ["{{ default }}"]},
        {"checksum": "a" * 32},
        {"checksum": "legacy checksum"},
        {"fingerprint": ["{{ default }}", "custom"]},  # Non-contributing default component
    ],
)
def test_non_fingerprint_hashes_unchanged(
    beta_grouping_config: StrategyConfiguration, data: dict[str, Any]
) -> None:
    event = Event(project_id=1, event_id="a" * 32, data=data)
    with override_options({"grouping.experimental_parameterization": 0.0}):
        old_variants = get_grouping_variants_for_event(event, load_grouping_config())
        new_variants = get_grouping_variants_for_event(event, beta_grouping_config)
    assert {name: v.get_hash() for name, v in new_variants.items()} == {
        name: v.get_hash() for name, v in old_variants.items()
    }


@pytest.mark.parametrize(
    "fingerprint", [["{{ default }}", "salt"], ["salt", "{{ default }}", "{{ default }}"]]
)
def test_hybrid_preserves_default_grouping_equivalence(
    beta_grouping_config: StrategyConfiguration, fingerprint: list[str]
) -> None:
    hashes = []
    for error_type, error_value in [("ab", "c"), ("a", "bc")]:
        component = ExceptionGroupingComponent(
            values=[
                ErrorTypeGroupingComponent(values=[error_type]),
                ErrorValueGroupingComponent(values=[error_value]),
            ]
        )
        root = RootGroupingComponent(variant_name="default", values=[component])
        variant = SaltedComponentVariant(fingerprint, root, component, beta_grouping_config, {})
        hashes.append(variant.get_hash())
    assert hashes[0] is not None
    assert hashes[0] == hashes[1]


@pytest.mark.parametrize("default_value, custom_value", [("ab", "c"), ("a", "bc")])
def test_hybrid_default_boundary(
    beta_grouping_config: StrategyConfiguration, default_value: str, custom_value: str
) -> None:
    # The default expansion is one value, not a flattened list of component values.
    component = ExceptionGroupingComponent(
        values=[ErrorTypeGroupingComponent(values=[default_value])]
    )
    root = RootGroupingComponent(variant_name="default", values=[component])
    variant = SaltedComponentVariant(
        ["{{ default }}", custom_value], root, component, beta_grouping_config, {}
    )
    assert variant.get_hash() == hash_from_values(
        [default_value, custom_value], with_value_boundaries=True
    )


@pytest.mark.parametrize(
    "values, encoded",
    [
        (["ab", "c"], "2:ab1:c"),
        (["a", "bc"], "1:a2:bc"),
        (["", "a\x00:b", ""], "0:4:a\x00:b0:"),
        (["é", "猫"], "2:é3:猫"),
        (["\ud800", "a"], "1:?1:a"),
    ],
)
def test_length_prefixed_fingerprint_hashes(values: list[str], encoded: str) -> None:
    assert hash_from_values(iter(values), with_value_boundaries=True) == hash_from_values([encoded])


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
        load_grouping_config(),
    )
    assert expose_fingerprint_dict(variant.values, variant.fingerprint_info) == {
        "values": ["dogs are great"],
        "matched_rule": 'message:"*dogs*" -> "dogs are great"',
    }
