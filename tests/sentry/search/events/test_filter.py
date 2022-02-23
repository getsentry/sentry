import datetime
import re
import unittest
from unittest.mock import patch

import pytest
from django.utils import timezone
from sentry_relay.consts import SPAN_STATUS_CODE_TO_NAME
from snuba_sdk.column import Column
from snuba_sdk.conditions import And, Condition, Op, Or
from snuba_sdk.function import Function

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.api.release_search import INVALID_SEMVER_MESSAGE
from sentry.models import ReleaseStages
from sentry.models.release import SemverFilter
from sentry.search.events.builder import UnresolvedQuery
from sentry.search.events.constants import (
    RELEASE_STAGE_ALIAS,
    SEMVER_ALIAS,
    SEMVER_BUILD_ALIAS,
    SEMVER_EMPTY_RELEASE,
    SEMVER_PACKAGE_ALIAS,
)
from sentry.search.events.fields import (
    DiscoverFunction,
    FunctionArg,
    InvalidSearchQuery,
    with_default,
)
from sentry.search.events.filter import (
    _semver_build_filter_converter,
    _semver_filter_converter,
    _semver_package_filter_converter,
    get_filter,
    parse_semver,
)
from sentry.search.events.types import ParamsType
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba import OPERATOR_TO_FUNCTION, Dataset


# Helper functions to make reading the expected output from the boolean tests easier to read. #
# a:b
def _eq(xy):
    return ["equals", [["ifNull", [xy[0], "''"]], xy[1]]]


# a:b but using operators instead of functions
def _oeq(xy):
    return [["ifNull", [xy[0], "''"]], "=", xy[1]]


# !a:b using operators instead of functions
def _noeq(xy):
    return [["ifNull", [xy[0], "''"]], "!=", xy[1]]


# message ("foo bar baz")
def _m(x):
    return ["notEquals", [["positionCaseInsensitive", ["message", f"'{x}'"]], 0]]


# message ("foo bar baz") using operators instead of functions
def _om(x):
    return [["positionCaseInsensitive", ["message", f"'{x}'"]], "!=", 0]


# x OR y
def _or(x, y):
    return ["or", [x, y]]


# x AND y
def _and(x, y):
    return ["and", [x, y]]


# count():>1
def _c(op, val):
    return [OPERATOR_TO_FUNCTION[op], ["count", val]]


# count():>1 using operators instead of functions
def _oc(op, val):
    return ["count", op, val]


class ParseBooleanSearchQueryTest(TestCase):
    def setUp(self):
        super().setUp()
        users = ["foo", "bar", "foobar", "hello", "hi"]
        for u in users:
            self.__setattr__(u, ["equals", ["user.email", f"{u}@example.com"]])
            self.__setattr__(f"o{u}", ["user.email", "=", f"{u}@example.com"])

    def test_simple(self):
        result = get_filter("user.email:foo@example.com OR user.email:bar@example.com")
        assert result.conditions == [[_or(self.foo, self.bar), "=", 1]]

        result = get_filter("user.email:foo@example.com AND user.email:bar@example.com")
        assert result.conditions == [self.ofoo, self.obar]

    def test_words_with_boolean_substrings(self):
        result = get_filter("ORder")
        assert result.conditions == [_om("ORder")]

        result = get_filter("ANDroid")
        assert result.conditions == [_om("ANDroid")]

    def test_single_term(self):
        result = get_filter("user.email:foo@example.com")
        assert result.conditions == [self.ofoo]

    def test_wildcard_array_field(self):
        _filter = get_filter("error.value:Deadlock* OR !stack.filename:*.py")
        assert _filter.conditions == [
            [
                _or(
                    ["like", ["error.value", "Deadlock%"]],
                    ["notLike", ["stack.filename", "%.py"]],
                ),
                "=",
                1,
            ]
        ]
        assert _filter.filter_keys == {}

    def test_order_of_operations(self):
        result = get_filter(
            "user.email:foo@example.com OR user.email:bar@example.com AND user.email:foobar@example.com"
        )
        assert result.conditions == [[_or(self.foo, _and(self.bar, self.foobar)), "=", 1]]

        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com"
        )
        assert result.conditions == [[_or(_and(self.foo, self.bar), self.foobar), "=", 1]]

    def test_multiple_statements(self):
        result = get_filter(
            "user.email:foo@example.com OR user.email:bar@example.com OR user.email:foobar@example.com"
        )
        assert result.conditions == [[_or(self.foo, _or(self.bar, self.foobar)), "=", 1]]

        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com AND user.email:foobar@example.com"
        )
        assert result.conditions == [self.ofoo, self.obar, self.ofoobar]

        # longer even number of terms
        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com"
        )
        assert result.conditions == [
            [_or(_and(self.foo, self.bar), _and(self.foobar, self.hello)), "=", 1]
        ]

        # longer odd number of terms
        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com"
        )
        assert result.conditions == [
            [
                _or(
                    _and(self.foo, self.bar),
                    _and(self.foobar, _and(self.hello, self.hi)),
                ),
                "=",
                1,
            ]
        ]

        # absurdly long
        result = get_filter(
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com OR user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com"
        )
        assert result.conditions == [
            [
                _or(
                    _and(self.foo, self.bar),
                    _or(
                        _and(self.foobar, _and(self.hello, self.hi)),
                        _or(
                            _and(self.foo, self.bar),
                            _and(self.foobar, _and(self.hello, self.hi)),
                        ),
                    ),
                ),
                "=",
                1,
            ]
        ]

    def test_grouping_boolean_filter(self):
        result = get_filter("(event.type:error) AND (stack.in_app:true)")
        assert result.conditions == [["event.type", "=", "error"], ["stack.in_app", "=", 1]]

    def test_grouping_simple(self):
        result = get_filter("(user.email:foo@example.com OR user.email:bar@example.com)")
        assert result.conditions == [[_or(self.foo, self.bar), "=", 1]]

        result = get_filter(
            "(user.email:foo@example.com OR user.email:bar@example.com) AND user.email:foobar@example.com"
        )
        assert result.conditions == [[_or(self.foo, self.bar), "=", 1], self.ofoobar]

        result = get_filter(
            "user.email:foo@example.com AND (user.email:bar@example.com OR user.email:foobar@example.com)"
        )
        assert result.conditions == [self.ofoo, [_or(self.bar, self.foobar), "=", 1]]

    def test_nested_grouping(self):
        result = get_filter(
            "(user.email:foo@example.com OR (user.email:bar@example.com OR user.email:foobar@example.com))"
        )
        assert result.conditions == [[_or(self.foo, _or(self.bar, self.foobar)), "=", 1]]

        result = get_filter(
            "(user.email:foo@example.com OR (user.email:bar@example.com OR (user.email:foobar@example.com AND user.email:hello@example.com OR user.email:hi@example.com)))"
        )
        assert result.conditions == [
            [
                _or(
                    self.foo,
                    _or(self.bar, _or(_and(self.foobar, self.hello), self.hi)),
                ),
                "=",
                1,
            ]
        ]

        result = get_filter("test (item1 OR item2)")
        assert result.conditions == [
            _om("test"),
            [
                _or(
                    _m("item1"),
                    _m("item2"),
                ),
                "=",
                1,
            ],
        ]

    def test_grouping_edge_cases(self):
        result = get_filter("()")
        assert result.conditions == [
            _om("()"),
        ]

        result = get_filter("(test)")
        assert result.conditions == [
            _om("test"),
        ]

    def test_grouping_within_free_text(self):
        result = get_filter("undefined is not an object (evaluating 'function.name')")
        assert result.conditions == [
            _om("undefined is not an object (evaluating 'function.name')"),
        ]
        result = get_filter("combined (free text) AND (grouped)")
        assert result.conditions == [
            _om("combined (free text)"),
            _om("grouped"),
        ]

    def test_malformed_groups(self):
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("(user.email:foo@example.com OR user.email:bar@example.com")
        assert (
            str(error.value)
            == "Parse error at '(user.' (column 1). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter(
                "((user.email:foo@example.com OR user.email:bar@example.com AND  user.email:bar@example.com)"
            )
        assert (
            str(error.value)
            == "Parse error at '((user' (column 1). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("user.email:foo@example.com OR user.email:bar@example.com)")
        assert (
            str(error.value)
            == "Parse error at '.com)' (column 57). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter(
                "(user.email:foo@example.com OR user.email:bar@example.com AND  user.email:bar@example.com))"
            )
        assert (
            str(error.value)
            == "Parse error at 'com))' (column 91). This is commonly caused by unmatched parentheses. Enclose any text in double quotes."
        )

    def test_combining_normal_terms_with_boolean(self):
        tests = [
            (
                "foo bar baz OR fizz buzz bizz",
                [[_or(_m("foo bar baz"), _m("fizz buzz bizz")), "=", 1]],
            ),
            (
                "a:b (c:d OR e:f) g:h i:j OR k:l",
                [
                    [
                        _or(
                            _and(
                                _eq("ab"),
                                _and(
                                    _or(_eq("cd"), _eq("ef")),
                                    _and(_eq("gh"), _eq("ij")),
                                ),
                            ),
                            _eq("kl"),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            (
                "a:b OR c:d e:f g:h (i:j OR k:l)",
                [
                    [
                        _or(
                            _eq("ab"),
                            _and(
                                _eq("cd"),
                                _and(_eq("ef"), _and(_eq("gh"), _or(_eq("ij"), _eq("kl")))),
                            ),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            ("(a:b OR c:d) e:f", [[_or(_eq("ab"), _eq("cd")), "=", 1], _oeq("ef")]),
            (
                "a:b OR c:d e:f g:h i:j OR k:l",
                [
                    [
                        _or(
                            _eq("ab"),
                            _or(
                                _and(
                                    _eq("cd"),
                                    _and(_eq("ef"), _and(_eq("gh"), _eq("ij"))),
                                ),
                                _eq("kl"),
                            ),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            (
                "(a:b OR c:d) e:f g:h OR i:j k:l",
                [
                    [
                        _or(
                            _and(
                                _or(_eq("ab"), _eq("cd")),
                                _and(_eq("ef"), _eq("gh")),
                            ),
                            _and(_eq("ij"), _eq("kl")),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            (
                "a:b c:d e:f OR g:h i:j",
                [
                    [
                        _or(
                            _and(_eq("ab"), _and(_eq("cd"), _eq("ef"))),
                            _and(_eq("gh"), _eq("ij")),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            (
                "a:b c:d (e:f OR g:h) i:j",
                [_oeq("ab"), _oeq("cd"), [_or(_eq("ef"), _eq("gh")), "=", 1], _oeq("ij")],
            ),
            (
                "!a:b c:d (e:f OR g:h) i:j",
                [_noeq("ab"), _oeq("cd"), [_or(_eq("ef"), _eq("gh")), "=", 1], _oeq("ij")],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert test[1] == result.conditions, test[0]

    def test_nesting_using_parentheses(self):
        tests = [
            (
                "(a:b OR (c:d AND (e:f OR (g:h AND e:f))))",
                [
                    [
                        _or(
                            _eq("ab"),
                            _and(_eq("cd"), _or(_eq("ef"), _and(_eq("gh"), _eq("ef")))),
                        ),
                        "=",
                        1,
                    ]
                ],
            ),
            (
                "(a:b OR c:d) AND (e:f g:h)",
                [[_or(_eq("ab"), _eq("cd")), "=", 1], _oeq("ef"), _oeq("gh")],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert test[1] == result.conditions, test[0]

    def test_aggregate_filter_in_conditions(self):
        tests = [
            ("count():>1 AND count():<=3", [_oc(">", 1), _oc("<=", 3)]),
            ("count():>1 OR count():<=3", [[_or(_c(">", 1), _c("<=", 3)), "=", 1]]),
            (
                "count():>1 OR count():>5 AND count():<=3",
                [[_or(_c(">", 1), _and(_c(">", 5), _c("<=", 3))), "=", 1]],
            ),
            (
                "count():>1 AND count():<=3 OR count():>5",
                [[_or(_and(_c(">", 1), _c("<=", 3)), _c(">", 5)), "=", 1]],
            ),
            (
                "(count():>1 OR count():>2) AND count():<=3",
                [[_or(_c(">", 1), _c(">", 2)), "=", 1], _oc("<=", 3)],
            ),
            (
                "(count():>1 AND count():>5) OR count():<=3",
                [[_or(_and(_c(">", 1), _c(">", 5)), _c("<=", 3)), "=", 1]],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert test[1] == result.having, test[0]

    def test_aggregate_filter_and_normal_filter_in_condition(self):
        tests = [
            ("count():>1 AND a:b", [_oeq("ab")], [_oc(">", 1)]),
            ("count():>1 AND a:b c:d", [_oeq("ab"), _oeq("cd")], [_oc(">", 1)]),
            ("(a:b OR c:d) count():>1", [[_or(_eq("ab"), _eq("cd")), "=", 1]], [_oc(">", 1)]),
            (
                "(count():<3 OR count():>10) a:b c:d",
                [_oeq("ab"), _oeq("cd")],
                [[_or(_c("<", 3), _c(">", 10)), "=", 1]],
            ),
        ]

        for test in tests:
            result = get_filter(test[0])
            assert test[1] == result.conditions, "cond: " + test[0]
            assert test[2] == result.having, "having: " + test[0]

    def test_aggregate_filter_and_normal_filter_in_condition_with_or(self):
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("count():>1 OR a:b")
        assert (
            str(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("(count():>1 AND a:b) OR a:b")
        assert (
            str(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("(count():>1 AND a:b) OR (a:b AND count():>2)")
        assert (
            str(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )
        with pytest.raises(InvalidSearchQuery) as error:
            get_filter("a:b OR (c:d AND (e:f AND count():>1))")
        assert (
            str(error.value)
            == "Having an OR between aggregate filters and normal filters is invalid."
        )

    def test_project_in_condition_filters(self):
        project1 = self.create_project()
        project2 = self.create_project()
        tests = [
            (
                f"project:{project1.slug} OR project:{project2.slug}",
                [
                    [
                        _or(
                            ["equals", ["project_id", project1.id]],
                            ["equals", ["project_id", project2.id]],
                        ),
                        "=",
                        1,
                    ]
                ],
                [project1.id, project2.id],
            ),
            (
                f"(project:{project1.slug} OR project:{project2.slug}) AND a:b",
                [
                    [
                        _or(
                            ["equals", ["project_id", project1.id]],
                            ["equals", ["project_id", project2.id]],
                        ),
                        "=",
                        1,
                    ],
                    _oeq("ab"),
                ],
                [project1.id, project2.id],
            ),
            (
                f"(project:{project1.slug} AND a:b) OR (project:{project1.slug} AND c:d)",
                [
                    [
                        _or(
                            _and(["equals", ["project_id", project1.id]], _eq("ab")),
                            _and(["equals", ["project_id", project1.id]], _eq("cd")),
                        ),
                        "=",
                        1,
                    ]
                ],
                [project1.id],
            ),
        ]

        for test in tests:
            result = get_filter(
                test[0],
                params={
                    "organization_id": self.organization.id,
                    "project_id": [project1.id, project2.id],
                },
            )
            assert test[1] == result.conditions, test[0]
            assert set(test[2]) == set(result.project_ids), test[0]

    def test_project_in_condition_filters_not_in_project_filter(self):
        project1 = self.create_project()
        project2 = self.create_project()
        project3 = self.create_project()
        with self.assertRaisesRegex(
            InvalidSearchQuery,
            re.escape(
                f"Invalid query. Project(s) {str(project3.slug)} do not exist or are not actively selected."
            ),
        ):
            get_filter(
                f"project:{project1.slug} OR project:{project3.slug}",
                params={
                    "organization_id": self.organization.id,
                    "project_id": [project1.id, project2.id],
                },
            )

    def test_issue_id_alias_in_condition_filters(self):
        def _eq(xy):
            return ["equals", [["ifNull", [xy[0], "''"]], xy[1]]]

        group1 = self.create_group(project=self.project)
        group2 = self.create_group(project=self.project)
        group3 = self.create_group(project=self.project)
        tests = [
            (
                f"issue.id:{group1.id} OR issue.id:{group2.id}",
                [],
                [group1.id, group2.id],
            ),
            (f"issue.id:{group1.id} AND issue.id:{group1.id}", [], [group1.id]),
            (
                f"(issue.id:{group1.id} AND issue.id:{group2.id}) OR issue.id:{group3.id}",
                [],
                [group1.id, group2.id, group3.id],
            ),
            (f"issue.id:{group1.id} AND a:b", [_oeq("ab")], [group1.id]),
            # TODO: Using OR with issue.id is broken. These return incorrect results.
            (f"issue.id:{group1.id} OR a:b", [_oeq("ab")], [group1.id]),
            (
                f"(issue.id:{group1.id} AND a:b) OR issue.id:{group2.id}",
                [_oeq("ab")],
                [group1.id, group2.id],
            ),
            (
                f"(issue.id:{group1.id} AND a:b) OR c:d",
                [[_or(_eq("ab"), _eq("cd")), "=", 1]],
                [group1.id],
            ),
        ]

        for test in tests:
            result = get_filter(
                test[0],
                params={"organization_id": self.organization.id, "project_id": [self.project.id]},
            )
            assert test[1] == result.conditions, test[0]
            assert test[2] == result.group_ids, test[0]

    def test_invalid_conditional_filters(self):
        with self.assertRaisesRegex(
            InvalidSearchQuery, "Condition is missing on the left side of 'OR' operator"
        ):
            get_filter("OR a:b")

        with self.assertRaisesRegex(
            InvalidSearchQuery, "Missing condition in between two condition operators: 'OR AND'"
        ):
            get_filter("a:b Or And c:d")

        with self.assertRaisesRegex(
            InvalidSearchQuery, "Condition is missing on the right side of 'AND' operator"
        ):
            get_filter("a:b AND c:d AND")

        with self.assertRaisesRegex(
            InvalidSearchQuery, "Condition is missing on the left side of 'OR' operator"
        ):
            get_filter("(OR a:b) AND c:d")

    def test_empty_parens_in_message_not_boolean_search(self):
        result = get_filter(
            "failure_rate():>0.003&& users:>10 event.type:transaction",
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            _om("failure_rate():>0.003&&"),
            [["ifNull", ["users", "''"]], "=", ">10"],
            ["event.type", "=", "transaction"],
        ]

    def test_parens_around_message(self):
        result = get_filter(
            "TypeError Anonymous function(app/javascript/utils/transform-object-keys)",
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            _om("TypeError Anonymous function(app/javascript/utils/transform-object-keys)"),
        ]

    def test_or_does_not_match_organization(self):
        result = get_filter(
            f"organization.slug:{self.organization.slug}",
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            [["ifNull", ["organization.slug", "''"]], "=", f"{self.organization.slug}"]
        ]

    def test_boolean_with_in_search(self):
        result = get_filter(
            'url:["a", "b"] AND release:test',
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            [["ifNull", ["url", "''"]], "IN", ["a", "b"]],
            ["release", "=", "test"],
        ]

        result = get_filter(
            'url:["a", "b"] OR release:test',
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            [
                [
                    "or",
                    [
                        [["ifNull", ["url", "''"]], "IN", ["a", "b"]],
                        ["equals", ["release", "test"]],
                    ],
                ],
                "=",
                1,
            ]
        ]

        result = get_filter(
            'url:["a", "b"] AND url:["c", "d"] OR url:["e", "f"]',
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [
            [
                [
                    "or",
                    [
                        [
                            "and",
                            [
                                [["ifNull", ["url", "''"]], "IN", ["a", "b"]],
                                [["ifNull", ["url", "''"]], "IN", ["c", "d"]],
                            ],
                        ],
                        [["ifNull", ["url", "''"]], "IN", ["e", "f"]],
                    ],
                ],
                "=",
                1,
            ]
        ]


class GetSnubaQueryArgsTest(TestCase):
    def test_simple(self):
        _filter = get_filter(
            "user.email:foo@example.com release:1.2.1 fruit:apple hello",
            {
                "project_id": [1, 2, 3],
                "organization_id": 1,
                "start": datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
                "end": datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
            },
        )

        assert _filter.conditions == [
            ["user.email", "=", "foo@example.com"],
            ["release", "=", "1.2.1"],
            [["ifNull", ["fruit", "''"]], "=", "apple"],
            [["positionCaseInsensitive", ["message", "'hello'"]], "!=", 0],
        ]
        assert _filter.start == datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        assert _filter.end == datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc)
        assert _filter.filter_keys == {"project_id": [1, 2, 3]}
        assert _filter.project_ids == [1, 2, 3]
        assert not _filter.group_ids
        assert not _filter.event_ids

    def test_negation(self):
        _filter = get_filter("!user.email:foo@example.com")
        assert _filter.conditions == [
            [[["isNull", ["user.email"]], "=", 1], ["user.email", "!=", "foo@example.com"]]
        ]
        assert _filter.filter_keys == {}

    def test_implicit_and_explicit_tags(self):
        assert get_filter("tags[fruit]:apple").conditions == [
            [["ifNull", ["tags[fruit]", "''"]], "=", "apple"]
        ]

        assert get_filter("fruit:apple").conditions == [[["ifNull", ["fruit", "''"]], "=", "apple"]]

        assert get_filter("tags[project_id]:123").conditions == [
            [["ifNull", ["tags[project_id]", "''"]], "=", "123"]
        ]

    def test_in_syntax(self):
        project_2 = self.create_project()
        group = self.create_group(project=self.project, short_id=self.project.next_short_id())
        group_2 = self.create_group(project=project_2, short_id=self.project.next_short_id())
        assert (
            get_filter(
                f"project.name:[{self.project.slug}, {project_2.slug}]",
                params={"project_id": [self.project.id, project_2.id]},
            ).conditions
            == [["project_id", "IN", [project_2.id, self.project.id]]]
        )
        assert (
            get_filter(
                f"issue:[{group.qualified_short_id}, {group_2.qualified_short_id}]",
                params={"organization_id": self.project.organization_id},
            ).conditions
            == [["issue.id", "IN", [group.id, group_2.id]]]
        )
        assert (
            get_filter(
                f"issue:[{group.qualified_short_id}, unknown]",
                params={"organization_id": self.project.organization_id},
            ).conditions
            == [[["coalesce", ["issue.id", 0]], "IN", [0, group.id]]]
        )
        assert get_filter("environment:[prod, dev]").conditions == [
            [["environment", "IN", {"prod", "dev"}]]
        ]
        assert get_filter("random_tag:[what, hi]").conditions == [
            [["ifNull", ["random_tag", "''"]], "IN", ["what", "hi"]]
        ]

    def test_no_search(self):
        _filter = get_filter(
            params={
                "project_id": [1, 2, 3],
                "start": datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc),
                "end": datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc),
            }
        )
        assert not _filter.conditions
        assert _filter.filter_keys == {"project_id": [1, 2, 3]}
        assert _filter.start == datetime.datetime(2015, 5, 18, 10, 15, 1, tzinfo=timezone.utc)
        assert _filter.end == datetime.datetime(2015, 5, 19, 10, 15, 1, tzinfo=timezone.utc)

    def test_wildcard(self):
        _filter = get_filter("release:3.1.* user.email:*@example.com")
        assert _filter.conditions == [
            [["match", ["release", "'(?i)^3\\.1\\..*$'"]], "=", 1],
            [["match", ["user.email", "'(?i)^.*@example\\.com$'"]], "=", 1],
        ]
        assert _filter.filter_keys == {}

    def test_wildcard_with_unicode(self):
        _filter = get_filter(
            "message:*\u716e\u6211\u66f4\u591a\u7684\u98df\u7269\uff0c\u6211\u9913\u4e86."
        )
        assert _filter.conditions == [
            [
                [
                    "match",
                    [
                        "message",
                        "'(?i).*\u716e\u6211\u66f4\u591a\u7684\u98df\u7269\uff0c\u6211\u9913\u4e86\\.'",
                    ],
                ],
                "=",
                1,
            ]
        ]
        assert _filter.filter_keys == {}

    def test_wildcard_event_id(self):
        with self.assertRaises(InvalidSearchQuery):
            get_filter("id:deadbeef*")

    def test_event_id_validation(self):
        event_id = "a" * 32
        results = get_filter(f"id:{event_id}")
        assert results.conditions == [["id", "=", event_id]]

        event_id = "a" * 16 + "-" * 16 + "b" * 16
        results = get_filter(f"id:{event_id}")
        assert results.conditions == [["id", "=", event_id]]

        with self.assertRaises(InvalidSearchQuery):
            get_filter("id:deadbeef")

        with self.assertRaises(InvalidSearchQuery):
            get_filter(f"id:{'g' * 32}")

    def test_trace_id_validation(self):
        trace_id = "a" * 32
        results = get_filter(f"trace:{trace_id}")
        assert results.conditions == [["trace", "=", trace_id]]

        trace_id = "a" * 16 + "-" * 16 + "b" * 16
        results = get_filter(f"trace:{trace_id}")
        assert results.conditions == [["trace", "=", trace_id]]

        with self.assertRaises(InvalidSearchQuery):
            get_filter("trace:deadbeef")

        with self.assertRaises(InvalidSearchQuery):
            get_filter(f"trace:{'g' * 32}")

    def test_negated_wildcard(self):
        _filter = get_filter("!release:3.1.* user.email:*@example.com")
        assert _filter.conditions == [
            [
                [["isNull", ["release"]], "=", 1],
                [["match", ["release", "'(?i)^3\\.1\\..*$'"]], "!=", 1],
            ],
            [["match", ["user.email", "'(?i)^.*@example\\.com$'"]], "=", 1],
        ]
        assert _filter.filter_keys == {}

    def test_escaped_wildcard(self):
        assert get_filter("release:3.1.\\* user.email:\\*@example.com").conditions == [
            ["release", "=", "3.1.*"],
            ["user.email", "=", "*@example.com"],
        ]
        assert get_filter("release:\\\\\\*").conditions == [["release", "=", "\\\\*"]]
        assert get_filter("release:\\\\*").conditions == [
            [["match", ["release", "'(?i)^\\\\.*$'"]], "=", 1]
        ]
        assert get_filter("message:.*?").conditions == [
            [["match", ["message", r"'(?i)\..*\?'"]], "=", 1]
        ]

    def test_wildcard_array_field(self):
        _filter = get_filter(
            "error.value:Deadlock* stack.filename:*.py stack.abs_path:%APP_DIR%/th_ing*"
        )
        assert _filter.conditions == [
            ["error.value", "LIKE", "Deadlock%"],
            ["stack.filename", "LIKE", "%.py"],
            ["stack.abs_path", "LIKE", "\\%APP\\_DIR\\%/th\\_ing%"],
        ]
        assert _filter.filter_keys == {}

    def test_wildcard_array_field_with_backslash(self):
        test_cases = [
            (r"stack.filename:\k*", ["stack.filename", "LIKE", "\\\\k%"]),  # prefixed by \k
            (r"stack.filename:\\*", ["stack.filename", "LIKE", "\\\\\\\\%"]),  # prefixed by \\
            (
                r"stack.filename:\**",
                ["stack.filename", "LIKE", "\\\\%%"],
            ),  # prefixed by \% since the search filter replaces both * with %
            (r"stack.filename:\"k*", ["stack.filename", "LIKE", '"k%']),  # prefixed by "k
            (r'stack.filename:\\"k*', ["stack.filename", "LIKE", '\\\\"k%']),  # prefixed by \"k
        ]

        for filter, conditions in test_cases:
            _filter = get_filter(filter)
            assert _filter.conditions == [
                conditions,
            ]
            assert _filter.filter_keys == {}

    def test_existence_array_field(self):
        _filter = get_filter('has:stack.filename !has:stack.lineno error.value:""')
        assert _filter.conditions == [
            [["notEmpty", ["stack.filename"]], "=", 1],
            [["notEmpty", ["stack.lineno"]], "=", 0],
            [["notEmpty", ["error.value"]], "=", 0],
        ]

    def test_wildcard_with_trailing_backslash(self):
        results = get_filter("title:*misgegaan\\")
        assert results.conditions == [[["match", ["title", "'(?i)^.*misgegaan\\\\$'"]], "=", 1]]

    def test_has(self):
        assert get_filter("has:release").conditions == [[["isNull", ["release"]], "!=", 1]]

    def test_not_has(self):
        assert get_filter("!has:release").conditions == [[["isNull", ["release"]], "=", 1]]

    def test_has_issue(self):
        has_issue_filter = get_filter("has:issue")
        assert has_issue_filter.group_ids == []
        assert has_issue_filter.conditions == [[["coalesce", ["issue.id", 0]], "!=", 0]]

    def test_not_has_issue(self):
        has_issue_filter = get_filter("!has:issue")
        assert has_issue_filter.group_ids == []
        assert has_issue_filter.conditions == [[["coalesce", ["issue.id", 0]], "=", 0]]

    def test_has_issue_id(self):
        has_issue_filter = get_filter("has:issue.id")
        assert has_issue_filter.group_ids == []
        assert has_issue_filter.conditions == [[["coalesce", ["issue.id", 0]], "!=", 0]]

    def test_not_has_issue_id(self):
        has_issue_filter = get_filter("!has:issue.id")
        assert has_issue_filter.group_ids == []
        assert has_issue_filter.conditions == [[["coalesce", ["issue.id", 0]], "=", 0]]

    def test_message_empty(self):
        assert get_filter("has:message").conditions == [[["equals", ["message", ""]], "!=", 1]]
        assert get_filter("!has:message").conditions == [[["equals", ["message", ""]], "=", 1]]
        assert get_filter('message:""').conditions == [[["equals", ["message", ""]], "=", 1]]
        assert get_filter('!message:""').conditions == [[["equals", ["message", ""]], "!=", 1]]

    def test_message_negative(self):
        assert get_filter('!message:"post_process.process_error HTTPError 403"').conditions == [
            [
                [
                    "positionCaseInsensitive",
                    ["message", "'post_process.process_error HTTPError 403'"],
                ],
                "=",
                0,
            ]
        ]

    def test_message_with_newlines(self):
        assert get_filter('message:"nice \n a newline\n"').conditions == [
            [["positionCaseInsensitive", ["message", "'nice \n a newline\n'"]], "!=", 0]
        ]

    def test_malformed_groups(self):
        with pytest.raises(InvalidSearchQuery):
            get_filter("(user.email:foo@example.com OR user.email:bar@example.com")

    def test_issue_id_filter(self):
        _filter = get_filter("issue.id:1")
        assert not _filter.conditions
        assert _filter.filter_keys == {"group_id": [1]}
        assert _filter.group_ids == [1]

        _filter = get_filter("issue.id:1 issue.id:2 issue.id:3")
        assert not _filter.conditions
        assert _filter.filter_keys == {"group_id": [1, 2, 3]}
        assert _filter.group_ids == [1, 2, 3]

        _filter = get_filter("issue.id:1 user.email:foo@example.com")
        assert _filter.conditions == [["user.email", "=", "foo@example.com"]]
        assert _filter.filter_keys == {"group_id": [1]}
        assert _filter.group_ids == [1]

    def test_issue_filter_invalid(self):
        with pytest.raises(InvalidSearchQuery) as err:
            get_filter("issue:1", {"organization_id": 1})
        assert "Invalid value '" in str(err)
        assert "' for 'issue:' filter" in str(err)

    def test_issue_filter(self):
        group = self.create_group(project=self.project)
        _filter = get_filter(
            f"issue:{group.qualified_short_id}", {"organization_id": self.organization.id}
        )
        assert _filter.conditions == [["issue.id", "=", group.id]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_negated_issue_filter(self):
        group = self.create_group(project=self.project)
        _filter = get_filter(
            f"!issue:{group.qualified_short_id}", {"organization_id": self.organization.id}
        )
        assert _filter.conditions == [["issue.id", "!=", group.id]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_unknown_issue_filter(self):
        _filter = get_filter("issue:unknown", {"organization_id": self.organization.id})
        assert _filter.conditions == [[["coalesce", ["issue.id", 0]], "=", 0]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

        _filter = get_filter("!issue:unknown", {"organization_id": self.organization.id})
        assert _filter.conditions == [[["coalesce", ["issue.id", 0]], "!=", 0]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_user_display_filter(self):
        _filter = get_filter(
            "user.display:bill@example.com", {"organization_id": self.organization.id}
        )
        assert _filter.conditions == [
            [
                ["coalesce", ["user.email", "user.username", "user.id", "user.ip"]],
                "=",
                "bill@example.com",
            ]
        ]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_user_display_wildcard(self):
        _filter = get_filter("user.display:jill*", {"organization_id": self.organization.id})
        assert _filter.conditions == [
            [
                [
                    "match",
                    [
                        ["coalesce", ["user.email", "user.username", "user.id", "user.ip"]],
                        "'(?i)^jill.*$'",
                    ],
                ],
                "=",
                1,
            ]
        ]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_has_user_display(self):
        _filter = get_filter("has:user.display", {"organization_id": self.organization.id})
        assert _filter.conditions == [
            [
                ["isNull", [["coalesce", ["user.email", "user.username", "user.id", "user.ip"]]]],
                "!=",
                1,
            ]
        ]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_not_has_user_display(self):
        _filter = get_filter("!has:user.display", {"organization_id": self.organization.id})
        assert _filter.conditions == [
            [
                ["isNull", [["coalesce", ["user.email", "user.username", "user.id", "user.ip"]]]],
                "=",
                1,
            ]
        ]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_environment_param(self):
        params = {"environment": ["", "prod"]}
        _filter = get_filter("", params)
        # Should generate OR conditions
        assert _filter.conditions == [
            [["environment", "IS NULL", None], ["environment", "=", "prod"]]
        ]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

        params = {"environment": ["dev", "prod"]}
        _filter = get_filter("", params)
        assert _filter.conditions == [[["environment", "IN", {"dev", "prod"}]]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_environment_condition_string(self):
        _filter = get_filter("environment:dev")
        assert _filter.conditions == [[["environment", "=", "dev"]]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

        _filter = get_filter("!environment:dev")
        assert _filter.conditions == [[["environment", "!=", "dev"]]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

        _filter = get_filter("environment:dev environment:prod")
        # Will generate conditions that will never find anything
        assert _filter.conditions == [[["environment", "=", "dev"]], [["environment", "=", "prod"]]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

        _filter = get_filter('environment:""')
        # The '' environment is Null in snuba
        assert _filter.conditions == [[["environment", "IS NULL", None]]]
        assert _filter.filter_keys == {}
        assert _filter.group_ids == []

    def test_project_name(self):
        p1 = self.create_project(organization=self.organization)
        p2 = self.create_project(organization=self.organization)

        params = {"project_id": [p1.id, p2.id]}
        _filter = get_filter(f"project.name:{p1.slug}", params)
        assert _filter.conditions == [["project_id", "=", p1.id]]
        assert _filter.filter_keys == {"project_id": [p1.id]}
        assert _filter.project_ids == [p1.id]

        params = {"project_id": [p1.id, p2.id]}
        _filter = get_filter(f"!project.name:{p1.slug}", params)
        assert _filter.conditions == [
            [[["isNull", ["project_id"]], "=", 1], ["project_id", "!=", p1.id]]
        ]
        assert _filter.filter_keys == {"project_id": [p1.id, p2.id]}
        assert _filter.project_ids == [p1.id, p2.id]

        with pytest.raises(InvalidSearchQuery) as exc_info:
            params = {"project_id": []}
            get_filter(f"project.name:{p1.slug}", params)

        exc = exc_info.value
        exc_str = f"{exc}"
        assert (
            f"Invalid query. Project(s) {p1.slug} do not exist or are not actively selected."
            in exc_str
        )

    def test_not_has_project(self):
        with pytest.raises(InvalidSearchQuery) as err:
            get_filter("!has:project")
        assert "Invalid query for 'has' search: 'project' cannot be empty." in str(err)

        with pytest.raises(InvalidSearchQuery) as err:
            get_filter("!has:project.name")
        assert "Invalid query for 'has' search: 'project' cannot be empty." in str(err)

    def test_transaction_status(self):
        for (key, val) in SPAN_STATUS_CODE_TO_NAME.items():
            result = get_filter(f"transaction.status:{val}")
            assert result.conditions == [["transaction.status", "=", key]]

    def test_transaction_status_no_wildcard(self):
        with pytest.raises(InvalidSearchQuery) as exc_info:
            get_filter("transaction.status:o*")
        exc = exc_info.value
        exc_str = f"{exc}"
        assert "Invalid value" in exc_str
        assert "cancelled," in exc_str

    def test_transaction_status_invalid(self):
        with pytest.raises(InvalidSearchQuery) as exc_info:
            get_filter("transaction.status:lol")
        exc = exc_info.value
        exc_str = f"{exc}"
        assert "Invalid value" in exc_str
        assert "cancelled," in exc_str

    def test_error_handled(self):
        result = get_filter("error.handled:true")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("error.handled:false")
        assert result.conditions == [[["notHandled", []], "=", 1]]

        result = get_filter("has:error.handled")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("!has:error.handled")
        assert result.conditions == [[["isHandled", []], "=", 0]]

        result = get_filter("!error.handled:true")
        assert result.conditions == [[["notHandled", []], "=", 1]]

        result = get_filter("!error.handled:false")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("!error.handled:0")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        with pytest.raises(InvalidSearchQuery):
            get_filter("error.handled:99")

        with pytest.raises(InvalidSearchQuery):
            get_filter("error.handled:nope")

    def test_error_unhandled(self):
        result = get_filter("error.unhandled:true")
        assert result.conditions == [[["notHandled", []], "=", 1]]

        result = get_filter("error.unhandled:false")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("has:error.unhandled")
        assert result.conditions == [[["isHandled", []], "=", 0]]

        result = get_filter("!has:error.unhandled")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("!error.unhandled:true")
        assert result.conditions == [[["isHandled", []], "=", 1]]

        result = get_filter("!error.unhandled:false")
        assert result.conditions == [[["notHandled", []], "=", 1]]

        result = get_filter("!error.unhandled:0")
        assert result.conditions == [[["notHandled", []], "=", 1]]

        with pytest.raises(InvalidSearchQuery):
            get_filter("error.unhandled:99")

        with pytest.raises(InvalidSearchQuery):
            get_filter("error.unhandled:nope")

    def test_function_negation(self):
        result = get_filter("!p95():5s")
        assert result.having == [["p95", "!=", 5000.0]]

        result = get_filter("!p95():>5s")
        assert result.having == [["p95", "<=", 5000.0]]

        result = get_filter("!p95():>=5s")
        assert result.having == [["p95", "<", 5000.0]]

        result = get_filter("!p95():<5s")
        assert result.having == [["p95", ">=", 5000.0]]

        result = get_filter("!p95():<=5s")
        assert result.having == [["p95", ">", 5000.0]]

    def test_function_with_default_arguments(self):
        result = get_filter("epm():>100", {"start": before_now(minutes=5), "end": before_now()})
        assert result.having == [["epm", ">", 100]]

    def test_function_with_alias(self):
        result = get_filter("percentile(transaction.duration, 0.95):>100")
        assert result.having == [["percentile_transaction_duration_0_95", ">", 100]]

    def test_function_arguments(self):
        result = get_filter("percentile(transaction.duration, 0.75):>100")
        assert result.having == [["percentile_transaction_duration_0_75", ">", 100]]

    def test_function_arguments_with_spaces(self):
        result = get_filter("percentile(     transaction.duration,     0.75   ):>100")
        assert result.having == [["percentile_transaction_duration_0_75", ">", 100]]

        result = get_filter("percentile    (transaction.duration, 0.75):>100")
        assert result.conditions == [
            _om("percentile    (transaction.duration, 0.75):>100"),
        ]
        assert result.having == []

        result = get_filter(
            "epm(       ):>100", {"start": before_now(minutes=5), "end": before_now()}
        )
        assert result.having == [["epm", ">", 100]]

    def test_function_with_float_arguments(self):
        result = get_filter("apdex(300):>0.5")
        assert result.having == [["apdex_300", ">", 0.5]]

    def test_function_with_negative_arguments(self):
        result = get_filter("apdex(300):>-0.5")
        assert result.having == [["apdex_300", ">", -0.5]]

    def test_function_with_bad_arguments(self):
        result = get_filter("percentile(transaction.duration 0.75):>100")
        assert result.having == []
        assert result.conditions == [_om("percentile(transaction.duration 0.75):>100")]

    def test_function_with_date_arguments(self):
        result = get_filter("last_seen():2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", "=", 1585769692]]

    def test_function_with_date_negation(self):
        result = get_filter("!last_seen():2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", "!=", 1585769692]]

        result = get_filter("!last_seen():>2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", "<=", 1585769692]]

        result = get_filter("!last_seen():>=2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", "<", 1585769692]]

        result = get_filter("!last_seen():<2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", ">=", 1585769692]]

        result = get_filter("!last_seen():<=2020-04-01T19:34:52+00:00")
        assert result.having == [["last_seen", ">", 1585769692]]

    def test_release_latest(self):
        result = get_filter(
            "release:latest",
            params={"organization_id": self.organization.id, "project_id": [self.project.id]},
        )
        assert result.conditions == [["release", "IN", [""]]]

        # When organization id isn't included, project_id should unfortunately be an object
        result = get_filter("release:latest", params={"project_id": [self.project]})
        assert result.conditions == [["release", "IN", [""]]]

        release_2 = self.create_release(self.project)

        result = get_filter("release:[latest]", params={"project_id": [self.project]})
        assert result.conditions == [["release", "IN", [release_2.version]]]
        result = get_filter("release:[latest,1]", params={"project_id": [self.project]})
        assert result.conditions == [["release", "IN", [release_2.version, "1"]]]

    @pytest.mark.xfail(reason="this breaks issue search so needs to be redone")
    def test_trace_id(self):
        result = get_filter("trace:a0fa8803753e40fd8124b21eeb2986b5")
        assert result.conditions == [["trace", "=", "a0fa8803-753e-40fd-8124-b21eeb2986b5"]]

    def test_group_id_query(self):
        # If a user queries on group_id, make sure it gets turned into a tag not the actual group_id field
        assert get_filter("group_id:not-a-group-id-but-a-string").conditions == [
            [["ifNull", ["tags[group_id]", "''"]], "=", "not-a-group-id-but-a-string"]
        ]

        assert get_filter("group_id:wildcard-string*").conditions == [
            [
                ["match", [["ifNull", ["tags[group_id]", "''"]], "'(?i)^wildcard\\-string.*$'"]],
                "=",
                1,
            ]
        ]

    def test_shorthand_overflow(self):
        with self.assertRaises(InvalidSearchQuery):
            get_filter(f"transaction.duration:<{'9'*13}m")

        with self.assertRaises(InvalidSearchQuery):
            get_filter(f"transaction.duration:<{'9'*11}h")

        with self.assertRaises(InvalidSearchQuery):
            get_filter(f"transaction.duration:<{'9'*10}d")

    def test_semver(self):
        release = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test@1.2.4")
        _filter = get_filter(f"{SEMVER_ALIAS}:>=1.2.3", {"organization_id": self.organization.id})
        assert _filter.conditions == [["release", "IN", [release.version, release_2.version]]]
        assert _filter.filter_keys == {}

        _filter = get_filter(f"{SEMVER_ALIAS}:>1.2.4-hi", {"organization_id": self.organization.id})
        assert _filter.conditions == [["release", "IN", [release_2.version]]]
        assert _filter.filter_keys == {}

    def test_release_stage(self):
        replaced_release = self.create_release(
            version="replaced_release",
            environments=[self.environment],
            adopted=timezone.now(),
            unadopted=timezone.now(),
        )
        self.create_release(
            version="adopted_release",
            environments=[self.environment],
            adopted=timezone.now(),
        )
        not_adopted_release = self.create_release(
            version="not_adopted_release", environments=[self.environment]
        )
        _filter = get_filter(
            f"{RELEASE_STAGE_ALIAS}:adopted",
            {"organization_id": self.organization.id, "environment": [self.environment.name]},
        )

        assert _filter.conditions == [
            ["release", "IN", ["adopted_release"]],
            [["environment", "=", "development"]],
        ]
        assert _filter.filter_keys == {}

        _filter = get_filter(
            f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.REPLACED}, {ReleaseStages.LOW_ADOPTION}]",
            {"organization_id": self.organization.id, "environment": [self.environment.name]},
        )
        assert _filter.conditions == [
            ["release", "IN", [replaced_release.version, not_adopted_release.version]],
            [["environment", "=", "development"]],
        ]
        assert _filter.filter_keys == {}

        _filter = get_filter(
            f"!{RELEASE_STAGE_ALIAS}:[{ReleaseStages.ADOPTED}, {ReleaseStages.LOW_ADOPTION}]",
            {"organization_id": self.organization.id, "environment": [self.environment.name]},
        )
        assert _filter.conditions == [
            ["release", "IN", [replaced_release.version]],
            [["environment", "=", "development"]],
        ]
        assert _filter.filter_keys == {}

        with self.assertRaises(InvalidSearchQuery):
            _filter = get_filter(
                f"!{RELEASE_STAGE_ALIAS}:invalid", {"organization_id": self.organization.id}
            )

        with self.assertRaises(InvalidSearchQuery):
            _filter = get_filter(
                f"{RELEASE_STAGE_ALIAS}:[{ReleaseStages.REPLACED}, {ReleaseStages.LOW_ADOPTION}]",
                {"organization_id": self.organization.id},
            )


def with_type(type, argument):
    argument.get_type = lambda *_: type
    return argument


class DiscoverFunctionTest(unittest.TestCase):
    def setUp(self):
        self.fn_wo_optionals = DiscoverFunction(
            "wo_optionals",
            required_args=[FunctionArg("arg1"), FunctionArg("arg2")],
            transform="",
        )
        self.fn_w_optionals = DiscoverFunction(
            "w_optionals",
            required_args=[FunctionArg("arg1")],
            optional_args=[with_default("default", FunctionArg("arg2"))],
            transform="",
        )

    def test_no_optional_valid(self):
        self.fn_wo_optionals.validate_argument_count("fn_wo_optionals()", ["arg1", "arg2"])

    def test_no_optional_not_enough_arguments(self):
        with self.assertRaisesRegex(
            InvalidSearchQuery, r"fn_wo_optionals\(\): expected 2 argument\(s\)"
        ):
            self.fn_wo_optionals.validate_argument_count("fn_wo_optionals()", ["arg1"])

    def test_no_optional_too_may_arguments(self):
        with self.assertRaisesRegex(
            InvalidSearchQuery, r"fn_wo_optionals\(\): expected 2 argument\(s\)"
        ):
            self.fn_wo_optionals.validate_argument_count(
                "fn_wo_optionals()", ["arg1", "arg2", "arg3"]
            )

    def test_optional_valid(self):
        self.fn_w_optionals.validate_argument_count("fn_w_optionals()", ["arg1", "arg2"])
        # because the last argument is optional, we don't need to provide it
        self.fn_w_optionals.validate_argument_count("fn_w_optionals()", ["arg1"])

    def test_optional_not_enough_arguments(self):
        with self.assertRaisesRegex(
            InvalidSearchQuery, r"fn_w_optionals\(\): expected at least 1 argument\(s\)"
        ):
            self.fn_w_optionals.validate_argument_count("fn_w_optionals()", [])

    def test_optional_too_many_arguments(self):
        with self.assertRaisesRegex(
            InvalidSearchQuery, r"fn_w_optionals\(\): expected at most 2 argument\(s\)"
        ):
            self.fn_w_optionals.validate_argument_count(
                "fn_w_optionals()", ["arg1", "arg2", "arg3"]
            )

    def test_optional_args_have_default(self):
        with self.assertRaisesRegex(
            AssertionError, "test: optional argument at index 0 does not have default"
        ):
            DiscoverFunction("test", optional_args=[FunctionArg("arg1")])

    def test_defining_duplicate_args(self):
        with self.assertRaisesRegex(AssertionError, "test: argument arg1 specified more than once"):
            DiscoverFunction(
                "test",
                required_args=[FunctionArg("arg1")],
                optional_args=[with_default("default", FunctionArg("arg1"))],
                transform="",
            )

        with self.assertRaisesRegex(AssertionError, "test: argument arg1 specified more than once"):
            DiscoverFunction(
                "test",
                required_args=[FunctionArg("arg1")],
                calculated_args=[{"name": "arg1", "fn": lambda x: x}],
                transform="",
            )

        with self.assertRaisesRegex(AssertionError, "test: argument arg1 specified more than once"):
            DiscoverFunction(
                "test",
                optional_args=[with_default("default", FunctionArg("arg1"))],
                calculated_args=[{"name": "arg1", "fn": lambda x: x}],
                transform="",
            )

    def test_default_result_type(self):
        fn = DiscoverFunction("fn", transform="")
        assert fn.get_result_type() is None

        fn = DiscoverFunction("fn", transform="", default_result_type="number")
        assert fn.get_result_type() == "number"

    def test_result_type_fn(self):
        fn = DiscoverFunction("fn", transform="", result_type_fn=lambda *_: None)
        assert fn.get_result_type("fn()", []) is None

        fn = DiscoverFunction("fn", transform="", result_type_fn=lambda *_: "number")
        assert fn.get_result_type("fn()", []) == "number"

        fn = DiscoverFunction(
            "fn",
            required_args=[with_type("number", FunctionArg("arg1"))],
            transform="",
            result_type_fn=lambda args, columns: args[0].get_type(columns[0]),
        )
        assert fn.get_result_type("fn()", ["arg1"]) == "number"

    def test_private_function(self):
        fn = DiscoverFunction("fn", transform="", result_type_fn=lambda *_: None, private=True)
        assert fn.is_accessible() is False
        assert fn.is_accessible(None) is False
        assert fn.is_accessible([]) is False
        assert fn.is_accessible(["other_fn"]) is False
        assert fn.is_accessible(["fn"]) is True


class BaseSemverConverterTest:
    key = None

    def converter(self, *args, **kwargs):
        raise NotImplementedError

    def run_test(
        self,
        operator,
        version,
        expected_operator,
        expected_releases,
        organization_id=None,
        project_id=None,
    ):
        organization_id = organization_id if organization_id else self.organization.id
        filter = SearchFilter(SearchKey(self.key), operator, SearchValue(version))
        params = {}
        if organization_id:
            params["organization_id"] = organization_id
        if project_id:
            params["project_id"] = project_id
        converted = self.converter(filter, self.key, params)
        assert converted[0] == "release"
        assert converted[1] == expected_operator
        assert set(converted[2]) == set(expected_releases)


class SemverFilterConverterTest(BaseSemverConverterTest, TestCase):
    key = SEMVER_ALIAS

    def converter(self, *args, **kwargs):
        return _semver_filter_converter(*args, **kwargs)

    def test_invalid_params(self):
        key = SEMVER_ALIAS
        filter = SearchFilter(SearchKey(key), ">", SearchValue("1.2.3"))
        with pytest.raises(ValueError, match="organization_id is a required param"):
            _semver_filter_converter(filter, key, None)
        with pytest.raises(ValueError, match="organization_id is a required param"):
            _semver_filter_converter(filter, key, {"something": 1})

    def test_invalid_query(self):
        key = SEMVER_ALIAS
        filter = SearchFilter(SearchKey(key), ">", SearchValue("1.2.hi"))
        with pytest.raises(
            InvalidSearchQuery,
            match=INVALID_SEMVER_MESSAGE,
        ):
            _semver_filter_converter(filter, key, {"organization_id": self.organization.id})

    def test_empty(self):
        self.run_test(">", "1.2.3", "IN", [SEMVER_EMPTY_RELEASE])

    def test(self):
        release = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test@1.2.4")
        self.run_test(">", "1.2.3", "IN", [release_2.version])
        self.run_test(">=", "1.2.4", "IN", [release_2.version])
        self.run_test("<", "1.2.4", "IN", [release.version])
        self.run_test("<=", "1.2.3", "IN", [release.version])
        self.run_test("=", "1.2.4", "IN", [release_2.version])

    def test_invert_query(self):
        # Tests that flipping the query works and uses a NOT IN. Test all operators to
        # make sure the inversion works correctly.
        release = self.create_release(version="test@1.2.3")
        self.create_release(version="test@1.2.4")
        release_2 = self.create_release(version="test@1.2.5")

        with patch("sentry.search.events.filter.MAX_SEARCH_RELEASES", 2):
            self.run_test(">", "1.2.3", "NOT IN", [release.version])
            self.run_test(">=", "1.2.4", "NOT IN", [release.version])
            self.run_test("<", "1.2.5", "NOT IN", [release_2.version])
            self.run_test("<=", "1.2.4", "NOT IN", [release_2.version])
            self.run_test("!=", "1.2.3", "NOT IN", [release.version])

    def test_invert_fails(self):
        # Tests that when we invert and still receive too many records that we return
        # as many records we can using IN that are as close to the specified filter as
        # possible.
        self.create_release(version="test@1.2.1")
        release_1 = self.create_release(version="test@1.2.2")
        release_2 = self.create_release(version="test@1.2.3")
        release_3 = self.create_release(version="test@1.2.4")
        self.create_release(version="test@1.2.5")

        with patch("sentry.search.events.filter.MAX_SEARCH_RELEASES", 2):
            self.run_test(">", "1.2.2", "IN", [release_2.version, release_3.version])
            self.run_test(">=", "1.2.3", "IN", [release_2.version, release_3.version])
            self.run_test("<", "1.2.4", "IN", [release_2.version, release_1.version])
            self.run_test("<=", "1.2.3", "IN", [release_2.version, release_1.version])

    def test_prerelease(self):
        # Prerelease has weird sorting rules, where an empty string is higher priority
        # than a non-empty string. Make sure this sorting works
        release = self.create_release(version="test@1.2.3-alpha")
        release_1 = self.create_release(version="test@1.2.3-beta")
        release_2 = self.create_release(version="test@1.2.3")
        release_3 = self.create_release(version="test@1.2.4-alpha")
        release_4 = self.create_release(version="test@1.2.4")
        self.run_test(
            ">=", "1.2.3", "IN", [release_2.version, release_3.version, release_4.version]
        )
        self.run_test(
            ">=",
            "1.2.3-beta",
            "IN",
            [release_1.version, release_2.version, release_3.version, release_4.version],
        )
        self.run_test("<", "1.2.3", "IN", [release_1.version, release.version])

    def test_granularity(self):
        self.create_release(version="test@1.0.0.0")
        release_2 = self.create_release(version="test@1.2.0.0")
        release_3 = self.create_release(version="test@1.2.3.0")
        release_4 = self.create_release(version="test@1.2.3.4")
        release_5 = self.create_release(version="test@2.0.0.0")
        self.run_test(
            ">",
            "1",
            "IN",
            [release_2.version, release_3.version, release_4.version, release_5.version],
        )
        self.run_test(">", "1.2", "IN", [release_3.version, release_4.version, release_5.version])
        self.run_test(">", "1.2.3", "IN", [release_4.version, release_5.version])
        self.run_test(">", "1.2.3.4", "IN", [release_5.version])
        self.run_test(">", "2", "IN", [SEMVER_EMPTY_RELEASE])

    def test_wildcard(self):
        release_1 = self.create_release(version="test@1.0.0.0")
        release_2 = self.create_release(version="test@1.2.0.0")
        release_3 = self.create_release(version="test@1.2.3.0")
        release_4 = self.create_release(version="test@1.2.3.4")
        release_5 = self.create_release(version="test@2.0.0.0")

        self.run_test(
            "=",
            "1.X",
            "IN",
            [release_1.version, release_2.version, release_3.version, release_4.version],
        )
        self.run_test("=", "1.2.*", "IN", [release_2.version, release_3.version, release_4.version])
        self.run_test("=", "1.2.3.*", "IN", [release_3.version, release_4.version])
        self.run_test("=", "1.2.3.4", "IN", [release_4.version])
        self.run_test("=", "2.*", "IN", [release_5.version])

    def test_multi_package(self):
        release_1 = self.create_release(version="test@1.0.0.0")
        release_2 = self.create_release(version="test@1.2.0.0")
        release_3 = self.create_release(version="test_2@1.2.3.0")
        self.run_test("=", "test@1.*", "IN", [release_1.version, release_2.version])
        self.run_test(">=", "test@1.0", "IN", [release_1.version, release_2.version])
        self.run_test(">", "test_2@1.0", "IN", [release_3.version])

    def test_projects(self):
        project_2 = self.create_project()
        release_1 = self.create_release(version="test@1.0.0.0")
        release_2 = self.create_release(version="test@1.2.0.0", project=project_2)
        release_3 = self.create_release(version="test@1.2.3.0")
        self.run_test(
            ">=",
            "test@1.0",
            "IN",
            [release_1.version, release_2.version, release_3.version],
            project_id=[self.project.id, project_2.id],
        )
        self.run_test(
            ">=",
            "test@1.0",
            "IN",
            [release_1.version, release_3.version],
            project_id=[self.project.id],
        )
        self.run_test(
            ">=",
            "test@1.0",
            "IN",
            [release_2.version],
            project_id=[project_2.id],
        )


class SemverPackageFilterConverterTest(BaseSemverConverterTest, TestCase):
    key = SEMVER_PACKAGE_ALIAS

    def converter(self, *args, **kwargs):
        return _semver_package_filter_converter(*args, **kwargs)

    def test_invalid_params(self):
        key = SEMVER_PACKAGE_ALIAS
        filter = SearchFilter(SearchKey(key), "=", SearchValue("sentry"))
        with pytest.raises(ValueError, match="organization_id is a required param"):
            _semver_filter_converter(filter, key, None)
        with pytest.raises(ValueError, match="organization_id is a required param"):
            _semver_filter_converter(filter, key, {"something": 1})

    def test_empty(self):
        self.run_test("=", "test", "IN", [SEMVER_EMPTY_RELEASE])

    def test(self):
        release = self.create_release(version="test@1.2.3")
        release_2 = self.create_release(version="test@1.2.4")
        release_3 = self.create_release(version="test2@1.2.4")
        self.run_test("=", "test", "IN", [release.version, release_2.version])
        self.run_test("=", "test2", "IN", [release_3.version])
        self.run_test("=", "test3", "IN", [SEMVER_EMPTY_RELEASE])

    def test_projects(self):
        project_2 = self.create_project()
        release_1 = self.create_release(version="test@1.0.0.0")
        release_2 = self.create_release(version="test@1.2.0.0", project=project_2)
        self.create_release(version="test2@1.2.3.0")
        self.run_test("=", "test", "IN", [release_1.version], project_id=[self.project.id])
        self.run_test("=", "test", "IN", [release_2.version], project_id=[project_2.id])
        self.run_test(
            "=",
            "test",
            "IN",
            [release_1.version, release_2.version],
            project_id=[self.project.id, project_2.id],
        )


class SemverBuildFilterConverterTest(BaseSemverConverterTest, TestCase):
    key = SEMVER_BUILD_ALIAS

    def converter(self, *args, **kwargs):
        return _semver_build_filter_converter(*args, **kwargs)

    def test_invalid_params(self):
        key = SEMVER_BUILD_ALIAS
        filter = SearchFilter(SearchKey(key), "=", SearchValue("sentry"))
        with pytest.raises(ValueError, match="organization_id is a required param"):
            _semver_filter_converter(filter, key, None)
        with pytest.raises(ValueError, match="organization_id is a required param"):
            _semver_filter_converter(filter, key, {"something": 1})

    def test_empty(self):
        self.run_test("=", "test", "IN", [SEMVER_EMPTY_RELEASE])

    def test(self):
        release = self.create_release(version="test@1.2.3+123")
        release_2 = self.create_release(version="test@1.2.4+123")
        release_3 = self.create_release(version="test2@1.2.5+124")
        self.run_test("=", "123", "IN", [release.version, release_2.version])
        self.run_test("=", "124", "IN", [release_3.version])
        self.run_test("=", "125", "IN", [SEMVER_EMPTY_RELEASE])
        self.run_test("<", "125", "IN", [release.version, release_2.version, release_3.version])


class ParseSemverTest(unittest.TestCase):
    def run_test(self, version: str, operator: str, expected: SemverFilter):
        semver_filter = parse_semver(version, operator)
        assert semver_filter == expected

    def test_invalid(self):
        with pytest.raises(
            InvalidSearchQuery,
            match=INVALID_SEMVER_MESSAGE,
        ):
            assert parse_semver("1.hello", ">") is None
        with pytest.raises(
            InvalidSearchQuery,
            match=INVALID_SEMVER_MESSAGE,
        ):
            assert parse_semver("hello", ">") is None

    def test_normal(self):
        self.run_test("1", ">", SemverFilter("gt", [1, 0, 0, 0, 1, ""]))
        self.run_test("1.2", ">", SemverFilter("gt", [1, 2, 0, 0, 1, ""]))
        self.run_test("1.2.3", ">", SemverFilter("gt", [1, 2, 3, 0, 1, ""]))
        self.run_test("1.2.3.4", ">", SemverFilter("gt", [1, 2, 3, 4, 1, ""]))
        self.run_test("1.2.3-hi", ">", SemverFilter("gt", [1, 2, 3, 0, 0, "hi"]))
        self.run_test("1.2.3-hi", "<", SemverFilter("lt", [1, 2, 3, 0, 0, "hi"]))
        self.run_test("sentry@1.2.3-hi", "<", SemverFilter("lt", [1, 2, 3, 0, 0, "hi"], "sentry"))

    def test_wildcard(self):
        self.run_test("1.*", "=", SemverFilter("exact", [1]))
        self.run_test("1.2.*", "=", SemverFilter("exact", [1, 2]))
        self.run_test("1.2.3.*", "=", SemverFilter("exact", [1, 2, 3]))
        self.run_test("sentry@1.2.3.*", "=", SemverFilter("exact", [1, 2, 3], "sentry"))
        self.run_test("1.X", "=", SemverFilter("exact", [1]))


def _cond(lhs, op, rhs):
    return Condition(lhs=Column(name=lhs), op=op, rhs=rhs)


def _email(x):
    return _cond("email", Op.EQ, x)


def _message(x):
    return Condition(
        lhs=Function("positionCaseInsensitive", [Column("message"), x]), op=Op.NEQ, rhs=0
    )


def _tag(key, value, op=None):
    if op is None:
        op = Op.IN if isinstance(value, list) else Op.EQ
    return Condition(lhs=Function("ifNull", [Column(f"tags[{key}]"), ""]), op=op, rhs=value)


def _ntag(key, value):
    op = Op.NOT_IN if isinstance(value, list) else Op.NEQ
    return _tag(key, value, op=op)


def _count(op, x):
    return Condition(lhs=Function("count", [], "count"), op=op, rhs=x)


def _project(x):
    return _cond("project_id", Op.EQ, x)


@pytest.mark.parametrize(
    "description,query,expected_where,expected_having",
    [
        (
            "simple_OR_with_2_emails",
            "user.email:foo@example.com OR user.email:bar@example.com",
            [Or(conditions=[_email("foo@example.com"), _email("bar@example.com")])],
            [],
        ),
        (
            "simple_AND_with_2_emails",
            "user.email:foo@example.com AND user.email:bar@example.com",
            [And(conditions=[_email("foo@example.com"), _email("bar@example.com")])],
            [],
        ),
        ("message_containing_OR_as_a_substring", "ORder", [_message("ORder")], []),
        ("message_containing_AND_as_a_substring", "ANDroid", [_message("ANDroid")], []),
        ("single_email_term", "user.email:foo@example.com", [_email("foo@example.com")], []),
        (
            "OR_with_wildcard_array_fields",
            "error.value:Deadlock* OR !stack.filename:*.py",
            [
                Or(
                    conditions=[
                        Condition(
                            lhs=Column("exception_stacks.value"), op=Op.LIKE, rhs="Deadlock%"
                        ),
                        Condition(
                            lhs=Column("exception_frames.filename"), op=Op.NOT_LIKE, rhs="%.py"
                        ),
                    ]
                )
            ],
            [],
        ),
        (
            "simple_order_of_operations_with_OR_then_AND",
            "user.email:foo@example.com OR user.email:bar@example.com AND user.email:foobar@example.com",
            [
                Or(
                    conditions=[
                        _email("foo@example.com"),
                        And(conditions=[_email("bar@example.com"), _email("foobar@example.com")]),
                    ]
                )
            ],
            [],
        ),
        (
            "simple_order_of_operations_with_AND_then_OR",
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com",
            [
                Or(
                    conditions=[
                        And(conditions=[_email("foo@example.com"), _email("bar@example.com")]),
                        _email("foobar@example.com"),
                    ]
                )
            ],
            [],
        ),
        (
            "simple_two_ORs",
            "user.email:foo@example.com OR user.email:bar@example.com OR user.email:foobar@example.com",
            [
                Or(
                    conditions=[
                        _email("foo@example.com"),
                        Or(conditions=[_email("bar@example.com"), _email("foobar@example.com")]),
                    ]
                )
            ],
            [],
        ),
        (
            "simple_two_ANDs",
            "user.email:foo@example.com AND user.email:bar@example.com AND user.email:foobar@example.com",
            [
                And(
                    conditions=[
                        _email("foo@example.com"),
                        And(conditions=[_email("bar@example.com"), _email("foobar@example.com")]),
                    ]
                )
            ],
            [],
        ),
        (
            "OR_with_two_ANDs",
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com",
            [
                Or(
                    conditions=[
                        And(conditions=[_email("foo@example.com"), _email("bar@example.com")]),
                        And(conditions=[_email("foobar@example.com"), _email("hello@example.com")]),
                    ]
                )
            ],
            [],
        ),
        (
            "OR_with_nested_ANDs",
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com",
            [
                Or(
                    conditions=[
                        And(conditions=[_email("foo@example.com"), _email("bar@example.com")]),
                        And(
                            conditions=[
                                _email("foobar@example.com"),
                                And(
                                    conditions=[
                                        _email("hello@example.com"),
                                        _email("hi@example.com"),
                                    ]
                                ),
                            ]
                        ),
                    ]
                )
            ],
            [],
        ),
        (
            "multiple_ORs_with_nested_ANDs",
            "user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com OR user.email:foo@example.com AND user.email:bar@example.com OR user.email:foobar@example.com AND user.email:hello@example.com AND user.email:hi@example.com",
            [
                Or(
                    conditions=[
                        And(conditions=[_email("foo@example.com"), _email("bar@example.com")]),
                        Or(
                            conditions=[
                                And(
                                    conditions=[
                                        _email("foobar@example.com"),
                                        And(
                                            conditions=[
                                                _email("hello@example.com"),
                                                _email("hi@example.com"),
                                            ]
                                        ),
                                    ]
                                ),
                                Or(
                                    conditions=[
                                        And(
                                            conditions=[
                                                _email("foo@example.com"),
                                                _email("bar@example.com"),
                                            ]
                                        ),
                                        And(
                                            conditions=[
                                                _email("foobar@example.com"),
                                                And(
                                                    conditions=[
                                                        _email("hello@example.com"),
                                                        _email("hi@example.com"),
                                                    ]
                                                ),
                                            ]
                                        ),
                                    ]
                                ),
                            ]
                        ),
                    ],
                ),
            ],
            [],
        ),
        (
            "simple_AND_with_grouped_conditions",
            "(event.type:error) AND (stack.in_app:true)",
            [
                And(
                    conditions=[
                        _cond("type", Op.EQ, "error"),
                        _cond("exception_frames.in_app", Op.EQ, 1),
                    ]
                )
            ],
            [],
        ),
        (
            "simple_OR_inside_group",
            "(user.email:foo@example.com OR user.email:bar@example.com)",
            [Or(conditions=[_email("foo@example.com"), _email("bar@example.com")])],
            [],
        ),
        (
            "order_of_operations_with_groups_AND_first_OR_second",
            "(user.email:foo@example.com OR user.email:bar@example.com) AND user.email:foobar@example.com",
            [
                And(
                    conditions=[
                        Or(conditions=[_email("foo@example.com"), _email("bar@example.com")]),
                        _email("foobar@example.com"),
                    ]
                )
            ],
            [],
        ),
        (
            "order_of_operations_with_groups_AND_first_OR_second",
            "user.email:foo@example.com AND (user.email:bar@example.com OR user.email:foobar@example.com)",
            [
                And(
                    conditions=[
                        _email("foo@example.com"),
                        Or(conditions=[_email("bar@example.com"), _email("foobar@example.com")]),
                    ]
                )
            ],
            [],
        ),
        (
            "order_of_operations_with_groups_second_OR_first",
            "(user.email:foo@example.com OR (user.email:bar@example.com OR user.email:foobar@example.com))",
            [
                Or(
                    conditions=[
                        _email("foo@example.com"),
                        Or(conditions=[_email("bar@example.com"), _email("foobar@example.com")]),
                    ]
                )
            ],
            [],
        ),
        (
            "order_of_operations_with_nested_groups",
            "(user.email:foo@example.com OR (user.email:bar@example.com OR (user.email:foobar@example.com AND user.email:hello@example.com OR user.email:hi@example.com)))",
            [
                Or(
                    conditions=[
                        _email("foo@example.com"),
                        Or(
                            conditions=[
                                _email("bar@example.com"),
                                Or(
                                    conditions=[
                                        And(
                                            conditions=[
                                                _email("foobar@example.com"),
                                                _email("hello@example.com"),
                                            ]
                                        ),
                                        _email("hi@example.com"),
                                    ]
                                ),
                            ]
                        ),
                    ]
                )
            ],
            [],
        ),
        (
            "message_outside_simple_grouped_OR",
            "test (item1 OR item2)",
            [
                And(
                    conditions=[
                        _message("test"),
                        Or(conditions=[_message("item1"), _message("item2")]),
                    ]
                )
            ],
            [],
        ),
        ("only_parens", "()", [_message("()")], []),
        ("grouped_free_text", "(test)", [_message("test")], []),
        (
            "free_text_with_parens",
            "undefined is not an object (evaluating 'function.name')",
            [_message("undefined is not an object (evaluating 'function.name')")],
            [],
        ),
        (
            "free_text_AND_grouped_message",
            "combined (free text) AND (grouped)",
            [And(conditions=[_message("combined (free text)"), _message("grouped")])],
            [],
        ),
        (
            "free_text_OR_free_text",
            "foo bar baz OR fizz buzz bizz",
            [Or(conditions=[_message("foo bar baz"), _message("fizz buzz bizz")])],
            [],
        ),
        (
            "grouped_OR_and_OR",
            "a:b (c:d OR e:f) g:h i:j OR k:l",
            [
                Or(
                    conditions=[
                        And(
                            conditions=[
                                _tag("a", "b"),
                                And(
                                    conditions=[
                                        Or(conditions=[_tag("c", "d"), _tag("e", "f")]),
                                        And(conditions=[_tag("g", "h"), _tag("i", "j")]),
                                    ]
                                ),
                            ]
                        ),
                        _tag("k", "l"),
                    ]
                )
            ],
            [],
        ),
        (
            "OR_and_grouped_OR",
            "a:b OR c:d e:f g:h (i:j OR k:l)",
            [
                Or(
                    conditions=[
                        _tag("a", "b"),
                        And(
                            conditions=[
                                _tag("c", "d"),
                                And(
                                    conditions=[
                                        _tag("e", "f"),
                                        And(
                                            conditions=[
                                                _tag("g", "h"),
                                                Or(conditions=[_tag("i", "j"), _tag("k", "l")]),
                                            ]
                                        ),
                                    ]
                                ),
                            ]
                        ),
                    ],
                )
            ],
            [],
        ),
        (
            "grouped_OR",
            "(a:b OR c:d) e:f",
            [And(conditions=[Or(conditions=[_tag("a", "b"), _tag("c", "d")]), _tag("e", "f")])],
            [],
        ),
        (
            "ORs_and_no_parens",
            "a:b OR c:d e:f g:h i:j OR k:l",
            [
                Or(
                    conditions=[
                        _tag("a", "b"),
                        Or(
                            conditions=[
                                And(
                                    conditions=[
                                        _tag("c", "d"),
                                        And(
                                            conditions=[
                                                _tag("e", "f"),
                                                And(conditions=[_tag("g", "h"), _tag("i", "j")]),
                                            ]
                                        ),
                                    ]
                                ),
                                _tag("k", "l"),
                            ],
                        ),
                    ]
                )
            ],
            [],
        ),
        (
            "grouped_OR_and_OR",
            "(a:b OR c:d) e:f g:h OR i:j k:l",
            [
                Or(
                    conditions=[
                        And(
                            conditions=[
                                Or(conditions=[_tag("a", "b"), _tag("c", "d")]),
                                And(conditions=[_tag("e", "f"), _tag("g", "h")]),
                            ]
                        ),
                        And(conditions=[_tag("i", "j"), _tag("k", "l")]),
                    ]
                )
            ],
            [],
        ),
        (
            "single_OR_and_no_parens",
            "a:b c:d e:f OR g:h i:j",
            [
                Or(
                    conditions=[
                        And(
                            conditions=[
                                _tag("a", "b"),
                                And(conditions=[_tag("c", "d"), _tag("e", "f")]),
                            ]
                        ),
                        And(conditions=[_tag("g", "h"), _tag("i", "j")]),
                    ]
                ),
            ],
            [],
        ),
        (
            "single_grouped_OR",
            "a:b c:d (e:f OR g:h) i:j",
            [
                And(
                    conditions=[
                        _tag("a", "b"),
                        And(
                            conditions=[
                                _tag("c", "d"),
                                And(
                                    conditions=[
                                        Or(conditions=[_tag("e", "f"), _tag("g", "h")]),
                                        _tag("i", "j"),
                                    ]
                                ),
                            ]
                        ),
                    ]
                )
            ],
            [],
        ),
        (
            "negation_and_grouped_OR",
            "!a:b c:d (e:f OR g:h) i:j",
            [
                And(
                    conditions=[
                        _ntag("a", "b"),
                        And(
                            conditions=[
                                _tag("c", "d"),
                                And(
                                    conditions=[
                                        Or(conditions=[_tag("e", "f"), _tag("g", "h")]),
                                        _tag("i", "j"),
                                    ]
                                ),
                            ]
                        ),
                    ]
                )
            ],
            [],
        ),
        (
            "nested_ORs_and_AND",
            "(a:b OR (c:d AND (e:f OR (g:h AND e:f))))",
            [
                Or(
                    conditions=[
                        _tag("a", "b"),
                        And(
                            conditions=[
                                _tag("c", "d"),
                                Or(
                                    conditions=[
                                        _tag("e", "f"),
                                        And(conditions=[_tag("g", "h"), _tag("e", "f")]),
                                    ]
                                ),
                            ]
                        ),
                    ]
                )
            ],
            [],
        ),
        (
            "grouped_OR_then_AND_with_implied_AND",
            "(a:b OR c:d) AND (e:f g:h)",
            [
                And(
                    conditions=[
                        Or(conditions=[_tag("a", "b"), _tag("c", "d")]),
                        And(conditions=[_tag("e", "f"), _tag("g", "h")]),
                    ]
                )
            ],
            [],
        ),
        (
            "aggregate_AND_with_2_counts",
            "count():>1 AND count():<=3",
            [],
            [And(conditions=[_count(Op.GT, 1), _count(Op.LTE, 3)])],
        ),
        (
            "aggregate_OR_with_2_counts",
            "count():>1 OR count():<=3",
            [],
            [Or(conditions=[_count(Op.GT, 1), _count(Op.LTE, 3)])],
        ),
        (
            "aggregate_order_of_operations_with_OR_then_AND",
            "count():>1 OR count():>5 AND count():<=3",
            [],
            [
                Or(
                    conditions=[
                        _count(Op.GT, 1),
                        And(conditions=[_count(Op.GT, 5), _count(Op.LTE, 3)]),
                    ]
                )
            ],
        ),
        (
            "aggregate_order_of_operations_with_AND_then_OR",
            "count():>1 AND count():<=3 OR count():>5",
            [],
            [
                Or(
                    conditions=[
                        And(conditions=[_count(Op.GT, 1), _count(Op.LTE, 3)]),
                        _count(Op.GT, 5),
                    ]
                )
            ],
        ),
        (
            "grouped_aggregate_OR_then_AND",
            "(count():>1 OR count():>2) AND count():<=3",
            [],
            [
                And(
                    conditions=[
                        Or(conditions=[_count(Op.GT, 1), _count(Op.GT, 2)]),
                        _count(Op.LTE, 3),
                    ]
                )
            ],
        ),
        (
            "grouped_aggregate_AND_then_OR",
            "(count():>1 AND count():>5) OR count():<=3",
            [],
            [
                Or(
                    conditions=[
                        And(conditions=[_count(Op.GT, 1), _count(Op.GT, 5)]),
                        _count(Op.LTE, 3),
                    ]
                )
            ],
        ),
        ("aggregate_AND_tag", "count():>1 AND a:b", [_tag("a", "b")], [_count(Op.GT, 1)]),
        (
            "aggregate_AND_two_tags",
            "count():>1 AND a:b c:d",
            [And(conditions=[_tag("a", "b"), _tag("c", "d")])],
            [_count(Op.GT, 1)],
        ),
        (
            "ORed_tags_AND_aggregate",
            "(a:b OR c:d) count():>1",
            [Or(conditions=[_tag("a", "b"), _tag("c", "d")])],
            [_count(Op.GT, 1)],
        ),
        (
            "aggregate_like_message_and_columns",
            "failure_rate():>0.003&& users:>10 event.type:transaction",
            [
                _message("failure_rate():>0.003&&"),
                _tag("users", ">10"),
                _cond("type", Op.EQ, "transaction"),
            ],
            [],
        ),
        (
            "message_with_parens",
            "TypeError Anonymous function(app/javascript/utils/transform-object-keys)",
            [_message("TypeError Anonymous function(app/javascript/utils/transform-object-keys)")],
            [],
        ),
        ("tag_containing_OR", "organization.slug:slug", [_tag("organization.slug", "slug")], []),
        (
            "in_search_then_AND",
            'url:["a", "b"] AND release:test',
            [And(conditions=[_tag("url", ["a", "b"]), _cond("release", Op.IN, ["test"])])],
            [],
        ),
        (
            "in_search_then_OR",
            'url:["a", "b"] OR release:test',
            [Or(conditions=[_tag("url", ["a", "b"]), _cond("release", Op.IN, ["test"])])],
            [],
        ),
        (
            "AND_multiple_in_searches",
            'url:["a", "b"] AND url:["c", "d"] OR url:["e", "f"]',
            [
                Or(
                    conditions=[
                        And(conditions=[_tag("url", ["a", "b"]), _tag("url", ["c", "d"])]),
                        _tag("url", ["e", "f"]),
                    ]
                )
            ],
            [],
        ),
    ],
)
def test_snql_boolean_search(description, query, expected_where, expected_having):
    dataset = Dataset.Discover
    params: ParamsType = {"project_id": 1}
    query_filter = UnresolvedQuery(dataset, params)
    where, having = query_filter.resolve_conditions(query, use_aggregate_conditions=True)
    assert where == expected_where, description
    assert having == expected_having, description


@pytest.mark.parametrize(
    "description,query,expected_message",
    [
        (
            "missing_close_parens",
            "(user.email:foo@example.com OR user.email:bar@example.com",
            "Parse error at '(user.' (column 1). This is commonly caused by unmatched parentheses. Enclose any text in double quotes.",
        ),
        (
            "missing_second_close_parens",
            "((user.email:foo@example.com OR user.email:bar@example.com AND  user.email:bar@example.com)",
            "Parse error at '((user' (column 1). This is commonly caused by unmatched parentheses. Enclose any text in double quotes.",
        ),
        (
            "missing_open_parens",
            "user.email:foo@example.com OR user.email:bar@example.com)",
            "Parse error at '.com)' (column 57). This is commonly caused by unmatched parentheses. Enclose any text in double quotes.",
        ),
        (
            "missing_second_open_parens",
            "(user.email:foo@example.com OR user.email:bar@example.com AND  user.email:bar@example.com))",
            "Parse error at 'com))' (column 91). This is commonly caused by unmatched parentheses. Enclose any text in double quotes.",
        ),
        (
            "cannot_OR_aggregate_and_normal_filter",
            "count():>1 OR a:b",
            "Having an OR between aggregate filters and normal filters is invalid.",
        ),
        (
            "cannot_OR_normal_filter_with_an_AND_of_aggregate_and_normal_filters",
            "(count():>1 AND a:b) OR a:b",
            "Having an OR between aggregate filters and normal filters is invalid.",
        ),
        (
            "cannot_OR_an_AND_of_aggregate_and_normal_filters",
            "(count():>1 AND a:b) OR (a:b AND count():>2)",
            "Having an OR between aggregate filters and normal filters is invalid.",
        ),
        (
            "cannot_nest_aggregate_filter_in_AND_condition_then_OR_with_normal_filter",
            "a:b OR (c:d AND (e:f AND count():>1))",
            "Having an OR between aggregate filters and normal filters is invalid.",
        ),
        (
            "missing_left_hand_side_of_OR",
            "OR a:b",
            "Condition is missing on the left side of 'OR' operator",
        ),
        (
            "missing_condition_between_OR_and_AND",
            "a:b Or And c:d",
            "Missing condition in between two condition operators: 'OR AND'",
        ),
        (
            "missing_right_hand_side_of_AND",
            "a:b AND c:d AND",
            "Condition is missing on the right side of 'AND' operator",
        ),
        (
            "missing_left_hand_side_of_OR_inside_parens",
            "(OR a:b) AND c:d",
            "Condition is missing on the left side of 'OR' operator",
        ),
    ],
)
def test_snql_malformed_boolean_search(description, query, expected_message):
    dataset = Dataset.Discover
    params: ParamsType = {}
    query_filter = UnresolvedQuery(dataset, params)
    with pytest.raises(InvalidSearchQuery) as error:
        where, having = query_filter.resolve_conditions(query, use_aggregate_conditions=True)
    assert str(error.value) == expected_message, description


class SnQLBooleanSearchQueryTest(TestCase):
    def setUp(self):
        self.project1 = self.create_project()
        self.project2 = self.create_project()
        self.project3 = self.create_project()

        self.group1 = self.create_group(project=self.project1)
        self.group2 = self.create_group(project=self.project1)
        self.group3 = self.create_group(project=self.project1)

        dataset = Dataset.Discover
        params: ParamsType = {
            "organization_id": self.organization.id,
            "project_id": [self.project1.id, self.project2.id],
        }
        self.query_filter = UnresolvedQuery(dataset, params)

    def test_project_or(self):
        query = f"project:{self.project1.slug} OR project:{self.project2.slug}"
        where, having = self.query_filter.resolve_conditions(query, use_aggregate_conditions=True)
        assert where == [Or(conditions=[_project(self.project1.id), _project(self.project2.id)])]
        assert having == []

    def test_project_and_with_parens(self):
        query = f"(project:{self.project1.slug} OR project:{self.project2.slug}) AND a:b"
        where, having = self.query_filter.resolve_conditions(query, use_aggregate_conditions=True)
        assert where == [
            And(
                conditions=[
                    Or(conditions=[_project(self.project1.id), _project(self.project2.id)]),
                    _tag("a", "b"),
                ]
            )
        ]
        assert having == []

    def test_project_or_with_nested_ands(self):
        query = f"(project:{self.project1.slug} AND a:b) OR (project:{self.project1.slug} AND c:d)"
        where, having = self.query_filter.resolve_conditions(query, use_aggregate_conditions=True)
        assert where == [
            Or(
                conditions=[
                    And(conditions=[_project(self.project1.id), _tag("a", "b")]),
                    And(conditions=[_project(self.project1.id), _tag("c", "d")]),
                ]
            )
        ]
        assert having == []

    def test_project_not_selected(self):
        with self.assertRaisesRegex(
            InvalidSearchQuery,
            re.escape(
                f"Invalid query. Project(s) {str(self.project3.slug)} do not exist or are not actively selected."
            ),
        ):
            query = f"project:{self.project1.slug} OR project:{self.project3.slug}"
            self.query_filter.resolve_conditions(query, use_aggregate_conditions=True)

    def test_issue_id_or(self):
        query = f"issue.id:{self.group1.id} OR issue.id:{self.group2.id}"
        where, having = self.query_filter.resolve_conditions(query, use_aggregate_conditions=True)
        assert where == [
            Or(
                conditions=[
                    _cond("group_id", Op.EQ, self.group1.id),
                    _cond("group_id", Op.EQ, self.group2.id),
                ]
            )
        ]
        assert having == []

    def test_issue_id_and(self):
        query = f"issue.id:{self.group1.id} AND issue.id:{self.group1.id}"
        where, having = self.query_filter.resolve_conditions(query, use_aggregate_conditions=True)
        assert where == [
            And(
                conditions=[
                    _cond("group_id", Op.EQ, self.group1.id),
                    _cond("group_id", Op.EQ, self.group1.id),
                ]
            )
        ]
        assert having == []

    def test_issue_id_or_with_parens(self):
        query = f"(issue.id:{self.group1.id} AND issue.id:{self.group2.id}) OR issue.id:{self.group3.id}"
        where, having = self.query_filter.resolve_conditions(query, use_aggregate_conditions=True)
        assert where == [
            Or(
                conditions=[
                    And(
                        conditions=[
                            _cond("group_id", Op.EQ, self.group1.id),
                            _cond("group_id", Op.EQ, self.group2.id),
                        ]
                    ),
                    _cond("group_id", Op.EQ, self.group3.id),
                ]
            )
        ]
        assert having == []

    def test_issue_id_and_tag(self):
        query = f"issue.id:{self.group1.id} AND a:b"
        where, having = self.query_filter.resolve_conditions(query, use_aggregate_conditions=True)
        assert where == [And(conditions=[_cond("group_id", Op.EQ, self.group1.id), _tag("a", "b")])]
        assert having == []

    def test_issue_id_or_tag(self):
        query = f"issue.id:{self.group1.id} OR a:b"
        where, having = self.query_filter.resolve_conditions(query, use_aggregate_conditions=True)
        assert where == [Or(conditions=[_cond("group_id", Op.EQ, self.group1.id), _tag("a", "b")])]
        assert having == []

    def test_issue_id_or_with_parens_and_tag(self):
        query = f"(issue.id:{self.group1.id} AND a:b) OR issue.id:{self.group2.id}"
        where, having = self.query_filter.resolve_conditions(query, use_aggregate_conditions=True)
        assert where == [
            Or(
                conditions=[
                    And(conditions=[_cond("group_id", Op.EQ, self.group1.id), _tag("a", "b")]),
                    _cond("group_id", Op.EQ, self.group2.id),
                ]
            )
        ]
        assert having == []

    def test_issue_id_or_with_parens_and_multiple_tags(self):
        query = f"(issue.id:{self.group1.id} AND a:b) OR c:d"
        where, having = self.query_filter.resolve_conditions(query, use_aggregate_conditions=True)
        assert where == [
            Or(
                conditions=[
                    And(conditions=[_cond("group_id", Op.EQ, self.group1.id), _tag("a", "b")]),
                    _tag("c", "d"),
                ]
            )
        ]
        assert having == []
