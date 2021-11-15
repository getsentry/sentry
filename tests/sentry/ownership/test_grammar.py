import pytest

from sentry.ownership.grammar import (
    Matcher,
    Owner,
    Rule,
    convert_codeowners_syntax,
    convert_schema_to_rules_text,
    dump_schema,
    load_schema,
    parse_code_owners,
    parse_rules,
)

fixture_data = """
# cool stuff comment
*.js                    #frontend m@ROBENOLT.com
# good comment


  url:http://google.com/* #backend
path:src/sentry/*       david@sentry.io

tags.foo:bar             tagperson@sentry.io
tags.foo:"bar baz"       tagperson@sentry.io

module:foo.bar  #workflow
module:"foo bar"  meow@sentry.io

codeowners:/src/components/  githubuser@sentry.io
codeowners:frontend/*.ts     githubmod@sentry.io
"""

codeowners_fixture_data = """
# cool stuff comment
*.js                    @getsentry/frontend @NisanthanNanthakumar
# good comment


  docs/*  @getsentry/docs @getsentry/ecosystem
src/sentry/*       @AnotherUser
api/*    nisanthan.nanthakumar@sentry.io
"""


def test_parse_rules():
    assert parse_rules(fixture_data) == [
        Rule(Matcher("path", "*.js"), [Owner("team", "frontend"), Owner("user", "m@robenolt.com")]),
        Rule(Matcher("url", "http://google.com/*"), [Owner("team", "backend")]),
        Rule(Matcher("path", "src/sentry/*"), [Owner("user", "david@sentry.io")]),
        Rule(Matcher("tags.foo", "bar"), [Owner("user", "tagperson@sentry.io")]),
        Rule(Matcher("tags.foo", "bar baz"), [Owner("user", "tagperson@sentry.io")]),
        Rule(Matcher("module", "foo.bar"), [Owner("team", "workflow")]),
        Rule(Matcher("module", "foo bar"), [Owner("user", "meow@sentry.io")]),
        Rule(Matcher("codeowners", "/src/components/"), [Owner("user", "githubuser@sentry.io")]),
        Rule(Matcher("codeowners", "frontend/*.ts"), [Owner("user", "githubmod@sentry.io")]),
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
    assert (
        load_schema(
            {
                "$version": 1,
                "rules": [
                    {
                        "matcher": {"type": "path", "pattern": "*.js"},
                        "owners": [{"type": "team", "identifier": "frontend"}],
                    }
                ],
            }
        )
        == [Rule(Matcher("path", "*.js"), [Owner("team", "frontend")])]
    )


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


def test_matcher_file_abs_path_same_frame():
    data = {
        "exception": {
            "values": [
                {
                    "stacktrace": {
                        "frames": [
                            {"filename": "foo/file.py", "abs_path": "/usr/local/src/other/app.py"},
                        ]
                    }
                }
            ]
        }
    }

    assert Matcher("path", "/usr/local/src/*/app.py").test(data)
    assert Matcher("path", "*local/src/*").test(data)


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


def test_matcher_test_module():
    data = {
        "stacktrace": {
            "frames": [
                {
                    "module": "com.android.internal.os.Init",
                    "filename": "Init.java",
                    "abs_path": "Init.java",
                },
                {
                    "module": "com.android.internal.os.RuntimeInit$MethodAndArgsCaller",
                    "filename": "RuntimeInit.java",
                    "abs_path": "RuntimeInit.java",
                },
                {
                    "module": "com.sentry.somethinginthemiddle.CustomModuleForMeowing",
                    "filename": "SourceFile",
                    "abs_path": "SourceFile",
                },
            ]
        },
    }
    assert Matcher("module", "*os.Init").test(data)
    assert Matcher("module", "*somethinginthemiddle*").test(data)
    assert Matcher("module", "com.android.internal.os.RuntimeInit$MethodAndArgsCaller").test(data)
    assert Matcher("module", "com.android*").test(data)
    assert not Matcher("module", "com.android").test(data)
    assert not Matcher("module", "os.Init").test(data)
    assert not Matcher("module", "*somethingattheend").test(data)
    assert not Matcher("module", "com.android.internal.os").test(data)


@pytest.mark.parametrize("data", [{}, {"tags": None}, {"tags": [None]}])
def test_matcher_test_tags_without_tag_data(data):
    assert not Matcher("tags.foo", "foo_value").test(data)
    assert not Matcher("tags.bar", "barval").test(data)


def _assert_matcher(matcher: Matcher, path_details, expected):
    """Helper function to reduce repeated code"""
    frames = {"stacktrace": {"frames": path_details}}
    assert matcher.test(frames) == expected


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/src/foo/test.py"}], True),
        (
            [
                {"filename": "config/subdir/baz.txt"},
                {"abs_path": "/usr/local/src/config/subdir/baz.txt"},
            ],
            True,
        ),
        ([{"filename": "not_in_repo.py"}, {"abs_path": "/root/not_in_repo.py"}], True),
    ],
)
def test_codeowners_match_any_file(path_details, expected):
    """* and ** should match to any file"""
    _assert_matcher(Matcher("codeowners", "**"), path_details, expected)
    _assert_matcher(Matcher("codeowners", "*"), path_details, expected)


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/src/foo/test.py"}], True),
        (
            [
                {"filename": "config/subdir/baz.txt"},
                {"abs_path": "/usr/local/src/config/subdir/baz.txt"},
            ],
            False,
        ),
        (
            [
                {"filename": "config/subdir/baz.py"},
                {"abs_path": "/usr/local/src/config/subdir/baz.py"},
            ],
            True,
        ),
        (
            [
                {"filename": "config/dir.py/baz.js"},
                {"abs_path": "/usr/local/src/config/dir.py/baz.js"},
            ],
            True,
        ),
    ],
)
def test_codeowners_match_extension(path_details, expected):
    """*.py should match to any .py file or directory in the repo"""
    _assert_matcher(Matcher("codeowners", "*.py"), path_details, expected)


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/src/foo/test.py"}], True),
        (
            [
                {"filename": "config/subdir/baz.py"},
                {"abs_path": "/usr/local/src/config/subdir/baz.py"},
            ],
            False,
        ),
        (
            [
                {"config/subdir/filename": "test.py"},
                {"abs_path": "/usr/local/src/config/subdir/test.py"},
            ],
            True,
        ),
        (
            [
                {"filename": "config/test.py/not_test.json"},
                {"abs_path": "/usr/local/src/config/test.py/not_test.json"},
            ],
            True,
        ),
    ],
)
def test_codeowners_match_specific_filename(path_details, expected):
    """test.py should match to any test.py file or directory in the repo"""
    _assert_matcher(Matcher("codeowners", "test.py"), path_details, expected)


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/src/foo/test.py"}], True),
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/foo/test.py"}], False),
        (
            [
                {"filename": "foo/test.py/dir_allowed"},
                {"abs_path": "/usr/local/src/foo/test.py/dir_allowed"},
            ],
            True,
        ),
    ],
)
def test_codeowners_match_specific_path(path_details, expected):
    """
    When codeowners is converted to issue owners, the code path is prepended
    /usr/local/src/foo/test.py should match to any foo/test.py within the code path
    """
    _assert_matcher(Matcher("codeowners", "/usr/local/src/foo/test.py"), path_details, expected)


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/src/foo/test.py"}], True),
        (
            [
                {"filename": "foo/dir.py/py_dir.txt"},
                {"abs_path": "/usr/local/src/foo/dir.py/py_dir.txt"},
            ],
            True,
        ),
        ([{"filename": "foo/test.txt"}, {"abs_path": "/usr/local/src/foo/test.txt"}], False),
        (
            [{"filename": "config/foo/test.py"}, {"abs_path": "/usr/local/src/config/foo/test.py"}],
            False,
        ),
    ],
)
def test_codeowners_match_abs_wildcard(path_details, expected):
    """/usr/local/src/foo/*.py should match any file or directory"""
    _assert_matcher(Matcher("codeowners", "/usr/local/src/foo/*.py"), path_details, expected)


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/src/foo/test.py"}], True),
        (
            [{"filename": "foo/subdir/baz.py"}, {"abs_path": "/usr/local/src/foo/subdir/baz.py"}],
            True,
        ),
        ([{"filename": "foo"}, {"abs_path": "/usr/local/src/foo"}], False),
        (
            [
                {"filename": "config/subdir/test.py"},
                {"abs_path": "/usr/local/src/config/subdir/test.py"},
            ],
            False,
        ),
        (
            [
                {"filename": "config/src/test.py"},
                {"abs_path": "/usr/local/src/config/src/foo/test.py"},
            ],
            False,
        ),
        (
            [
                {"filename": "config/src/foo/subdir/test.py"},
                {"abs_path": "/usr/local/src/config/src/foo/subdir/test.py"},
            ],
            False,
        ),
    ],
)
def test_codeowners_match_recursive_directory(path_details, expected):
    """
    /usr/local/src/foo/ should match recursively to any file within the /src/foo directory"
    /usr/local/src/foo/** should do the same"
    """
    _assert_matcher(Matcher("codeowners", "/usr/local/src/foo/"), path_details, expected)
    _assert_matcher(Matcher("codeowners", "/usr/local/src/foo/**"), path_details, expected)


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/src/foo/test.py"}], True),
        (
            [{"filename": "foo/subdir/baz.py"}, {"abs_path": "/usr/local/src/foo/subdir/baz.py"}],
            False,
        ),
        (
            [
                {"filename": "config/subdir/test.py"},
                {"abs_path": "/usr/local/src/config/subdir/test.py"},
            ],
            False,
        ),
        (
            [
                {"filename": "config/src/foo/test.py"},
                {"abs_path": "/usr/local/src/config/src/foo/test.py"},
            ],
            False,
        ),
    ],
)
def test_codeowners_match_nonrecursive_directory(path_details, expected):
    """
    /src/foo/* should match to any file directly within the /src/foo directory
    src/foo/* should match to any file directly withing any src/foo directory
    """
    _assert_matcher(Matcher("codeowners", "/usr/local/src/foo/*"), path_details, expected)


@pytest.mark.parametrize(
    "path_details, single_star_expected, double_star_expected",
    [
        (
            [{"filename": "foo/bar/test.py"}, {"abs_path": "/usr/local/src/foo/bar/test.py"}],
            True,
            True,
        ),
        (
            [
                {"filename": "foo/bar/baz/test.py"},
                {"abs_path": "/usr/local/src/foo/bar/baz/test.py"},
            ],
            False,
            True,
        ),
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/src/foo/test.py"}], False, True),
        ([{"filename": "test.py"}, {"abs_path": "/usr/local/src/test.py"}], False, False),
    ],
)
def test_codeowners_match_wildcard_directory(
    path_details, single_star_expected, double_star_expected
):
    """
    /src/foo/*/test.py should only match with test.py 1 directory deeper than foo
    /src/foo/**/test.py can match with test.py anywhere under foo
    """
    _assert_matcher(Matcher("codeowners", "foo/*/test.py"), path_details, single_star_expected)
    _assert_matcher(
        Matcher("codeowners", "/usr/local/src/foo/*/test.py"), path_details, single_star_expected
    )
    _assert_matcher(Matcher("codeowners", "foo/**/test.py"), path_details, double_star_expected)
    _assert_matcher(
        Matcher("codeowners", "/usr/local/src/foo/**/test.py"), path_details, double_star_expected
    )


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/src/foo/test.py"}], True),
        ([{"filename": "foo/test.jy"}, {"abs_path": "/usr/local/src/foo/test.jy"}], True),
        ([{"filename": "foo/test.;y"}, {"abs_path": "/usr/local/src/foo/test.;y"}], True),
        ([{"filename": "foo/test.pt"}, {"abs_path": "/usr/local/src/foo/test.pt"}], False),
        ([{"filename": "foo/test./y"}, {"abs_path": "/usr/local/src/foo/test./y"}], False),
    ],
)
def test_codeowners_match_question_mark(path_details, expected):
    """
    "?" should match any character execept slash
    """
    _assert_matcher(Matcher("codeowners", "test.?y"), path_details, expected)


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/src/foo/test.py"}], True),
        ([{"filename": "bar/foo/test.py"}, {"abs_path": "/usr/local/src/bar/foo/test.jy"}], True),
        ([{"filename": "foo"}, {"abs_path": "/usr/local/src/foo"}], False),
    ],
)
def test_codeowners_match_loose_directory(path_details, expected):
    """
    unanchored directories can match to a foo directory anywhere in the tree
    """
    _assert_matcher(Matcher("codeowners", "foo/"), path_details, expected)


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/test.py"}, {"abs_path": "/usr/local/src/foo/test.py"}], True),
        ([{"filename": "foo/test.js"}, {"abs_path": "/usr/local/src/foo/test.js"}], True),
        ([{"filename": "foo/test."}, {"abs_path": "/usr/local/src/foo/test."}], True),
        ([{"filename": "foo/test.d/file"}, {"abs_path": "/usr/local/src/foo/test.d/file"}], True),
        ([{"filename": "foo/test./file"}, {"abs_path": "/usr/local/src/foo/test./file"}], True),
    ],
)
def test_codeowners_match_wildcard_extension(path_details, expected):
    """
    "*" can match 0 or more characters in files or directories
    """
    _assert_matcher(Matcher("codeowners", "test.*"), path_details, expected)


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/\\"}, {"abs_path": "/usr/local/src/foo/\\"}], True),
        (
            [
                {"filename": "foo/subdir/\\filename"},
                {"abs_path": "/usr/local/src/foo/subdir/\\filename"},
            ],
            False,
        ),
        (
            [
                {"filename": "foo/subdir/\\/backslash_dir"},
                {"abs_path": "/usr/local/src/foo/subdir/\\/backslash_dir"},
            ],
            True,
        ),
        (
            [
                {"filename": "config/subdir/test.py"},
                {"abs_path": "/usr/local/src/config/subdir/test.py"},
            ],
            False,
        ),
    ],
)
def test_codeowners_match_backslash(path_details, expected):
    """\\ should ignore anything after the backslash and only match with files named '\'"""
    _assert_matcher(Matcher("codeowners", "\\filename"), path_details, expected)


@pytest.mark.parametrize(
    "path_details, expected",
    [
        ([{"filename": "foo/"}, {"abs_path": "/usr/local/src/foo/"}], True),
        (
            [
                {"filename": "/foo/subdir/"},
                {"abs_path": "/usr/local/src/foo/subdir/"},
            ],
            True,
        ),
        (
            [
                {"filename": "config/subdir/test.py"},
                {"abs_path": "/usr/local/src/config/subdir/test.py"},
            ],
            True,
        ),
    ],
)
def test_codeowners_match_fowardslash(path_details, expected):
    _assert_matcher(Matcher("codeowners", "/"), path_details, expected)


def test_parse_code_owners():
    assert parse_code_owners(codeowners_fixture_data) == (
        ["@getsentry/frontend", "@getsentry/docs", "@getsentry/ecosystem"],
        ["@NisanthanNanthakumar", "@AnotherUser"],
        ["nisanthan.nanthakumar@sentry.io"],
    )


def test_convert_codeowners_syntax():
    code_mapping = type("", (), {})()
    code_mapping.stack_root = "webpack://docs"
    code_mapping.source_root = "docs"
    assert (
        convert_codeowners_syntax(
            codeowners_fixture_data,
            {
                "@getsentry/frontend": "front-sentry",
                "@getsentry/docs": "docs-sentry",
                "@getsentry/ecosystem": "ecosystem",
                "@NisanthanNanthakumar": "nisanthan.nanthakumar@sentry.io",
                "@AnotherUser": "anotheruser@sentry.io",
                "nisanthan.nanthakumar@sentry.io": "nisanthan.nanthakumar@sentry.io",
            },
            code_mapping,
        )
        == "\n# cool stuff comment\ncodeowners:*.js front-sentry nisanthan.nanthakumar@sentry.io\n# good comment\n\n\ncodeowners:webpack://docs/* docs-sentry ecosystem\ncodeowners:src/sentry/* anotheruser@sentry.io\ncodeowners:api/* nisanthan.nanthakumar@sentry.io\n"
    )


def test_convert_codeowners_syntax_excludes_invalid():
    code_mapping = type("", (), {})()
    code_mapping.stack_root = "webpack://static/"
    code_mapping.source_root = ""
    codeowners = (
        codeowners_fixture_data
        + r"""
# some invalid rules
debug[0-9].log                @NisanthanNanthakumar
!important/*.log                 @NisanthanNanthakumar
file 1.txt @NisanthanNanthakumar  @getsentry/ecosystem
\#somefile.txt  @NisanthanNanthakumar

# some anchored paths
/scripts/test.js              @getsentry/ops
config/hooks                  @getsentry/ops
config/relay/                 @getsentry/relay

# not anchored path
docs-ui/                  @getsentry/docs @getsentry/ecosystem
"""
    )

    assert (
        convert_codeowners_syntax(
            codeowners,
            {
                "@getsentry/frontend": "front-sentry",
                "@getsentry/docs": "docs-sentry",
                "@getsentry/ecosystem": "ecosystem",
                "@getsentry/ops": "ops",
                "@getsentry/relay": "relay",
                "@NisanthanNanthakumar": "nisanthan.nanthakumar@sentry.io",
                "@AnotherUser": "anotheruser@sentry.io",
                "nisanthan.nanthakumar@sentry.io": "nisanthan.nanthakumar@sentry.io",
            },
            code_mapping,
        )
        == """
# cool stuff comment
codeowners:*.js front-sentry nisanthan.nanthakumar@sentry.io
# good comment


codeowners:webpack://static/docs/* docs-sentry ecosystem
codeowners:webpack://static/src/sentry/* anotheruser@sentry.io
codeowners:webpack://static/api/* nisanthan.nanthakumar@sentry.io

# some invalid rules
codeowners:file nisanthan.nanthakumar@sentry.io ecosystem

# some anchored paths
codeowners:webpack://static/scripts/test.js ops
codeowners:webpack://static/config/hooks ops
codeowners:webpack://static/config/relay/ relay

# not anchored path
codeowners:docs-ui/ docs-sentry ecosystem
"""
    )


def test_convert_schema_to_rules_text():
    assert (
        convert_schema_to_rules_text(
            {
                "$version": 1,
                "rules": [
                    {
                        "matcher": {"type": "path", "pattern": "*.js"},
                        "owners": [
                            {"type": "team", "identifier": "frontend"},
                            {"type": "user", "identifier": "m@robenolt.com"},
                        ],
                    },
                    {
                        "matcher": {"type": "url", "pattern": "http://google.com/*"},
                        "owners": [{"type": "team", "identifier": "backend"}],
                    },
                    {
                        "matcher": {"type": "path", "pattern": "src/sentry/*"},
                        "owners": [{"type": "user", "identifier": "david@sentry.io"}],
                    },
                    {
                        "matcher": {"type": "tags.foo", "pattern": "bar"},
                        "owners": [{"type": "user", "identifier": "tagperson@sentry.io"}],
                    },
                    {
                        "matcher": {"type": "tags.foo", "pattern": "bar baz"},
                        "owners": [{"type": "user", "identifier": "tagperson@sentry.io"}],
                    },
                    {
                        "matcher": {"type": "module", "pattern": "foo.bar"},
                        "owners": [{"type": "team", "identifier": "workflow"}],
                    },
                    {
                        "matcher": {"type": "module", "pattern": "foo bar"},
                        "owners": [{"type": "user", "identifier": "meow@sentry.io"}],
                    },
                ],
            }
        )
        == "path:*.js #frontend m@robenolt.com\nurl:http://google.com/* #backend\npath:src/sentry/* david@sentry.io\ntags.foo:bar tagperson@sentry.io\ntags.foo:bar baz tagperson@sentry.io\nmodule:foo.bar #workflow\nmodule:foo bar meow@sentry.io\n"
    )
