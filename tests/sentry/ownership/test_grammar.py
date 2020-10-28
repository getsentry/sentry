from __future__ import absolute_import

import pytest

from sentry.ownership.grammar import Rule, Matcher, Owner, parse_rules, dump_schema, load_schema

fixture_data = """
# cool stuff comment
*.js                    #frontend m@ROBENOLT.com
# good comment


  url:http://google.com/* #backend
path:src/sentry/*       david@sentry.io

tags.foo:bar             tagperson@sentry.io
tags.foo:"bar baz"       tagperson@sentry.io
"""


def test_parse_rules():
    assert parse_rules(fixture_data) == [
        Rule(Matcher("path", "*.js"), [Owner("team", "frontend"), Owner("user", "m@robenolt.com")]),
        Rule(Matcher("url", "http://google.com/*"), [Owner("team", "backend")]),
        Rule(Matcher("path", "src/sentry/*"), [Owner("user", "david@sentry.io")]),
        Rule(Matcher("tags.foo", "bar"), [Owner("user", "tagperson@sentry.io")]),
        Rule(Matcher("tags.foo", "bar baz"), [Owner("user", "tagperson@sentry.io")]),
    ]


def test_dump_schema():
    assert dump_schema([Rule(Matcher("path", "*.js"), [Owner("team", "frontend")])]) == {
        "$version": 1,
        "rules": [
            {
                "matcher": {"type": "path", "pattern": "*.js"},
                "owners": [{"type": "team", "identifier": "frontend"}],
            }
        ],
    }


def test_load_schema():
    assert load_schema(
        {
            "$version": 1,
            "rules": [
                {
                    "matcher": {"type": "path", "pattern": "*.js"},
                    "owners": [{"type": "team", "identifier": "frontend"}],
                }
            ],
        }
    ) == [Rule(Matcher("path", "*.js"), [Owner("team", "frontend")])]


def test_matcher_test_url():
    data = {"request": {"url": "http://example.com/foo.js"}}

    assert Matcher("url", "*.js").test(data)
    assert Matcher("url", "http://*.com/foo.js").test(data)
    assert not Matcher("url", "*.py").test(data)
    assert not Matcher("url", "*.jsx").test(data)
    assert not Matcher("path", "*.js").test(data)
    assert not Matcher("url", "*.js").test({})


def test_matcher_test_none():
    data = {"request": {"url": None}}
    assert not Matcher("url", "").test(data)


def test_matcher_test_exception():
    data = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"filename": "foo/file.py"},
                            {"abs_path": "/usr/local/src/other/app.py"},
                        ]
                    }
                }
            ]
        }
    }

    assert Matcher("path", "*.py").test(data)
    assert Matcher("path", "foo/*.py").test(data)
    assert Matcher("path", "/usr/local/src/*/app.py").test(data)
    assert not Matcher("path", "*.js").test(data)
    assert not Matcher("path", "*.jsx").test(data)
    assert not Matcher("url", "*.py").test(data)
    assert not Matcher("path", "*.py").test({})


def test_matcher_test_stacktrace():
    data = {
        "stacktrace": {
            "frames": [{"filename": "foo/file.py"}, {"abs_path": "/usr/local/src/other/app.py"}]
        }
    }

    assert Matcher("path", "*.py").test(data)
    assert Matcher("path", "foo/*.py").test(data)
    assert Matcher("path", "/usr/local/src/*/app.py").test(data)
    assert not Matcher("path", "*.js").test(data)
    assert not Matcher("path", "*.jsx").test(data)
    assert not Matcher("url", "*.py").test(data)
    assert not Matcher("path", "*.py").test({})


def test_matcher_test_tags():
    data = {
        "tags": [["foo", "foo_value"], ["bar", "barval"]],
    }

    assert Matcher("tags.foo", "foo_value").test(data)
    assert Matcher("tags.bar", "barval").test(data)
    assert not Matcher("tags.barz", "barval").test(data)


@pytest.mark.parametrize("data", [{}, {"tags": None}, {"tags": [None]}])
def test_matcher_test_tags_without_tag_data(data):
    assert not Matcher("tags.foo", "foo_value").test(data)
    assert not Matcher("tags.bar", "barval").test(data)
