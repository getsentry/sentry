from functools import partial

from sentry.api.event_search import SearchConfig, default_config, parse_search_query
from sentry.search.events.constants import (
    RELEASE_ALIAS,
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_PACKAGE_ALIAS,
)

RELEASE_FREE_TEXT_KEY = "release_free_text"
INVALID_SEMVER_MESSAGE = (
    'Invalid format of semantic version. For searching non-semver releases, use "release:" instead.'
)

release_search_config = SearchConfig.create_from(
    default_config,
    allowed_keys={
        RELEASE_ALIAS,
        RELEASE_STAGE_ALIAS,
        SEMVER_ALIAS,
        SEMVER_BUILD_ALIAS,
        SEMVER_PACKAGE_ALIAS,
    },
    allow_boolean=False,
    free_text_key=RELEASE_FREE_TEXT_KEY,
)
parse_search_query = partial(parse_search_query, config=release_search_config)
