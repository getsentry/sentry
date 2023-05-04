import random

from sentry import options

SYMBOLICATOR_SOURCEMAPS_PROJECTS_OPTION = "symbolicator.sourcemaps-processing-projects"
SYMBOLICATOR_SOURCEMAPS_SAMPLE_RATE_OPTION = "symbolicator.sourcemaps-processing-sample-rate"
SYMBOLICATOR_SOURCEMAPS_AB_TEST_OPTION = "symbolicator.sourcemaps-processing-ab-test"


def should_use_symbolicator_for_sourcemaps(project_id: int) -> bool:
    # Internal Sentry projects
    # 11276 - sentry/javascript project for forced dogfooding
    # settings.SENTRY_PROJECT - default project for all installations
    # settings.SENTRY_FRONTEND_PROJECT - configurable default frontend project
    if project_id in options.get(SYMBOLICATOR_SOURCEMAPS_PROJECTS_OPTION):
        return True

    return options.get(SYMBOLICATOR_SOURCEMAPS_SAMPLE_RATE_OPTION) > random.random()


def do_sourcemaps_processing_ab_test() -> bool:
    return options.get(SYMBOLICATOR_SOURCEMAPS_AB_TEST_OPTION) > random.random()
