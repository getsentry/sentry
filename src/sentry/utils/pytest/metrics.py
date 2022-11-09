import dataclasses
import functools

import pytest

STRINGS_THAT_LOOK_LIKE_TAG_VALUES = (
    "",
    "staging",
    "value1",
    "prod",
    "exited",
    "myapp@2.0.0",
    "ahmed@12.2",
    "crashed",
    "init",
    "development",
)


@pytest.fixture(autouse=True)
def control_metrics_access(monkeypatch, request, set_sentry_option):
    from sentry.sentry_metrics import indexer
    from sentry.sentry_metrics.configuration import UseCaseKey
    from sentry.sentry_metrics.indexer.mock import MockIndexer
    from sentry.snuba import tasks
    from sentry.utils import snuba

    if "sentry_metrics" in {mark.name for mark in request.node.iter_markers()}:
        mock_indexer = MockIndexer()
        monkeypatch.setattr("sentry.sentry_metrics.indexer.backend", mock_indexer)
        monkeypatch.setattr("sentry.sentry_metrics.indexer.bulk_record", mock_indexer.bulk_record)
        monkeypatch.setattr("sentry.sentry_metrics.indexer.record", mock_indexer.record)
        monkeypatch.setattr("sentry.sentry_metrics.indexer.resolve", mock_indexer.resolve)
        monkeypatch.setattr(
            "sentry.sentry_metrics.indexer.reverse_resolve", mock_indexer.reverse_resolve
        )

        old_resolve = indexer.resolve

        def new_resolve(use_case_id, org_id, string):
            if (
                use_case_id == UseCaseKey.PERFORMANCE
                and string in STRINGS_THAT_LOOK_LIKE_TAG_VALUES
            ):
                pytest.fail(
                    f"stop right there, thief! you're about to resolve the string {string!r}. that looks like a tag value, but in this test mode, tag values are stored in clickhouse. the indexer might not have the value!"
                )
            return old_resolve(use_case_id, org_id, string)

        monkeypatch.setattr(indexer, "resolve", new_resolve)

        old_build_results = snuba._apply_cache_and_build_results

        def new_build_results(*args, **kwargs):
            if isinstance(args[0][0][0], dict):
                # We only support snql queries, and metrics only go through snql
                return old_build_results(*args, **kwargs)
            query = args[0][0][0].query
            is_performance_metrics = query.match.name.startswith("generic_metrics")
            is_metrics = "metrics" in query.match.name

            if is_performance_metrics:
                _validate_query(query, True)
            elif is_metrics:
                _validate_query(query, False)

            return old_build_results(*args, **kwargs)

        monkeypatch.setattr(snuba, "_apply_cache_and_build_results", new_build_results)

        old_create_snql_in_snuba = tasks._create_snql_in_snuba

        def new_create_snql_in_snuba(subscription, snuba_query, snql_query, entity_subscription):
            query = snql_query.query
            is_performance_metrics = query.match.name.startswith("generic_metrics")
            is_metrics = "metrics" in query.match.name

            if is_performance_metrics:
                _validate_query(query, True)
            elif is_metrics:
                _validate_query(query, False)

            return old_create_snql_in_snuba(
                subscription, snuba_query, snql_query, entity_subscription
            )

        monkeypatch.setattr(tasks, "_create_snql_in_snuba", new_create_snql_in_snuba)
        yield
    else:
        should_fail = False

        def fail(old_fn, *args, **kwargs):
            nonlocal should_fail
            should_fail = True
            return old_fn(*args, **kwargs)

        monkeypatch.setattr(indexer, "resolve", functools.partial(fail, indexer.resolve))
        monkeypatch.setattr(indexer, "bulk_record", functools.partial(fail, indexer.bulk_record))

        yield

        if should_fail:
            pytest.fail(
                "Your test accesses sentry metrics without declaring it in "
                "metadata. Add this to your testfile:\n\n"
                "pytestmark = pytest.mark.sentry_metrics"
            )


def _validate_query(query, tag_values_are_strings):
    def _walk(node):
        if isinstance(node, (tuple, list)):
            for subnode in node:
                _walk(subnode)
        elif dataclasses.is_dataclass(node):
            if tag_values_are_strings and getattr(node, "subscriptable", None) == "tags":
                raise ValueError(
                    "this node refers to tags[], even though tag values are strings in this test mode"
                )
            if not tag_values_are_strings and getattr(node, "subscriptable", None) == "tags_raw":
                raise ValueError(
                    "this node refers to tags_raw[], even though tag values are not strings in this test mode"
                )

            for field in dataclasses.fields(node):
                _walk(getattr(node, field.name))

    _walk(query)
