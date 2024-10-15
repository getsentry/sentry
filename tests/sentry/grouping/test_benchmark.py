import pytest

from sentry.grouping.api import get_default_grouping_config_dict
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from tests.sentry.grouping import GROUPING_INPUTS_DIR, GroupingInput, get_grouping_inputs

CONFIGS = {key: get_default_grouping_config_dict(key) for key in sorted(CONFIGURATIONS.keys())}
GROUPING_INPUTS = get_grouping_inputs(GROUPING_INPUTS_DIR)


def benchmark_available() -> bool:
    try:
        __import__("pytest_benchmark")
    except ModuleNotFoundError:
        return False
    else:
        return True


@pytest.mark.skipif(not benchmark_available(), reason="requires pytest-benchmark")
# @pytest.mark.parametrize(
#     "config_name",
#     set(CONFIGURATIONS.keys()) - {DEFAULT_GROUPING_CONFIG},
#     ids=lambda config_name: config_name.replace("-", "_"),
# )
@pytest.mark.parametrize(
    "config_name", sorted(CONFIGURATIONS.keys()), ids=lambda x: x.replace("-", "_")
)
def test_benchmark_grouping(config_name, benchmark):
    # config = CONFIGS[config_name]
    input_iter = iter(GROUPING_INPUTS)

    def setup():
        return (next(input_iter), config_name), {}

    benchmark.pedantic(run_configuration, setup=setup, rounds=len(GROUPING_INPUTS))


def run_configuration(grouping_input: GroupingInput, config_name: str):
    event = grouping_input.create_event(config_name, use_full_ingest_pipeline=False)
    # breakpoint()

    # This ensures we won't try to touch the DB when getting event hashes
    event.project = None  # type: ignore[assignment]

    event.get_hashes()
