from __future__ import annotations

from typing import Any
from unittest import TestCase

from sentry.eventtypes.error import ErrorEvent
from sentry.testutils.pytest.fixtures import django_db_all


class GetMetadataTest(TestCase):
    def test_simple(self) -> None:
        inst = ErrorEvent()
        data = {"exception": {"values": [{"type": "Exception", "value": "Foo"}]}}
        assert inst.get_metadata(data) == {
            "type": "Exception",
            "value": "Foo",
            "synthetic": False,
        }

    def test_no_exception_type_or_value(self) -> None:
        inst = ErrorEvent()
        data: dict[str, dict[str, Any]] = {
            "exception": {"values": [{"type": None, "value": None, "stacktrace": {}}]}
        }
        assert inst.get_metadata(data) == {
            "type": "Error",
            "value": "",
            "synthetic": False,
        }

    def test_pulls_top_function(self) -> None:
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
            "synthetic": False,
        }

    def test_none_frame(self) -> None:
        inst = ErrorEvent()
        data = {"exception": {"values": [{"stacktrace": {"frames": [None]}}]}}
        assert inst.get_metadata(data) == {
            "type": "Error",
            "value": "",
            "synthetic": False,
        }

    def test_synthetic_records_type_and_flag(self) -> None:
        # Grouping ignores a synthetic type, but it is recorded anyway as a title of last resort.
        inst = ErrorEvent()
        data = {
            "exception": {
                "values": [
                    {
                        "type": "SIGSEGV",
                        "value": "Signal 11, Code 1",
                        "mechanism": {"type": "signal", "synthetic": True},
                    }
                ]
            }
        }
        assert inst.get_metadata(data) == {
            "type": "SIGSEGV",
            "value": "Signal 11, Code 1",
            "synthetic": True,
        }

    def test_non_synthetic_flag_is_written_as_false(self) -> None:
        # The flag is always written, never merely omitted. Group metadata is merged key by key
        # across a group's events and a merge cannot delete keys, so an omitted flag would let one
        # synthetic event mark the group synthetic forever. See `test_synthetic_flag_clears`.
        inst = ErrorEvent()
        data = {
            "exception": {
                "values": [
                    {
                        "type": "ValueError",
                        "value": "bad",
                        "mechanism": {"type": "signal"},
                    }
                ]
            }
        }
        assert inst.get_metadata(data) == {
            "type": "ValueError",
            "value": "bad",
            "synthetic": False,
        }

    def test_synthetic_flag_clears(self) -> None:
        # A group that saw a synthetic event and then a real one must end up describing the real
        # exception. This mirrors the metadata merge in `_process_existing_aggregate`.
        inst = ErrorEvent()
        synthetic = {
            "exception": {
                "values": [
                    {
                        "type": "SIGSEGV",
                        "value": "Signal 11, Code 1",
                        "mechanism": {"type": "signal", "synthetic": True},
                    }
                ]
            }
        }
        real = {"exception": {"values": [{"type": "ValueError", "value": "bad"}]}}

        merged = {**inst.get_metadata(synthetic), **inst.get_metadata(real)}

        assert merged == {"type": "ValueError", "value": "bad", "synthetic": False}
        assert inst.get_title(merged) == "ValueError: bad"

    def test_multiple_exceptions_default(self) -> None:
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
            "synthetic": False,
        }

    def test_multiple_exceptions_main_indicated(self) -> None:
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
            "synthetic": False,
        }


@django_db_all
class GetTitleTest(TestCase):
    def test_none_value(self) -> None:
        inst = ErrorEvent()
        result = inst.get_title({"type": "Error", "value": None})
        assert result == "Error"

    def test_trims_value_at_newline(self) -> None:
        inst = ErrorEvent()
        result = inst.get_title({"type": "Error", "value": "foo\nbar"})
        assert result == "Error: foo"

    def test_handles_empty_value(self) -> None:
        inst = ErrorEvent()
        result = inst.get_title({"type": "Error", "value": ""})
        assert result == "Error"

    def test_synthetic_prefers_the_crash_location(self) -> None:
        # Built by hand on purpose: the ordering inside `compute_title` only shows up once both
        # a type and a function have been recorded.
        inst = ErrorEvent()
        metadata = {
            "type": "SIGSEGV",
            "value": "Signal 11, Code 1",
            "function": "U3CCrashCaptureU3Ed__11_MoveNext",
            "synthetic": True,
        }
        assert inst.get_title(metadata) == "U3CCrashCaptureU3Ed__11_MoveNext"

    def test_synthetic_falls_back_to_the_type(self) -> None:
        # The case this change exists for, and it only holds end to end: recording the type is
        # what leaves `compute_title` something better than `<unknown>` when nothing symbolicated.
        inst = ErrorEvent()
        data = {
            "platform": "native",
            "exception": {
                "values": [
                    {
                        "type": "SIGSEGV",
                        "value": "Signal 11, Code 1",
                        "mechanism": {"type": "signal", "synthetic": True},
                        "stacktrace": {"frames": [{"in_app": True, "instruction_addr": "0x1"}]},
                    }
                ]
            },
        }
        assert inst.get_title(inst.get_metadata(data)) == "SIGSEGV: Signal 11, Code 1"

    def test_synthetic_with_nothing_to_show(self) -> None:
        inst = ErrorEvent()
        assert inst.get_title({"value": "", "synthetic": True}) == "<unknown>"

    def test_non_synthetic_still_prefers_the_type(self) -> None:
        # Only synthetic exceptions reorder; everything else is untouched.
        inst = ErrorEvent()
        metadata = {"type": "ValueError", "value": "bad", "function": "do_thing"}
        assert inst.get_title(metadata) == "ValueError: bad"

    def test_metadata_stored_before_this_change_is_untouched(self) -> None:
        # Forward-only: groups stored before this change have no `synthetic` key, so they take
        # the branch they always took and nothing re-titles on read.
        inst = ErrorEvent()
        assert inst.get_title({"value": "Signal 11, Code 1"}) == "<unknown>"
        assert inst.get_title({"value": "Signal 11, Code 1", "function": "top_func"}) == "top_func"
        assert inst.get_title({"type": "ValueError", "value": "bad"}) == "ValueError: bad"
