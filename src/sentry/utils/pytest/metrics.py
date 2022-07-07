import copy
import dataclasses
import functools
import os

import pytest
from snuba_sdk import AliasedExpression, Column, Condition, Function, Op, OrderBy


@pytest.fixture(autouse=True)
def control_metrics_access(monkeypatch, request, set_sentry_option):
    from sentry.sentry_metrics import indexer
    from sentry.sentry_metrics.indexer.mock import MockIndexer
    from sentry.utils import snuba

    if "sentry_metrics" in {mark.name for mark in request.node.iter_markers()}:
        mock_indexer = MockIndexer()
        monkeypatch.setattr("sentry.sentry_metrics.indexer.bulk_record", mock_indexer.bulk_record)
        monkeypatch.setattr("sentry.sentry_metrics.indexer.record", mock_indexer.record)
        monkeypatch.setattr("sentry.sentry_metrics.indexer.resolve", mock_indexer.resolve)
        monkeypatch.setattr(
            "sentry.sentry_metrics.indexer.reverse_resolve", mock_indexer.reverse_resolve
        )

        if os.environ.get("SENTRY_METRICS_SIMULATE_TAG_VALUES_IN_CLICKHOUSE") != "1":
            return

        set_sentry_option("sentry-metrics.performance.tags-values-are-strings", True)
        old_resolve = indexer.resolve

        def new_resolve(org_id, string, *args, **kwargs):
            if string in ("", "staging", "value1", "prod", "exited", "myapp@2.0.0"):
                pytest.fail(
                    "stop right there, thief! you're about to resolve something that looks like a tag value, but in this test mode, tag values are stored in clickhouse. the indexer might not have the value!"
                )
            return old_resolve(org_id, string, *args, **kwargs)

        monkeypatch.setattr(indexer, "resolve", new_resolve)

        old_build_results = snuba._apply_cache_and_build_results

        def new_build_results(*args, **kwargs):
            query = args[0][0][0].query
            is_metrics = query.match.name.startswith("metrics_")

            convert_select_columns = []

            if is_metrics:
                query, convert_select_columns = _rewrite_query(old_resolve, query)
                args[0][0][0].query = query

            result = old_build_results(*args, **kwargs)

            if is_metrics:
                for row in result[0].get("data") or ():
                    for k in convert_select_columns:
                        if k in row:
                            assert isinstance(row[k], int)
                            row[k] = indexer.reverse_resolve(row[k])
                            assert row[k] is None or isinstance(row[k], str)

            return result

        monkeypatch.setattr(snuba, "_apply_cache_and_build_results", new_build_results)
    else:
        should_fail = False

        def fail(old_fn, *args, **kwargs):
            nonlocal should_fail
            should_fail = True
            return old_fn(*args, **kwargs)

        monkeypatch.setattr(indexer, "resolve", functools.partial(fail, indexer.resolve))
        monkeypatch.setattr(indexer, "bulk_record", functools.partial(fail, indexer.bulk_record))

        if should_fail:
            pytest.fail(
                "Your test accesses sentry metrics without declaring it in "
                "metadata. Add this to your testfile:\n\n"
                "pytestmark = pytest.mark.sentry_metrics"
            )


def _rewrite_query(indexer_resolve, query):
    """
    Rewrites the SNQL query and result to simulate a version of Snuba that
    stores tag values as strings.
    """
    org_id = None
    for clause in query.where:
        if (
            isinstance(clause, Condition)
            and clause.op == Op.EQ
            and isinstance(clause.lhs, Column)
            and clause.lhs.name == "org_id"
            and isinstance(clause.rhs, int)
        ):
            org_id = clause.rhs
            break

    assert org_id

    convert_select_columns = set()

    def _walk_term(term):
        if isinstance(term, OrderBy):
            return dataclasses.replace(term, exp=_walk_term(term.exp))

        if isinstance(term, Column) and term.subscriptable == "tags":
            convert_select_columns.add(term.name)
            return term

        if (
            isinstance(term, AliasedExpression)
            and isinstance(col := term.exp, Column)
            and col.subscriptable == "tags"
            and term.alias
        ):
            convert_select_columns.add(term.alias)
            return term

        if isinstance(term, Condition):
            if (
                term.op == Op.EQ
                and isinstance(lhs := term.lhs, Column)
                and lhs.subscriptable == "tags"
                and isinstance(rhs := term.rhs, str)
            ):
                return dataclasses.replace(term, rhs=indexer_resolve(org_id, rhs))

            if (
                term.op == Op.IN
                and isinstance(lhs := term.lhs, Column)
                and lhs.subscriptable == "tags"
                and isinstance(rhs := term.rhs, (tuple, list))
            ):
                assert all(isinstance(x, str) for x in rhs)
                return dataclasses.replace(term, rhs=[indexer_resolve(org_id, x) for x in rhs])

            if (
                term.op == Op.IN
                and isinstance(lhs := term.lhs, Column)
                and lhs.subscriptable == "tags"
                and isinstance(rhs := term.rhs, Function)
                and rhs.function == "tuple"
            ):
                assert all(isinstance(x, str) for x in rhs.parameters or ())
                return dataclasses.replace(
                    term,
                    rhs=dataclasses.replace(
                        rhs, parameters=[indexer_resolve(org_id, x) for x in rhs.parameters or ()]
                    ),
                )

            if (
                term.op == Op.IN
                and isinstance(lhs := term.lhs, Function)
                and lhs.function == "tuple"
                and isinstance(rhs := term.rhs, Function)
                and rhs.function == "tuple"
            ):
                new_rhs = []
                for right in rhs.parameters:
                    new_right = []
                    assert isinstance(right, tuple)
                    for left, right in zip(lhs.parameters, right):
                        if isinstance(left, Column) and left.subscriptable == "tags":
                            assert isinstance(right, str)
                            new_right.append(indexer_resolve(org_id, right))
                        else:
                            new_right.append(right)

                    new_rhs.append(tuple(new_right))

                return dataclasses.replace(term, rhs=dataclasses.replace(rhs, parameters=new_rhs))

            return term

        if (
            isinstance(term, Function)
            and term.function == "equals"
            and term.parameters
            and isinstance(lhs := term.parameters[0], Column)
            and lhs.subscriptable == "tags"
        ):
            assert isinstance(
                rhs := term.parameters[1], str
            ), f"found resolved integers in tags-related clause {term}"
            resolved_string = indexer_resolve(org_id, rhs)
            new_parameters = list(term.parameters)
            new_parameters[1] = resolved_string
            new_term = dataclasses.replace(term, parameters=new_parameters)
            return new_term

        if (
            isinstance(term, Function)
            and term.parameters
            and isinstance(lhs := term.parameters[0], Column)
            and lhs.subscriptable == "tags"
            and term.function in ("notIn", "in")
            and isinstance(rhs := term.parameters[1], list)
        ):
            assert all(
                isinstance(x, str) for x in rhs
            ), f"found resolved integers in tags-related clause {term}"
            new_parameters = copy.deepcopy(term.parameters)
            for i, x in enumerate(rhs):
                resolved_string = indexer_resolve(org_id, x)
                new_parameters[1][i] = resolved_string

            new_term = dataclasses.replace(term, parameters=new_parameters)
            return new_term

        if isinstance(term, Function) and term.function in ("in", "notIn", "equals"):
            assert not isinstance(term.parameters[0], Column) or term.parameters[0] != "tags"
            return term

        if isinstance(term, Column) and term.subscriptable != "tags":
            return term

        if isinstance(term, AliasedExpression):
            return dataclasses.replace(term, exp=_walk_term(term.exp))

        if isinstance(term, Function) and term.function in (
            "and",
            "or",
            "plus",
            "minus",
            "divide",
            "equals",
            "lessOrEquals",
            "greaterOrEquals",
        ):
            new_parameters = [_walk_term(param) for param in term.parameters or ()]
            return dataclasses.replace(term, parameters=new_parameters)

        if (
            isinstance(term, Function)
            and isinstance(col := term.parameters[0], Column)
            and col.name in ("project_id", "timestamp")
        ):
            return term

        if isinstance(term, Function) and "If" in term.function:
            new_parameters = list(term.parameters)
            new_parameters[1] = _walk_term(term.parameters[1])
            return dataclasses.replace(term, parameters=new_parameters)

        if isinstance(term, Function) and term.function == "arrayElement":
            new_parameters = list(term.parameters)
            new_parameters[0] = _walk_term(term.parameters[0])
            return dataclasses.replace(term, parameters=new_parameters)

        if isinstance(term, Function) and term.function == "arrayReduce":
            new_parameters = list(term.parameters)
            new_parameters[1] = [_walk_term(param) for param in term.parameters[1]]
            return dataclasses.replace(term, parameters=new_parameters)

        if isinstance(term, (str, int, float)):
            return term

        raise AssertionError(f"don't know how to rewrite snql: {term}")

    query = dataclasses.replace(
        query,
        select=[_walk_term(clause) for clause in query.select],
        where=[_walk_term(clause) for clause in query.where],
        groupby=[_walk_term(clause) for clause in query.groupby],
        orderby=[_walk_term(clause) for clause in query.orderby or ()],
    )

    return query, convert_select_columns


def _resolve_integers_in_result(result, int_to_str):
    if isinstance(result, dict):
        return {k: _resolve_integers_in_result(v, int_to_str) for k, v in result.items()}
    elif isinstance(result, list):
        return [_resolve_integers_in_result(v, int_to_str) for v in result]
    elif isinstance(result, int) and result in int_to_str:
        return int_to_str[result]
    else:
        return result
