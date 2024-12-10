from sentry.grouping.grouping_info import get_grouping_info
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event


class GroupingInfoTest(TestCase):
    def test_get_grouping_info_error_event(self):
        event = save_new_event({"message": "Dogs are great!"}, self.project)

        grouping_info = get_grouping_info(DEFAULT_GROUPING_CONFIG, self.project, event)

        assert grouping_info["default"]["type"] == "component"
        assert grouping_info["default"]["description"] == "message"
        assert grouping_info["default"]["component"]["contributes"] is True
        assert grouping_info["default"]["config"]["id"] == DEFAULT_GROUPING_CONFIG
        assert grouping_info["default"]["key"] == "default"
