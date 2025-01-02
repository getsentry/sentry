from unittest.mock import patch

import pytest

from sentry.eventstream.base import GroupState
from sentry.rules.conditions.event_attribute import EventAttributeCondition, attribute_registry
from sentry.rules.match import MatchType
from sentry.utils.registry import NoRegistrationExistsError
from sentry.workflow_engine.models.data_condition import Condition
from sentry.workflow_engine.types import WorkflowJob
from tests.sentry.workflow_engine.handlers.condition.test_base import ConditionTestCase


class TestEventAttributeCondition(ConditionTestCase):
    condition = Condition.EVENT_ATTRIBUTE
    rule_cls = EventAttributeCondition
    payload = {
        "id": EventAttributeCondition.id,
        "match": MatchType.EQUAL,
        "value": "php",
        "attribute": "platform",
    }

    def get_event(self, **kwargs):
        data = {
            "message": "hello world",
            "request": {"method": "GET", "url": "http://example.com/"},
            "user": {
                "id": "1",
                "ip_address": "127.0.0.1",
                "email": "foo@example.com",
                "username": "foo",
            },
            "exception": {
                "values": [
                    {
                        "type": "SyntaxError",
                        "value": "hello world",
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "example.php",
                                    "module": "example",
                                    "context_line": 'echo "hello";',
                                    "abs_path": "path/to/example.php",
                                }
                            ]
                        },
                        "thread_id": 1,
                    }
                ]
            },
            "tags": [("environment", "production")],
            "extra": {"foo": {"bar": "baz"}, "biz": ["baz"], "bar": "foo"},
            "platform": "php",
            "sdk": {"name": "sentry.javascript.react", "version": "6.16.1"},
            "contexts": {
                "response": {
                    "type": "response",
                    "status_code": 500,
                },
                "device": {
                    "screen_width_pixels": 1920,
                    "screen_height_pixels": 1080,
                    "screen_dpi": 123,
                    "screen_density": 2.5,
                },
                "app": {
                    "in_foreground": True,
                },
                "unreal": {
                    "crash_type": "crash",
                },
                "os": {"distribution_name": "ubuntu", "distribution_version": "22.04"},
            },
            "threads": {
                "values": [
                    {
                        "id": 1,
                        "main": True,
                    },
                ],
            },
        }
        data.update(kwargs)
        event = self.store_event(data, project_id=self.project.id)
        return event

    def setup_group_and_job(self):
        self.group = self.create_group(project=self.project)
        self.group_event = self.event.for_group(self.group)
        self.job = WorkflowJob(
            {
                "event": self.group_event,
                "group_state": GroupState(
                    {
                        "id": 1,
                        "is_regression": False,
                        "is_new": False,
                        "is_new_group_environment": False,
                    }
                ),
            }
        )

    def error_setup(self):
        self.event = self.get_event(
            exception={
                "values": [
                    {
                        "type": "Generic",
                        "value": "hello world",
                        "mechanism": {"type": "UncaughtExceptionHandler", "handled": False},
                    }
                ],
            }
        )
        self.setup_group_and_job()

    def setUp(self):
        self.event = self.get_event()
        self.setup_group_and_job()
        self.dc = self.create_data_condition(
            type=self.condition,
            comparison={"match": MatchType.EQUAL, "attribute": "platform", "value": "php"},
            condition_result=True,
        )

    def test_dual_write(self):
        dcg = self.create_data_condition_group()
        dc = self.translate_to_data_condition(self.payload, dcg)

        assert dc.type == self.condition
        assert dc.comparison == {
            "match": MatchType.EQUAL,
            "value": "php",
            "attribute": "platform",
        }
        assert dc.condition_result is True
        assert dc.condition_group == dcg

    def test_not_in_registry(self):
        with pytest.raises(NoRegistrationExistsError):
            attribute_registry.get("transaction")
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "transaction",
            "value": "asdf",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_equals(self):
        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "platform", "value": "php"}
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "platform", "value": "python"}
        self.assert_does_not_pass(self.dc, self.job)

    def test_not_equals(self):
        self.dc.comparison = {"match": MatchType.NOT_EQUAL, "attribute": "platform", "value": "php"}
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.NOT_EQUAL,
            "attribute": "platform",
            "value": "python",
        }
        self.assert_passes(self.dc, self.job)

    def test_starts_with(self):
        self.dc.comparison = {
            "match": MatchType.STARTS_WITH,
            "attribute": "platform",
            "value": "ph",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.STARTS_WITH,
            "attribute": "platform",
            "value": "py",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_does_not_start_with(self):
        self.dc.comparison = {
            "match": MatchType.NOT_STARTS_WITH,
            "attribute": "platform",
            "value": "ph",
        }
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.NOT_STARTS_WITH,
            "attribute": "platform",
            "value": "py",
        }
        self.assert_passes(self.dc, self.job)

    def test_ends_with(self):
        self.dc.comparison = {"match": MatchType.ENDS_WITH, "attribute": "platform", "value": "hp"}
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.ENDS_WITH,
            "attribute": "platform",
            "value": "thon",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_does_not_end_with(self):
        self.dc.comparison = {
            "match": MatchType.NOT_ENDS_WITH,
            "attribute": "platform",
            "value": "hp",
        }
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.NOT_ENDS_WITH,
            "attribute": "platform",
            "value": "thon",
        }
        self.assert_passes(self.dc, self.job)

    def test_contains(self):
        self.dc.comparison = {"match": MatchType.CONTAINS, "attribute": "platform", "value": "p"}
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {"match": MatchType.CONTAINS, "attribute": "platform", "value": "z"}
        self.assert_does_not_pass(self.dc, self.job)

    def test_contains_message(self):
        self.dc.comparison = {"match": MatchType.CONTAINS, "attribute": "message", "value": "hello"}
        self.assert_passes(self.dc, self.job)

        # Validate that this searches message in the same way that snuba does
        self.event = self.get_event(message="")
        self.setup_group_and_job()
        # This should still pass, even though the message is now empty
        self.dc.comparison = {"match": MatchType.CONTAINS, "attribute": "message", "value": "hello"}
        self.assert_passes(self.dc, self.job)

        # The search should also include info from the exception if present
        self.dc.comparison = {
            "match": MatchType.CONTAINS,
            "attribute": "message",
            "value": "SyntaxError",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.CONTAINS,
            "attribute": "message",
            "value": "not present",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_does_not_contain(self):
        self.dc.comparison = {
            "match": MatchType.NOT_CONTAINS,
            "attribute": "platform",
            "value": "p",
        }
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.NOT_CONTAINS,
            "attribute": "platform",
            "value": "z",
        }
        self.assert_passes(self.dc, self.job)

    def test_message(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "message",
            "value": "hello world",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "message", "value": "php"}
        self.assert_does_not_pass(self.dc, self.job)

    def test_environment(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "environment",
            "value": "production",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "environment",
            "value": "staging",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_compares_case_insensitive(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "environment",
            "value": "PRODUCTION",
        }
        self.assert_passes(self.dc, self.job)

    def test_compare_int_value(self):
        self.event.data["extra"]["number"] = 1
        self.setup_group_and_job()
        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "extra.number", "value": "1"}
        self.assert_passes(self.dc, self.job)

    def test_http_method(self):
        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "http.method", "value": "GET"}
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "http.method", "value": "POST"}
        self.assert_does_not_pass(self.dc, self.job)

    def test_http_url(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "http.url",
            "value": "http://example.com/",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "http.url",
            "value": "http://foo.com/",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_http_status_code(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "http.status_code",
            "value": "500",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "http.status_code",
            "value": "400",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_user_id(self):
        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "user.id", "value": "1"}
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "user.id", "value": "2"}
        self.assert_does_not_pass(self.dc, self.job)

    def test_user_ip_address(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "user.ip_address",
            "value": "127.0.0.1",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "user.ip_address",
            "value": "2",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_user_email(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "user.email",
            "value": "foo@example.com",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "user.email", "value": "2"}
        self.assert_does_not_pass(self.dc, self.job)

    def test_user_username(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "user.username",
            "value": "foo",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "user.username", "value": "2"}
        self.assert_does_not_pass(self.dc, self.job)

    def test_exception_type(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "exception.type",
            "value": "SyntaxError",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "exception.type",
            "value": "TypeError",
        }
        self.assert_does_not_pass(self.dc, self.job)

    @patch("sentry.eventstore.models.get_interfaces", return_value={})
    def test_exception_type_keyerror(self, mock_get_interfaces):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "exception.type",
            "value": "SyntaxError",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_error_handled(self):
        self.error_setup()
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "error.handled",
            "value": "False",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "error.handled",
            "value": "True",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_error_handled_not_defined(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "error.handled",
            "value": "True",
        }
        self.assert_does_not_pass(self.dc, self.job)

    @patch("sentry.eventstore.models.get_interfaces", return_value={})
    def test_error_handled_keyerror(self, mock_get_interfaces):
        self.error_setup()
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "error.handled",
            "value": "False",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_error_unhandled(self):
        self.error_setup()
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "error.unhandled",
            "value": "True",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "error.unhandled",
            "value": "False",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_exception_value(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "exception.value",
            "value": "hello world",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "exception.value",
            "value": "foo bar",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_sdk_name(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "sdk.name",
            "value": "sentry.javascript.react",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "sdk.name",
            "value": "sentry.python",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_stacktrace_filename(self):
        """Stacktrace.filename should match frames anywhere in the stack."""

        self.event = self.get_event(
            exception={
                "values": [
                    {
                        "type": "SyntaxError",
                        "value": "hello world",
                        "stacktrace": {
                            "frames": [
                                {"filename": "example.php", "module": "example"},
                                {"filename": "somecode.php", "module": "somecode"},
                                {"filename": "othercode.php", "module": "othercode"},
                            ]
                        },
                    }
                ]
            }
        )
        self.setup_group_and_job()

        # correctly matching filenames, at various locations in the stacktrace
        for value in ["example.php", "somecode.php", "othercode.php"]:
            self.dc.comparison = {
                "match": MatchType.EQUAL,
                "attribute": "stacktrace.filename",
                "value": value,
            }
            self.assert_passes(self.dc, self.job)

        # non-matching filename
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "stacktrace.filename",
            "value": "foo.php",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_stacktrace_attributeerror(self):
        self.event = self.get_event(
            exception={
                "values": [
                    {
                        "type": "SyntaxError",
                        "value": "hello world",
                    }
                ]
            }
        )
        # hack to trigger attributeerror
        self.event.interfaces["exception"]._data["values"][0] = None
        self.setup_group_and_job()

        for value in ["example.php", "somecode.php", "othercode.php"]:
            self.dc.comparison = {
                "match": MatchType.EQUAL,
                "attribute": "stacktrace.filename",
                "value": value,
            }
            self.assert_does_not_pass(self.dc, self.job)

    def test_stacktrace_module(self):
        """Stacktrace.module should match frames anywhere in the stack."""

        self.event = self.get_event(
            exception={
                "values": [
                    {
                        "type": "SyntaxError",
                        "value": "hello world",
                        "stacktrace": {
                            "frames": [
                                {"filename": "example.php", "module": "example"},
                                {"filename": "somecode.php", "module": "somecode"},
                                {"filename": "othercode.php", "module": "othercode"},
                            ]
                        },
                    }
                ]
            }
        )
        self.setup_group_and_job()

        # correctly matching modules, at various locations in the stacktrace
        for value in ["example", "somecode", "othercode"]:
            self.dc.comparison = {
                "match": MatchType.EQUAL,
                "attribute": "stacktrace.module",
                "value": value,
            }
            self.assert_passes(self.dc, self.job)

        # non-matching module
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "stacktrace.module",
            "value": "foo",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_stacktrace_code(self):
        """Stacktrace.code should match frames anywhere in the stack."""

        self.event = self.get_event(
            exception={
                "values": [
                    {
                        "type": "NameError",
                        "value": "name 'hi' is not defined",
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "example.py",
                                    "module": "example",
                                    "function": "foo",
                                    "context_line": "somecode.bar()",
                                },
                                {
                                    "filename": "somecode.py",
                                    "module": "somecode",
                                    "function": "bar",
                                    "context_line": "othercode.baz()",
                                },
                                {
                                    "filename": "othercode.py",
                                    "module": "othercode",
                                    "function": "baz",
                                    "context_line": "hi()",
                                },
                            ]
                        },
                    }
                ]
            }
        )
        self.setup_group_and_job()

        # correctly matching code, at various locations in the stacktrace
        for value in ["somecode.bar()", "othercode.baz()", "hi()"]:
            self.dc.comparison = {
                "match": MatchType.EQUAL,
                "attribute": "stacktrace.code",
                "value": value,
            }
            self.assert_passes(self.dc, self.job)

        # non-matching code
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "stacktrace.code",
            "value": "foo",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_stacktrace_abs_path(self):
        """Stacktrace.abs_path should match frames anywhere in the stack."""

        self.event = self.get_event(
            exception={
                "values": [
                    {
                        "type": "SyntaxError",
                        "value": "hello world",
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "example.php",
                                    "module": "example",
                                    "abs_path": "path/to/example.php",
                                },
                                {
                                    "filename": "somecode.php",
                                    "module": "somecode",
                                    "abs_path": "path/to/somecode.php",
                                },
                                {
                                    "filename": "othercode.php",
                                    "module": "othercode",
                                    "abs_path": "path/to/othercode.php",
                                },
                            ]
                        },
                    }
                ]
            }
        )
        self.setup_group_and_job()

        # correctly matching abs_paths, at various locations in the stacktrace
        for value in ["path/to/example.php", "path/to/somecode.php", "path/to/othercode.php"]:
            self.dc.comparison = {
                "match": MatchType.EQUAL,
                "attribute": "stacktrace.abs_path",
                "value": value,
            }
            self.assert_passes(self.dc, self.job)

        # non-matching abs_path
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "stacktrace.abs_path",
            "value": "path/to/foo.php",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_stacktrace_package(self):
        """Stacktrace.package should match frames anywhere in the stack."""

        self.event = self.get_event(
            exception={
                "values": [
                    {
                        "type": "SyntaxError",
                        "value": "hello world",
                        "stacktrace": {
                            "frames": [
                                {"filename": "example.php", "package": "package/example.lib"},
                                {
                                    "filename": "somecode.php",
                                    "package": "package/otherpackage.lib",
                                },
                                {
                                    "filename": "othercode.php",
                                    "package": "package/somepackage.lib",
                                },
                            ]
                        },
                    }
                ]
            }
        )
        self.setup_group_and_job()

        # correctly matching filenames, at various locations in the stacktrace
        for value in ["package/example.lib", "package/otherpackage.lib", "package/somepackage.lib"]:
            self.dc.comparison = {
                "match": MatchType.EQUAL,
                "attribute": "stacktrace.package",
                "value": value,
            }
            self.assert_passes(self.dc, self.job)

        # non-matching filename
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "stacktrace.package",
            "value": "package/otherotherpackage.lib",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_extra_simple_value(self):
        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "extra.bar", "value": "foo"}
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "extra.bar", "value": "bar"}
        self.assert_does_not_pass(self.dc, self.job)

    def test_extra_nested_value(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "extra.foo.bar",
            "value": "baz",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "extra.foo.bar",
            "value": "bar",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_extra_nested_list(self):
        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "extra.biz", "value": "baz"}
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "extra.biz", "value": "bar"}
        self.assert_does_not_pass(self.dc, self.job)

    def test_event_type(self):
        self.event.data["type"] = "error"
        self.setup_group_and_job()
        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "type", "value": "error"}
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {"match": MatchType.EQUAL, "attribute": "type", "value": "csp"}
        self.assert_does_not_pass(self.dc, self.job)

    def test_device_screen_width_pixels(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "device.screen_width_pixels",
            "value": "1920",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "device.screen_width_pixels",
            "value": "400",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_device_screen_height_pixels(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "device.screen_height_pixels",
            "value": "1080",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "device.screen_height_pixels",
            "value": "400",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_device_screen_dpi(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "device.screen_dpi",
            "value": "123",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "device.screen_dpi",
            "value": "400",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_device_screen_density(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "device.screen_density",
            "value": "2.5",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "device.screen_density",
            "value": "400",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_app_in_foreground(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "app.in_foreground",
            "value": "True",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "app.in_foreground",
            "value": "False",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_os_distribution_name_and_version(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "os.distribution_name",
            "value": "ubuntu",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "os.distribution_name",
            "value": "slackware",
        }
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "os.distribution_version",
            "value": "22.04",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "os.distribution_version",
            "value": "20.04",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_unreal_crash_type(self):
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "unreal.crash_type",
            "value": "Crash",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "unreal.crash_type",
            "value": "NoCrash",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_does_not_error_with_none(self):
        self.event = self.get_event(
            exception={
                "values": [
                    None,
                    {
                        "type": "SyntaxError",
                        "value": "hello world",
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "example.php",
                                    "module": "example",
                                    "context_line": 'echo "hello";',
                                    "abs_path": "path/to/example.php",
                                }
                            ]
                        },
                        "thread_id": 1,
                    },
                ]
            }
        )
        self.setup_group_and_job()
        self.dc.comparison = {
            "match": MatchType.EQUAL,
            "attribute": "exception.type",
            "value": "SyntaxError",
        }
        self.assert_passes(self.dc, self.job)

    def test_attr_is_in(self):
        self.dc.comparison = {
            "match": MatchType.IS_IN,
            "attribute": "platform",
            "value": "php, python",
        }
        self.assert_passes(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.IS_IN,
            "attribute": "platform",
            "value": "python, ruby",
        }
        self.assert_does_not_pass(self.dc, self.job)

    def test_attr_not_in(self):
        self.dc.comparison = {
            "match": MatchType.NOT_IN,
            "attribute": "platform",
            "value": "php, python",
        }
        self.assert_does_not_pass(self.dc, self.job)

        self.dc.comparison = {
            "match": MatchType.NOT_IN,
            "attribute": "platform",
            "value": "python, ruby",
        }
        self.assert_passes(self.dc, self.job)
