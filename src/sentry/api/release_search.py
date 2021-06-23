from functools import partial

from sentry.api.event_search import SearchConfig, default_config, parse_search_query
from sentry.search.events.constants import SEMVER_ALIAS

RELEASE_FREE_TEXT_KEY = "release"

release_search_config = SearchConfig.create_from(
    default_config,
    allowed_keys={SEMVER_ALIAS},
    allow_boolean=False,
    free_text_key=RELEASE_FREE_TEXT_KEY,
)
parse_search_query = partial(parse_search_query, config=release_search_config)
