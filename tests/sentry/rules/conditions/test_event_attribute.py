from __future__ import absolute_import

from sentry.testutils.cases import RuleTestCase
from sentry.rules.conditions.event_attribute import (
    EventAttributeCondition, MatchType
)


class EventAttributeConditionTest(RuleTestCase):
    rule_cls = EventAttributeCondition

    def get_event(self):
        event = self.create_event(
            message='hello world',
            platform='php',
            data={
                'type': 'error',
                'sentry.interfaces.Http': {
                    'method': 'GET',
                    'url': 'http://example.com',
                },
                'sentry.interfaces.User': {
                    'id': '1',
                    'ip_address': '127.0.0.1',
                    'email': 'foo@example.com',
                    'username': 'foo',
                },
                'sentry.interfaces.Exception': {
                    'values': [
                        {
                            'type': 'SyntaxError',
                            'value': 'hello world',
                            'stacktrace': {
                                'frames': [
                                    {
                                        'filename': 'example.php',
                                        'module': 'example',
                                        'context_line': 'echo "hello";',
                                    }
                                ]
                            }
                        },
                    ],
                },
                'tags': [('environment', 'production')],
                'extra': {
                    'foo': {
                        'bar': 'baz',
                    },
                    'biz': ['baz'],
                    'bar': 'foo',
                }
            },
        )
        return event

    def test_render_label(self):
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': u'\xc3',
            'value': u'\xc4',
        })
        assert rule.render_label() == u'An event\'s \xc3 value equals \xc4'

    def test_equals(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'platform',
            'value': 'php',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'platform',
            'value': 'python',
        })
        self.assertDoesNotPass(rule, event)

    def test_does_not_equal(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.NOT_EQUAL,
            'attribute': 'platform',
            'value': 'php',
        })
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule({
            'match': MatchType.NOT_EQUAL,
            'attribute': 'platform',
            'value': 'python',
        })
        self.assertPasses(rule, event)

    def test_starts_with(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.STARTS_WITH,
            'attribute': 'platform',
            'value': 'ph',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.STARTS_WITH,
            'attribute': 'platform',
            'value': 'py',
        })
        self.assertDoesNotPass(rule, event)

    def test_ends_with(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.ENDS_WITH,
            'attribute': 'platform',
            'value': 'hp',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.ENDS_WITH,
            'attribute': 'platform',
            'value': 'thon',
        })
        self.assertDoesNotPass(rule, event)

    def test_contains(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.CONTAINS,
            'attribute': 'platform',
            'value': 'p',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.CONTAINS,
            'attribute': 'platform',
            'value': 'z',
        })
        self.assertDoesNotPass(rule, event)

    def test_does_not_contain(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.NOT_CONTAINS,
            'attribute': 'platform',
            'value': 'p',
        })
        self.assertDoesNotPass(rule, event)

        rule = self.get_rule({
            'match': MatchType.NOT_CONTAINS,
            'attribute': 'platform',
            'value': 'z',
        })
        self.assertPasses(rule, event)

    def test_message(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'message',
            'value': 'hello world',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'message',
            'value': 'php',
        })
        self.assertDoesNotPass(rule, event)

    def test_environment(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'environment',
            'value': 'production',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'environment',
            'value': 'staging',
        })
        self.assertDoesNotPass(rule, event)

    def test_http_method(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'http.method',
            'value': 'get',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'http.method',
            'value': 'post',
        })
        self.assertDoesNotPass(rule, event)

    def test_http_url(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'http.url',
            'value': 'http://example.com',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'http.url',
            'value': 'http://foo.com',
        })
        self.assertDoesNotPass(rule, event)

    def test_user_id(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'user.id',
            'value': '1',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'user.id',
            'value': '2',
        })
        self.assertDoesNotPass(rule, event)

    def test_user_ip_address(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'user.ip_address',
            'value': '127.0.0.1',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'user.ip_address',
            'value': '2',
        })
        self.assertDoesNotPass(rule, event)

    def test_user_email(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'user.email',
            'value': 'foo@example.com',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'user.email',
            'value': '2',
        })
        self.assertDoesNotPass(rule, event)

    def test_user_username(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'user.username',
            'value': 'foo',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'user.username',
            'value': '2',
        })
        self.assertDoesNotPass(rule, event)

    def test_exception_type(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'exception.type',
            'value': 'SyntaxError',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'exception.type',
            'value': 'TypeError',
        })
        self.assertDoesNotPass(rule, event)

    def test_exception_value(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'exception.value',
            'value': 'hello world',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'exception.value',
            'value': 'foo bar',
        })
        self.assertDoesNotPass(rule, event)

    def test_stacktrace_filename(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'stacktrace.filename',
            'value': 'example.php',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'stacktrace.filename',
            'value': 'foo.php',
        })
        self.assertDoesNotPass(rule, event)

    def test_stacktrace_module(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'stacktrace.module',
            'value': 'example',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'stacktrace.module',
            'value': 'foo',
        })
        self.assertDoesNotPass(rule, event)

    def test_stacktrace_code(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'stacktrace.code',
            'value': 'echo "hello";',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'stacktrace.code',
            'value': 'foo',
        })
        self.assertDoesNotPass(rule, event)

    def test_extra_simple_value(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'extra.bar',
            'value': 'foo',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'extra.bar',
            'value': 'bar',
        })
        self.assertDoesNotPass(rule, event)

    def test_extra_nested_value(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'extra.foo.bar',
            'value': 'baz',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'extra.foo.bar',
            'value': 'bar',
        })
        self.assertDoesNotPass(rule, event)

    def test_extra_nested_list(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'extra.biz',
            'value': 'baz',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'extra.biz',
            'value': 'bar',
        })
        self.assertDoesNotPass(rule, event)

    def test_event_type(self):
        event = self.get_event()
        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'type',
            'value': 'error',
        })
        self.assertPasses(rule, event)

        rule = self.get_rule({
            'match': MatchType.EQUAL,
            'attribute': 'type',
            'value': 'csp',
        })
        self.assertDoesNotPass(rule, event)
