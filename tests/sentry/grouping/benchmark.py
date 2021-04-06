from time import time

import click

from sentry.runner import configure

configure()

from sentry.utils.glob import glob_match
from sentry.stacktraces.functions import trim_function_name

import sentry_sdk

sentry_sdk.init("")

from sentry.grouping.api import get_default_grouping_config_dict
from sentry.grouping.strategies.configurations import CONFIGURATIONS
from tests.sentry.grouping import grouping_input as grouping_inputs


def main():
    print("Loading test cases...")
    test_cases = [
        (get_default_grouping_config_dict(config_name), grouping_input)
        for config_name in CONFIGURATIONS.keys()
        for grouping_input in grouping_inputs
    ]

    print("Grouping...")
    start_time = time()
    with click.progressbar(test_cases) as progress_bar:
        for grouping_config, grouping_input in progress_bar:

            glob_match.cache_clear()
            trim_function_name.cache_clear()

            event = grouping_input.create_event(grouping_config)

            # Make sure we don't need to touch the DB here because this would
            # break stuff later on.
            event.project = None

            event.get_hashes()

    print(f"Took {time() - start_time} seconds.")


if __name__ == "__main__":
    main()
