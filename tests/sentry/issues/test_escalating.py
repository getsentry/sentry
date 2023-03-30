from typing import Dict, List

import pytest

from sentry.issues.escalating import InvalidProjectsToGroupsMap, query_groups_past_counts
from sentry.utils.snuba import SnubaError


def test_query() -> None:
    assert query_groups_past_counts({1: [32], 5: []}) == []


@pytest.mark.parametrize("test_input", [{1: []}, {}])
def test_query_invalid_test_input(test_input: Dict[int, List[int]]) -> None:
    with pytest.raises(InvalidProjectsToGroupsMap):
        query_groups_past_counts(test_input)


@pytest.mark.parametrize("test_input", [{"1": ["32"]}])
def test_query_fail_snuba_conditions(test_input: Dict[int, List[int]]) -> None:
    with pytest.raises(SnubaError):
        query_groups_past_counts(test_input)
