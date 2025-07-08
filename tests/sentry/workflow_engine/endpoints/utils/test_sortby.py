import pytest
from rest_framework.exceptions import ValidationError

from sentry.workflow_engine.endpoints.utils.sortby import SortByParam


def test_sortby_parse():
    SORT_ATTRS = {
        "id": "id",
        "name": "name",
        "specialThing": "special_thing",
    }
    sort_by = SortByParam.parse("name", SORT_ATTRS)
    assert sort_by.db_field_name == "name"
    assert sort_by.db_order_by == ("name", "id")

    sort_by = SortByParam.parse("-specialThing", SORT_ATTRS)
    assert sort_by.db_field_name == "special_thing"
    assert sort_by.db_order_by == ("-special_thing", "-id")

    with pytest.raises(ValidationError, match=".*sortBy.*"):
        SortByParam.parse("not_a_valid_field", SORT_ATTRS)

    with pytest.raises(ValidationError, match=".*sortBy.*"):
        SortByParam.parse("special_thing", SORT_ATTRS)
