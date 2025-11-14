from types import ModuleType
from typing import int, Any

import pytest

from sentry.grouping.strategies.configurations import GROUPING_CONFIG_CLASSES
from tests.sentry.grouping import (
    GROUPING_INPUTS_DIR,
    NO_MSG_PARAM_CONFIG,
    GroupingInput,
    get_grouping_inputs,
)

GROUPING_INPUTS = get_grouping_inputs(GROUPING_INPUTS_DIR)


def benchmark_available() -> bool:
    try:
        __import__("pytest_benchmark")
    except ModuleNotFoundError:
        return False
    else:
        return True


@pytest.mark.skipif(not benchmark_available(), reason="requires pytest-benchmark")
@pytest.mark.parametrize(
    "config_name",
    # NO_MSG_PARAM_CONFIG is only used in tests, so no need to benchmark it
    sorted(set(GROUPING_CONFIG_CLASSES.keys()) - {NO_MSG_PARAM_CONFIG}),
    ids=lambda config_name: config_name.replace("-", "_"),
)
def test_benchmark_grouping(config_name: str, benchmark: ModuleType) -> None:
    input_iter = iter(GROUPING_INPUTS)

    def setup() -> tuple[tuple[GroupingInput, str], dict[str, Any]]:
        return (next(input_iter), config_name), {}

    benchmark.pedantic(run_configuration, setup=setup, rounds=len(GROUPING_INPUTS))


def run_configuration(grouping_input: GroupingInput, config_name: str) -> None:
    event = grouping_input.create_event(config_name, use_full_ingest_pipeline=False)

    # This ensures we won't try to touch the DB when getting event hashes
    event.project = None  # type: ignore[assignment]

    event.get_hashes()
