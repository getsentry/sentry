from unittest import TestCase

from sentry.eventtypes import ErrorEvent
from sentry.testutils.silo import region_silo_test


@region_silo_test
class ErrorEventTest(TestCase):
    def test_get_metadata(self):
        inst = ErrorEvent()
        data = {"exception": {"values": [{"type": "Exception", "value": "Foo"}]}}
        assert inst.get_metadata(data) == {
            "type": "Exception",
            "value": "Foo",
            "display_title_with_tree_label": False,
        }

    def test_get_metadata_none(self):
        inst = ErrorEvent()
        data = {"exception": {"values": [{"type": None, "value": None, "stacktrace": {}}]}}
        assert inst.get_metadata(data) == {
            "type": "Error",
            "value": "",
            "display_title_with_tree_label": False,
        }

    def test_get_metadata_function(self):
        inst = ErrorEvent()
        data = {
            "platform": "native",
            "exception": {
                "values": [
                    {
                        "stacktrace": {
                            "frames": [
                                {"in_app": True, "function": "void top_func(int)"},
                                {"in_app": False, "function": "void invalid_func(int)"},
                                {"in_app": True, "function": "<unknown>"},
                            ]
                        }
                    }
                ]
            },
        }
        assert inst.get_metadata(data) == {
            "type": "Error",
            "value": "",
            "function": "top_func",
            "display_title_with_tree_label": True,  # native!
        }

    def test_get_metadata_function_none_frame(self):
        inst = ErrorEvent()
        data = {"exception": {"values": [{"stacktrace": {"frames": [None]}}]}}
        assert inst.get_metadata(data) == {
            "type": "Error",
            "value": "",
            "display_title_with_tree_label": False,
        }

    def test_get_metadata_multiple_exceptions_default(self):
        inst = ErrorEvent()
        data = {
            "exception": {
                "values": [
                    {"type": "Exception", "value": "Bar"},
                    {"type": "Exception", "value": "Foo"},
                ]
            }
        }
        assert inst.get_metadata(data) == {
            "type": "Exception",
            "value": "Foo",
            "display_title_with_tree_label": False,
        }

    def test_get_metadata_multiple_exceptions_main_indicated(self):
        inst = ErrorEvent()
        data = {
            "main_exception_id": 1,
            "exception": {
                "values": [
                    {"type": "Exception", "value": "Bar", "mechanism": {"exception_id": 1}},
                    {"type": "Exception", "value": "Foo", "mechanism": {"exception_id": 0}},
                ]
            },
        }
        assert inst.get_metadata(data) == {
            "type": "Exception",
            "value": "Bar",
            "display_title_with_tree_label": False,
        }

    def test_get_title_none_value(self):
        inst = ErrorEvent()
        result = inst.get_title({"type": "Error", "value": None})
        assert result == "Error"

    def test_get_title_eliminates_values_with_newline(self):
        inst = ErrorEvent()
        result = inst.get_title({"type": "Error", "value": "foo\nbar"})
        assert result == "Error: foo"

    def test_get_title_handles_empty_value(self):
        inst = ErrorEvent()
        result = inst.get_title({"type": "Error", "value": ""})
        assert result == "Error"
