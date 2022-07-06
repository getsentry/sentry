import os
import copy

import dataclasses
import functools
import pytest

from snuba_sdk import AliasedExpression, Column, Condition, Function, Op

@pytest.fixture(autouse=True)
def control_metrics_access(monkeypatch, request, set_sentry_option):
    from sentry.sentry_metrics import indexer
    from sentry.utils import snuba

    if 'sentry_metrics' in set(mark.name for mark in request.node.iter_markers()):
        if os.environ.get("SENTRY_METRICS_SIMULATE_TAG_VALUES_IN_CLICKHOUSE") != "1":
            return

        set_sentry_option("sentry-metrics.performance.tags-values-are-strings", True)
        old_build_results = snuba._apply_cache_and_build_results

        def new_build_results(*args, **kwargs):
            query = args[0][0][0].query
            is_metrics = query.match.name.startswith("metrics_")

            if is_metrics:
                query, convert_select_columns = _rewrite_query(query)

            result = old_build_results(*args, **kwargs)

            if is_metrics:
                for row in result:
                    for k in convert_select_columns:
                        if k in row:
                            assert isinstance(row[k], int)
                            row[k] = indexer.reverse_resolve(row[k])
                            assert isinstance(row[k], str)

            return result

        monkeypatch.setattr(snuba, "_apply_cache_and_build_results", new_build_results)
    else:
        should_fail = False

        def fail(old_fn, *args, **kwargs):
            nonlocal should_fail
            should_fail = True
            return old_fn(*args, **kwargs)

        monkeypatch.setattr(indexer, 'resolve', functools.partial(fail, indexer.resolve))
        monkeypatch.setattr(indexer, 'bulk_record', functools.partial(fail, indexer.bulk_record))

        if should_fail:
            pytest.fail(
                "Your test accesses sentry metrics without declaring it in "
                "metadata. Add this to your testfile:\n\n"
                "pytestmark = pytest.mark.sentry_metrics"
            )



def _rewrite_query(query):
    """
    Rewrites the SNQL query and result to simulate a version of Snuba that
    stores tag values as strings.
    """
    from sentry.sentry_metrics import indexer

    org_id = None
    for clause in query.where:
        if (isinstance(clause, Condition)
            and clause.op == Op.EQ
            and isinstance(clause.lhs, Column) 
            and clause.lhs.name == 'org_id' 
            and isinstance(clause.rhs, int)):
            org_id = clause.rhs
            break

    assert org_id

    convert_select_columns = set()

    def _walk_term(term):
        if (isinstance(term, Column) and term.subscriptable == 'tags'):
            convert_select_columns.add(term.name)
            return term

        if (
            isinstance(term, AliasedExpression) and
            isinstance(col := term.exp, Column) and
            col.subscriptable == 'tags' and
            term.alias
        ):
            convert_select_columns.add(term.alias)
            return term

        if isinstance(term, Condition):
            if (isinstance(lhs := term.lhs, Column) and
                lhs.subscriptable == 'tags'):
                rhs = term.rhs
                assert isinstance(rhs, str), f'found resolved integers in tags-related clause {term}'
                # HACK: mutating frozen dataclass
                term.__dict__['rhs'] = indexer.resolve(org_id, rhs)
            return term

        if (
            isinstance(term, Function) and
            term.parameters and
            isinstance(lhs := term.parameters[0], Column) and
            lhs.subscriptable == 'tags' and
            term.function == 'equals'
        ):
            if not isinstance(term.parameters[1], str):
                import pdb
                pdb.set_trace()
            assert isinstance(rhs := term.parameters[1], str), f'found resolved integers in tags-related clause {term}'
            resolved_string = indexer.resolve(org_id, rhs)
            new_parameters = copy.deepcopy(term.parameters)
            new_parameters[1] = resolved_string
            new_term = dataclasses.replace(term, parameters=new_parameters)
            return new_term

        if (
        isinstance(term, Function) and
            term.parameters and
            isinstance(lhs := term.parameters[0], Column) and
            lhs.subscriptable == 'tags' and
            term.function in ('notIn', 'in') and
            isinstance(rhs := term.parameters[1], list)
        ):
            if not all(isinstance(x, str) for x in rhs):
                import pdb
                pdb.set_trace()

            assert all(isinstance(x, str) for x in rhs), f'found resolved integers in tags-related clause {term}'
            new_parameters = copy.deepcopy(term.parameters)
            for i, x in enumerate(rhs):
                resolved_string = indexer.resolve(org_id, x)
                new_parameters[1][i] = resolved_string

            new_term = dataclasses.replace(term, parameters=new_parameters)
            return new_term

        if isinstance(term, Function) and term.function in ('in', 'notIn', 'equals'):
            assert not isinstance(term.parameters[0], Column) or term.parameters[0] != 'tags'
            return term

        if isinstance(term, Column):
            # if we end up walking into a term like tags[123], we failed to
            # catch that at an outer call of _walk_term
            if term.subscriptable == 'tags':
                import pdb
                pdb.set_trace()
            assert term.subscriptable != 'tags'
            return term

        if isinstance(term, AliasedExpression):
            return dataclasses.replace(term, exp=_walk_term(term.exp))

        if (isinstance(term, Function) and
            term.function in ('and', 'or', 'plus', 'minus', 'divide', 'equals', 'lessOrEquals', 'greaterOrEquals')):
            new_parameters = [_walk_term(param) for param in term.parameters or ()]
            return dataclasses.replace(term, parameters=new_parameters)

        if (
            isinstance(term, Function) and 
            isinstance(col := term.parameters[0], Column) and
            col.name == 'project_id'
        ):
            return term

        if isinstance(term, Function) and 'If' in term.function:
            new_parameters = copy.deepcopy(term.parameters)
            new_parameters[1] = _walk_term(term.parameters[1])
            return dataclasses.replace(term, parameters=new_parameters)

        if isinstance(term, Function) and term.function == 'arrayElement':
            new_parameters = copy.deepcopy(term.parameters)
            new_parameters[0] = _walk_term(term.parameters[0])
            return dataclasses.replace(term, parameters=new_parameters)

        if isinstance(term, Function) and term.function == 'arrayReduce':
            new_parameters = copy.deepcopy(term.parameters)
            new_parameters[1] = [
                _walk_term(param)
                for param in term.parameters[1]
            ]
            return dataclasses.replace(term, parameters=new_parameters)

        if isinstance(term, (str, int, float)):
            return term

        raise AssertionError(f"don't know how to rewrite snql: {term}")


    query = dataclasses.replace(
        query,
        select=[
            _walk_term(clause)
            for clause in query.select
        ],
        where=[
            _walk_term(clause)
            for clause in query.where
        ]
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
