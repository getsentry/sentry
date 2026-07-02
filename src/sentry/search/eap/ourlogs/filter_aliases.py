from sentry.search.eap.spans.filter_aliases import (
    release_filter_converter,
    release_stage_filter_converter,
    semver_build_filter_converter,
    semver_filter_converter,
    semver_package_filter_converter,
)
from sentry.search.events import constants

OURLOG_FILTER_ALIAS_DEFINITIONS = {
    constants.RELEASE_ALIAS: release_filter_converter,
    constants.RELEASE_STAGE_ALIAS: release_stage_filter_converter,
    constants.SEMVER_ALIAS: semver_filter_converter,
    constants.SEMVER_PACKAGE_ALIAS: semver_package_filter_converter,
    constants.SEMVER_BUILD_ALIAS: semver_build_filter_converter,
}
