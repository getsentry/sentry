from sentry.conf.server import DEFAULT_GROUPING_CONFIG
from sentry.grouping.api import _load_default_grouping_config
from sentry.grouping.grouping_info import get_grouping_info
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event


class GroupingInfoTest(TestCase):
    def test_get_grouping_info_error_event(self) -> None:
        default_grouping_config = _load_default_grouping_config()
        event = save_new_event({"message": "Dogs are great!"}, self.project)

        grouping_info = get_grouping_info(default_grouping_config, self.project, event)

        assert grouping_info["default"]["type"] == "component"
        assert grouping_info["default"]["description"] == "message"
        assert grouping_info["default"]["component"]["contributes"] is True
        assert grouping_info["default"]["config"]["id"] == DEFAULT_GROUPING_CONFIG
        assert grouping_info["default"]["key"] == "default"
