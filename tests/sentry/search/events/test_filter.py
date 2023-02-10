import re
import unittest
from unittest.mock import patch

import pytest
from snuba_sdk.column import Column
from snuba_sdk.conditions import And, Condition, Op, Or
from snuba_sdk.function import Function

from sentry.api.event_search import SearchFilter, SearchKey, SearchValue
from sentry.api.release_search import INVALID_SEMVER_MESSAGE
from sentry.models.release import SemverFilter
from sentry.search.events.builder import UnresolvedQuery
from sentry.search.events.constants import (
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
    parse_semver,
)
from sentry.search.events.types import ParamsType
from sentry.testutils.cases import TestCase
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
        with pytest.raises(
            InvalidSearchQuery, match=r"fn_wo_optionals\(\): expected 2 argument\(s\)"
        ):
            self.fn_wo_optionals.validate_argument_count("fn_wo_optionals()", ["arg1"])

    def test_no_optional_too_may_arguments(self):
        with pytest.raises(
            InvalidSearchQuery, match=r"fn_wo_optionals\(\): expected 2 argument\(s\)"
        ):
            self.fn_wo_optionals.validate_argument_count(
                "fn_wo_optionals()", ["arg1", "arg2", "arg3"]
            )

    def test_optional_valid(self):
        self.fn_w_optionals.validate_argument_count("fn_w_optionals()", ["arg1", "arg2"])
        # because the last argument is optional, we don't need to provide it
        self.fn_w_optionals.validate_argument_count("fn_w_optionals()", ["arg1"])

    def test_optional_not_enough_arguments(self):
        with pytest.raises(
            InvalidSearchQuery, match=r"fn_w_optionals\(\): expected at least 1 argument\(s\)"
        ):
            self.fn_w_optionals.validate_argument_count("fn_w_optionals()", [])

    def test_optional_too_many_arguments(self):
        with pytest.raises(
            InvalidSearchQuery, match=r"fn_w_optionals\(\): expected at most 2 argument\(s\)"
        ):
            self.fn_w_optionals.validate_argument_count(
                "fn_w_optionals()", ["arg1", "arg2", "arg3"]
            )

    def test_optional_args_have_default(self):
        with pytest.raises(
            AssertionError, match="test: optional argument at index 0 does not have default"
        ):
            DiscoverFunction("test", optional_args=[FunctionArg("arg1")])

    def test_defining_duplicate_args(self):
        with pytest.raises(AssertionError, match="test: argument arg1 specified more than once"):
            DiscoverFunction(
                "test",
                required_args=[FunctionArg("arg1")],
                optional_args=[with_default("default", FunctionArg("arg1"))],
                transform="",
            )

        with pytest.raises(AssertionError, match="test: argument arg1 specified more than once"):
            DiscoverFunction(
                "test",
                required_args=[FunctionArg("arg1")],
                calculated_args=[{"name": "arg1", "fn": lambda x: x}],
                transform="",
            )

        with pytest.raises(AssertionError, match="test: argument arg1 specified more than once"):
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

        filter = SearchFilter(SearchKey(key), "IN", SearchValue("sentry"))
        with pytest.raises(
            InvalidSearchQuery, match="Invalid operation 'IN' for semantic version filter."
        ):
            _semver_filter_converter(filter, key, {"organization_id": 1})

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
        with pytest.raises(
            InvalidSearchQuery,
            match="Invalid operation 'IN' for semantic version filter.",
        ):
            assert parse_semver("1.2.3.4", "IN") is None

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


@pytest.mark.django_db
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
    params: ParamsType = {"project_id": [1]}
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
        with pytest.raises(
            InvalidSearchQuery,
            match=re.escape(
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
