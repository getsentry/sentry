from sentry.conf.server import DEFAULT_GROUPING_CONFIG
from sentry.grouping.api import get_default_grouping_config_dict, load_grouping_config
from sentry.grouping.grouping_info import get_grouping_info
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event


class GroupingInfoTest(TestCase):
    def test_get_grouping_info_error_event(self) -> None:
        grouping_config = load_grouping_config(get_default_grouping_config_dict())
        event = save_new_event({"message": "Dogs are great!"}, self.project)

        grouping_info = get_grouping_info(grouping_config, self.project, event)

        assert grouping_info["default"]["type"] == "component"
        assert grouping_info["default"]["description"] == "message"
        assert grouping_info["default"]["component"]["contributes"] is True
        assert grouping_info["default"]["config"]["id"] == DEFAULT_GROUPING_CONFIG
        assert grouping_info["default"]["key"] == "default"

    def test_error_event(self) -> None:
        grouping_config = load_grouping_config(get_default_grouping_config_dict())
        event = save_new_event(
            {
                "title": "FailedToFetchError('Charlie didn't bring the ball back')",
                "exception": {
                    "values": [
                        {
                            "type": "FailedToFetchError",
                            "value": "Charlie didn't bring the ball back",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "play_fetch",
                                        "filename": "dogpark.py",
                                        "context_line": "raise FailedToFetchError('Charlie didn't bring the ball back')",
                                        "in_app": True,
                                    },
                                    {
                                        "function": "entertain_dogs",
                                        "filename": "dogpark.py",
                                        "context_line": "play_fetch(ball)",
                                        "in_app": False,
                                    },
                                    {
                                        "function": "go_to_dogpark",
                                        "filename": "dogpark.py",
                                        "context_line": "entertain_dogs(dogs)",
                                        "in_app": None,
                                    },
                                ]
                            },
                        }
                    ]
                },
            },
            self.project,
        )

        grouping_info = get_grouping_info(grouping_config, self.project, event)

        assert grouping_info["app"]["type"] == "component"
        assert grouping_info["app"]["description"] == "in-app exception stack-trace"
        assert grouping_info["app"]["component"]["contributes"] is True
        assert grouping_info["app"]["config"]["id"] == DEFAULT_GROUPING_CONFIG
        assert grouping_info["app"]["key"] == "app"

        assert grouping_info["app"]["component"]["values"][0]["id"] == "exception"
        exception = grouping_info["app"]["component"]["values"][0]

        assert exception["values"][0]["id"] == "stacktrace"
        stacktrace = exception["values"][0]

        # Frame `in_app` and `client_in_app` values are included
        assert stacktrace["values"][0]["id"] == "frame"
        assert stacktrace["values"][0]["in_app"] is True
        assert stacktrace["values"][0]["client_in_app"] is True
        assert stacktrace["values"][1]["id"] == "frame"
        assert stacktrace["values"][1]["in_app"] is False
        assert stacktrace["values"][1]["client_in_app"] is False
        assert stacktrace["values"][2]["id"] == "frame"
        assert stacktrace["values"][2]["in_app"] is False
        assert stacktrace["values"][2]["client_in_app"] is None
