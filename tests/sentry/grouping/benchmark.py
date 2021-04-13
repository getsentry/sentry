from time import time

from sentry.runner import configure

configure()

import sentry_sdk

sentry_sdk.init("")

from sentry.grouping.api import get_default_grouping_config_dict
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from tests.sentry.grouping import grouping_input as grouping_inputs


def main():
    configs = [
        get_default_grouping_config_dict(config_name)
        for config_name in sorted(CONFIGURATIONS.keys())
    ]

    print("STRATEGY                    TIME (s)  AVG. TIME (s)")
    for config in configs:
        test_configuration(config)


def test_configuration(config):
    start_time = time()

    for grouping_input in grouping_inputs:

        event = grouping_input.create_event(config)

        # Make sure we don't need to touch the DB here because this would
        # break stuff later on.
        event.project = None

        event.get_hashes()

    delta = time() - start_time
    avg = delta / len(grouping_inputs)
    print(f"{config['id']:<25} {delta:>10.03f}{avg:>15.03f}")


if __name__ == "__main__":
    main()
