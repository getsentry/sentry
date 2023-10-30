import pytest

from sentry.grouping.api import get_default_grouping_config_dict
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from tests.sentry.grouping import grouping_input as grouping_inputs

CONFIGS = {key: get_default_grouping_config_dict(key) for key in sorted(CONFIGURATIONS.keys())}


def benchmark_available() -> bool:
    try:
        __import__("pytest_benchmark")
    except ModuleNotFoundError:
        return False
    else:
        return True


@pytest.mark.skipif(not benchmark_available(), reason="requires pytest-benchmark")
@pytest.mark.parametrize(
    "config_name", sorted(CONFIGURATIONS.keys()), ids=lambda x: x.replace("-", "_")
)
def test_benchmark_grouping(config_name, benchmark):
    config = CONFIGS[config_name]
    input_iter = iter(grouping_inputs)

    def setup():
        return (next(input_iter), config), {}

    benchmark.pedantic(run_configuration, setup=setup, rounds=len(grouping_inputs))


def run_configuration(grouping_input, config):
    event = grouping_input.create_event(config)

    # Copied from test_variants.py, not sure if necessary
    event.project = None

    event.get_hashes()
