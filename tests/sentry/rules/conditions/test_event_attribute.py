from unittest.mock import patch

import pytest

from sentry.rules.conditions.event_attribute import EventAttributeCondition, attribute_registry
from sentry.rules.match import MatchType
from sentry.testutils.cases import RuleTestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils.registry import NoRegistrationExistsError

pytestmark = [requires_snuba]


class EventAttributeConditionTest(RuleTestCase):
    rule_cls = EventAttributeCondition

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

    def test_render_label(self):
        rule = self.get_rule(data={"match": MatchType.EQUAL, "attribute": "\xc3", "value": "\xc4"})
        assert rule.render_label() == "The event's \xc3 value equals \xc4"

    def test_not_in_registry(self):
        with pytest.raises(NoRegistrationExistsError):
            attribute_registry.get("transaction")

        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "transaction", "value": "asdf"}
        )
        self.assertDoesNotPass(rule, event)

    def test_equals(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "platform", "value": "php"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "platform", "value": "python"}
        )
        self.assertDoesNotPass(rule, event)

    def test_does_not_equal(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_EQUAL, "attribute": "platform", "value": "php"}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.NOT_EQUAL, "attribute": "platform", "value": "python"}
        )
        self.assertPasses(rule, event)

    def test_starts_with(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.STARTS_WITH, "attribute": "platform", "value": "ph"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.STARTS_WITH, "attribute": "platform", "value": "py"}
        )
        self.assertDoesNotPass(rule, event)

    def test_does_not_start_with(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_STARTS_WITH, "attribute": "platform", "value": "ph"}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.NOT_STARTS_WITH, "attribute": "platform", "value": "py"}
        )
        self.assertPasses(rule, event)

    def test_ends_with(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.ENDS_WITH, "attribute": "platform", "value": "hp"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.ENDS_WITH, "attribute": "platform", "value": "thon"}
        )
        self.assertDoesNotPass(rule, event)

    def test_does_not_end_with(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_ENDS_WITH, "attribute": "platform", "value": "hp"}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.NOT_ENDS_WITH, "attribute": "platform", "value": "thon"}
        )
        self.assertPasses(rule, event)

    def test_contains(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.CONTAINS, "attribute": "platform", "value": "p"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.CONTAINS, "attribute": "platform", "value": "z"}
        )
        self.assertDoesNotPass(rule, event)

    def test_contains_message(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.CONTAINS, "attribute": "message", "value": "hello"}
        )
        self.assertPasses(rule, event)

        # Validate that this searches message in the same way that snuba does
        event = self.get_event(message="")
        # This should still pass, even though the message is now empty
        rule = self.get_rule(
            data={"match": MatchType.CONTAINS, "attribute": "message", "value": "hello"}
        )
        self.assertPasses(rule, event)

        # The search should also include info from the exception if present
        rule = self.get_rule(
            data={"match": MatchType.CONTAINS, "attribute": "message", "value": "SyntaxError"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.CONTAINS, "attribute": "message", "value": "not present"}
        )
        self.assertDoesNotPass(rule, event)

    def test_does_not_contain(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_CONTAINS, "attribute": "platform", "value": "p"}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.NOT_CONTAINS, "attribute": "platform", "value": "z"}
        )
        self.assertPasses(rule, event)

    def test_message(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "message", "value": "hello world"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "message", "value": "php"}
        )
        self.assertDoesNotPass(rule, event)

    def test_environment(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "environment", "value": "production"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "environment", "value": "staging"}
        )
        self.assertDoesNotPass(rule, event)

    def test_compares_case_insensitive(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "environment", "value": "PRODUCTION"}
        )
        self.assertPasses(rule, event)

    def test_compare_int_value(self):
        event = self.get_event()
        event.data["extra"]["number"] = 1
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "extra.number", "value": "1"}
        )
        self.assertPasses(rule, event)

    def test_http_method(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "http.method", "value": "get"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "http.method", "value": "post"}
        )
        self.assertDoesNotPass(rule, event)

    def test_http_url(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "http.url", "value": "http://example.com/"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "http.url", "value": "http://foo.com"}
        )
        self.assertDoesNotPass(rule, event)

    def test_http_status_code(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "http.status_code", "value": "500"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "http.status_code", "value": "400"}
        )
        self.assertDoesNotPass(rule, event)

    def test_user_id(self):
        event = self.get_event()
        rule = self.get_rule(data={"match": MatchType.EQUAL, "attribute": "user.id", "value": "1"})
        self.assertPasses(rule, event)

        rule = self.get_rule(data={"match": MatchType.EQUAL, "attribute": "user.id", "value": "2"})
        self.assertDoesNotPass(rule, event)

    def test_user_ip_address(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "user.ip_address", "value": "127.0.0.1"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "user.ip_address", "value": "2"}
        )
        self.assertDoesNotPass(rule, event)

    def test_user_email(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "user.email", "value": "foo@example.com"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "user.email", "value": "2"}
        )
        self.assertDoesNotPass(rule, event)

    def test_user_username(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "user.username", "value": "foo"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "user.username", "value": "2"}
        )
        self.assertDoesNotPass(rule, event)

    def test_exception_type(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "exception.type", "value": "SyntaxError"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "exception.type", "value": "TypeError"}
        )
        self.assertDoesNotPass(rule, event)

    @patch("sentry.eventstore.models.get_interfaces", return_value={})
    def test_exception_type_keyerror(self, mock_interface):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "exception.type", "value": "SyntaxError"}
        )
        self.assertDoesNotPass(rule, event)

    def test_error_handled(self):
        event = self.get_event(
            exception={
                "values": [
                    {
                        "type": "Generic",
                        "value": "hello world",
                        "mechanism": {"type": "UncaughtExceptionHandler", "handled": False},
                    }
                ]
            }
        )
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "error.handled", "value": "False"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "error.handled", "value": "True"}
        )
        self.assertDoesNotPass(rule, event)

    def test_error_handled_not_defined(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "error.handled", "value": "True"}
        )
        self.assertDoesNotPass(rule, event)

    @patch("sentry.eventstore.models.get_interfaces", return_value={})
    def test_error_handled_keyerror(self, mock_interface):
        event = self.get_event(
            exception={
                "values": [
                    {
                        "type": "Generic",
                        "value": "hello world",
                        "mechanism": {"type": "UncaughtExceptionHandler", "handled": False},
                    }
                ]
            }
        )
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "error.handled", "value": "False"}
        )
        self.assertDoesNotPass(rule, event)

    def test_error_unhandled(self):
        event = self.get_event(
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
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "error.unhandled", "value": "True"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "error.unhandled", "value": "False"}
        )
        self.assertDoesNotPass(rule, event)

    def test_exception_value(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "exception.value", "value": "hello world"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "exception.value", "value": "foo bar"}
        )
        self.assertDoesNotPass(rule, event)

    def test_sdk_name(self):
        event = self.get_event()
        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "sdk.name",
                "value": "sentry.javascript.react",
            }
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "sdk.name", "value": "sentry.python"}
        )
        self.assertDoesNotPass(rule, event)

    def test_stacktrace_filename(self):
        """Stacktrace.filename should match frames anywhere in the stack."""

        event = self.get_event(
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

        # correctly matching filenames, at various locations in the stacktrace
        for value in ["example.php", "somecode.php", "othercode.php"]:
            rule = self.get_rule(
                data={"match": MatchType.EQUAL, "attribute": "stacktrace.filename", "value": value}
            )
            self.assertPasses(rule, event)

        # non-matching filename
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "stacktrace.filename", "value": "foo.php"}
        )
        self.assertDoesNotPass(rule, event)

    def test_stacktrace_attributeerror(self):
        event = self.get_event(
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
        event.interfaces["exception"]._data["values"][0] = None

        for value in ["example.php", "somecode.php", "othercode.php"]:
            rule = self.get_rule(
                data={"match": MatchType.EQUAL, "attribute": "stacktrace.filename", "value": value}
            )
            self.assertDoesNotPass(rule, event)

    def test_stacktrace_module(self):
        """Stacktrace.module should match frames anywhere in the stack."""

        event = self.get_event(
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

        # correctly matching modules, at various locations in the stacktrace
        for value in ["example", "somecode", "othercode"]:
            rule = self.get_rule(
                data={"match": MatchType.EQUAL, "attribute": "stacktrace.module", "value": value}
            )
            self.assertPasses(rule, event)

        # non-matching module
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "stacktrace.module", "value": "foo"}
        )
        self.assertDoesNotPass(rule, event)

    def test_stacktrace_code(self):
        """Stacktrace.code should match frames anywhere in the stack."""

        event = self.get_event(
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

        # correctly matching code, at various locations in the stacktrace
        for value in ["somecode.bar()", "othercode.baz()", "hi()"]:
            rule = self.get_rule(
                data={"match": MatchType.EQUAL, "attribute": "stacktrace.code", "value": value}
            )
            self.assertPasses(rule, event)

        # non-matching code
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "stacktrace.code", "value": "foo"}
        )
        self.assertDoesNotPass(rule, event)

    def test_extra_simple_value(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "extra.bar", "value": "foo"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "extra.bar", "value": "bar"}
        )
        self.assertDoesNotPass(rule, event)

    def test_extra_nested_value(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "extra.foo.bar", "value": "baz"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "extra.foo.bar", "value": "bar"}
        )
        self.assertDoesNotPass(rule, event)

    def test_extra_nested_list(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "extra.biz", "value": "baz"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "extra.biz", "value": "bar"}
        )
        self.assertDoesNotPass(rule, event)

    def test_event_type(self):
        event = self.get_event()
        event.data["type"] = "error"
        rule = self.get_rule(data={"match": MatchType.EQUAL, "attribute": "type", "value": "error"})
        self.assertPasses(rule, event)

        rule = self.get_rule(data={"match": MatchType.EQUAL, "attribute": "type", "value": "csp"})
        self.assertDoesNotPass(rule, event)

    def test_stacktrace_abs_path(self):
        """Stacktrace.abs_path should match frames anywhere in the stack."""

        event = self.get_event(
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

        # correctly matching filenames, at various locations in the stacktrace
        for value in ["path/to/example.php", "path/to/somecode.php", "path/to/othercode.php"]:
            rule = self.get_rule(
                data={"match": MatchType.EQUAL, "attribute": "stacktrace.abs_path", "value": value}
            )
            self.assertPasses(rule, event)

        # non-matching filename
        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "stacktrace.abs_path",
                "value": "path/to/foo.php",
            }
        )
        self.assertDoesNotPass(rule, event)

    def test_stacktrace_package(self):
        """Stacktrace.package should match frames anywhere in the stack."""

        event = self.get_event(
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

        # correctly matching filenames, at various locations in the stacktrace
        for value in ["package/example.lib", "package/otherpackage.lib", "package/somepackage.lib"]:
            rule = self.get_rule(
                data={"match": MatchType.EQUAL, "attribute": "stacktrace.package", "value": value}
            )
            self.assertPasses(rule, event)

        # non-matching filename
        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "stacktrace.package",
                "value": "package/otherotherpackage.lib",
            }
        )
        self.assertDoesNotPass(rule, event)

    def test_device_screen_width_pixels(self):
        event = self.get_event()
        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "device.screen_width_pixels",
                "value": "1920",
            }
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "device.screen_width_pixels",
                "value": "400",
            }
        )
        self.assertDoesNotPass(rule, event)

    def test_device_screen_height_pixels(self):
        event = self.get_event()
        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "device.screen_height_pixels",
                "value": "1080",
            }
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "device.screen_height_pixels",
                "value": "400",
            }
        )
        self.assertDoesNotPass(rule, event)

    def test_device_screen_dpi(self):
        event = self.get_event()
        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "device.screen_dpi",
                "value": "123",
            }
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "device.screen_dpi",
                "value": "400",
            }
        )
        self.assertDoesNotPass(rule, event)

    def test_device_screen_density(self):
        event = self.get_event()
        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "device.screen_density",
                "value": "2.5",
            }
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "device.screen_density",
                "value": "400",
            }
        )
        self.assertDoesNotPass(rule, event)

    def test_app_in_foreground(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "app.in_foreground", "value": "True"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "app.in_foreground", "value": "False"}
        )
        self.assertDoesNotPass(rule, event)

    def test_os_distribution_name_and_version(self):
        event = self.get_event()
        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "os.distribution_name",
                "value": "ubuntu",
            }
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "os.distribution_version",
                "value": "22.04",
            }
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "os.distribution_name",
                "value": "slackware",
            }
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={
                "match": MatchType.EQUAL,
                "attribute": "os.distribution_version",
                "value": "20.04",
            }
        )
        self.assertDoesNotPass(rule, event)

    def test_unreal_crash_type(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "unreal.crash_type", "value": "Crash"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "unreal.crash_type", "value": "NoCrash"}
        )
        self.assertDoesNotPass(rule, event)

    def test_does_not_error_with_none(self):
        exception = {
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

        event = self.get_event(exception=exception)

        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": "exception.type", "value": "SyntaxError"}
        )
        self.assertPasses(rule, event)

    def test_attr_is_in(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.IS_IN, "attribute": "platform", "value": "php, python"}
        )
        self.assertPasses(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.IS_IN, "attribute": "platform", "value": "python"}
        )
        self.assertDoesNotPass(rule, event)

    def test_attr_not_in(self):
        event = self.get_event()
        rule = self.get_rule(
            data={"match": MatchType.NOT_IN, "attribute": "platform", "value": "php, python"}
        )
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule(
            data={"match": MatchType.NOT_IN, "attribute": "platform", "value": "python"}
        )
        self.assertPasses(rule, event)
