import uuid

import pytest
from rest_framework.exceptions import ParseError

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.replays.usecases.query import handle_search_filters
from sentry.replays.usecases.query.configs.existence import existence_search_config


@pytest.mark.parametrize(
    "key, op, value, raises",
    [
        ("id", "IN", [str(uuid.uuid4())], None),
        ("id", "=", str(uuid.uuid4()), None),
        ("id", "!=", str(uuid.uuid4()), ParseError),
        ("id", "NOT IN", [str(uuid.uuid4())], ParseError),
        ("id", ">", str(uuid.uuid4()), ParseError),
        ("id", ">=", str(uuid.uuid4()), ParseError),
        ("id", "<", str(uuid.uuid4()), ParseError),
        ("id", "<=", str(uuid.uuid4()), ParseError),
        ("replay_id", "IN", [str(uuid.uuid4())], None),
        ("replay_id", "=", str(uuid.uuid4()), None),
        ("replay_id", "!=", str(uuid.uuid4()), ParseError),
        ("replay_id", "NOT IN", [str(uuid.uuid4())], ParseError),
        ("replay_id", ">", str(uuid.uuid4()), ParseError),
        ("replay_id", ">=", str(uuid.uuid4()), ParseError),
        ("replay_id", "<", str(uuid.uuid4()), ParseError),
        ("replay_id", "<=", str(uuid.uuid4()), ParseError),
    ],
)
def test_existence_search_config(key, op, value, raises):
    """
    Assert existence search config only allows IN and equality operators.
    """
    search_filters = [SearchFilter(SearchKey(key), op, SearchValue(value))]

    if raises:
        with pytest.raises(raises):
            handle_search_filters(existence_search_config, search_filters)
    else:
        handle_search_filters(existence_search_config, search_filters)
