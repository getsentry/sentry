import pytest

from sentry.search.eap.constants import SearchType
from sentry.search.eap.utils import serialize_search_type


@pytest.mark.parametrize(
    ("search_type", "expected"),
    [
        ("string", "string"),
        ("boolean", "boolean"),
        ("array", "array"),
        ("integer", "number"),
        ("duration", "number"),
    ],
)
def test_serialize_search_type_maps_to_the_public_type_name(
    search_type: SearchType, expected: str
) -> None:
    assert serialize_search_type(search_type) == expected
