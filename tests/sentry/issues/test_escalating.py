# import unittest
# from typing import Dict, List
from datetime import datetime

from sentry.issues.escalating import query_groups_past_counts
from sentry.utils.snuba import to_start_of_hour
from sentry.models import Group

# from sentry.issues.escalating import InvalidProjectsToGroupsMap, query_groups_past_counts
# from sentry.utils.snuba import SnubaError
from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.samples import load_data


class HistoricGroupCounts(TestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.timestamp = before_now(minutes=1)
        data = load_data("python", timestamp=self.timestamp)
        self.event = self.store_event(data, project_id=self.project.id)

    def test_query(self) -> None:
        assert query_groups_past_counts(Group.objects.all()) == [
            {
                "group_id": self.event.group_id,
                "hourBucket": to_start_of_hour(self.timestamp),
                "project_id": self.event.project_id,
            }
        ]


# class EscalatingUnitTest(unittest.TestCase):
#     @pytest.mark.parametrize("test_input", [{1: []}, {}])
#     def test_query_invalid_test_input(self, test_input: Dict[int, List[int]]) -> None:
#         with pytest.raises(InvalidProjectsToGroupsMap):
#             query_groups_past_counts(test_input)
#
#     @pytest.mark.parametrize("test_input", [{"1": ["32"]}])
#     def test_query_fail_snuba_conditions(self, test_input: Dict[int, List[int]]) -> None:
#         with pytest.raises(SnubaError):
#             query_groups_past_counts(test_input)
