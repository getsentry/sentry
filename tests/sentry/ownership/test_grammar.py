from __future__ import absolute_import

from sentry.ownership.grammar import (
    Rule, Matcher, Owner,
    parse_rules, dump_schema, load_schema,
)

fixture_data = """
# cool stuff comment
*.js                    #frontend m@robenolt.com
# good comment


  url:http://google.com/* #backend
path:src/sentry/*       david@sentry.io
"""


def test_parse_rules():
    assert parse_rules(fixture_data) == [
        Rule(Matcher('path', '*.js'), [Owner('team', 'frontend'), Owner('user', 'm@robenolt.com')]),
        Rule(Matcher('url', 'http://google.com/*'), [Owner('team', 'backend')]),
        Rule(Matcher('path', 'src/sentry/*'), [Owner('user', 'david@sentry.io')]),
    ]


def test_dump_schema():
    assert dump_schema([Rule(
        Matcher('path', '*.js'),
        [Owner('team', 'frontend')]
    )]) == {
        '$version': 1,
        'rules': [{
            'matcher': {
                'type': 'path',
                'pattern': '*.js',
            },
            'owners': [{
                'type': 'team',
                'identifier': 'frontend',
            }]
        }]
    }


def test_load_schema():
    assert load_schema({
        '$version': 1,
        'rules': [{
            'matcher': {
                'type': 'path',
                'pattern': '*.js',
            },
            'owners': [{
                'type': 'team',
                'identifier': 'frontend',
            }]
        }]
    }) == [Rule(
        Matcher('path', '*.js'),
        [Owner('team', 'frontend')]
    )]
