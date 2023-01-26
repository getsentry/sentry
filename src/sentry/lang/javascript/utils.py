from django.conf import settings

from sentry import options

SYMBOLICATOR_SOURCEMAPS_INTERNAL_PROJECTS_OPTION = (
    "symbolicator.sourcemaps-processing-internal-projects"
)
SYMBOLICATOR_SOURCEMAPS_SAMPLE_RATE_OPTION = "symbolicator.sourcemaps-processing-sample-rate"


def should_use_symbolicator_for_sourcemaps(project_id: int) -> bool:
    # Internal Sentry projects
    # 11276 - sentry/javascript project for forced dogfooding
    # SENTRY_PROJECT - default project for all installations
    # SENTRY_FRONTEND_PROJECT - configurable default frontend project
    if options.get(SYMBOLICATOR_SOURCEMAPS_INTERNAL_PROJECTS_OPTION, False) and project_id in (
        11276,
        settings.SENTRY_PROJECT,
        settings.SENTRY_FRONTEND_PROJECT,
    ):
        return True

    return project_id % 1000 < options.get(SYMBOLICATOR_SOURCEMAPS_SAMPLE_RATE_OPTION, 0.0) * 1000
