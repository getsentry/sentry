from __future__ import absolute_import

from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.event_attribute import EventAttributeCondition, MatchType


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
                    }
                ]
            },
            "tags": [("environment", "production")],
            "extra": {"foo": {"bar": "baz"}, "biz": ["baz"], "bar": "foo"},
            "platform": "php",
        }
        data.update(kwargs)
        event = self.store_event(data, project_id=self.project.id)
        return event

    def test_render_label(self):
        rule = self.get_rule(
            data={"match": MatchType.EQUAL, "attribute": u"\xc3", "value": u"\xc4"}
        )
        assert rule.render_label() == u"The event's \xc3 value equals \xc4"

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
