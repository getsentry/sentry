import pytest
from django.test import override_settings
from sentry_relay.processing import is_glob_match, validate_rule_condition

from sentry.ingest.inbound_filters import (
    ACTIVE_GENERIC_FILTERS,
    CUSTOM_INBOUND_FILTER_ID_PREFIX,
    InboundFilterFeatures,
    _chunk_load_error_filter,
    _custom_error_filter,
    _error_message_condition,
    get_custom_inbound_filter_generic_filters,
    get_generic_filters,
)
from sentry.models.project import Project
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.utils import json

CUSTOM_PATTERNS: list[tuple[str | None, str | None]] = [
    ("MyError", "Something went wrong *"),
    (None, "*known flaky test*"),
]


def exception_matches_filters(
    exc_type: str,
    exc_message: str,
    patterns: list[tuple[str | None, str | None]],
) -> bool:
    """Same matching rules as _error_message_condition / Relay generic filters."""
    for type_pattern, message_pattern in patterns:
        if type_pattern is not None and not is_glob_match(exc_type, type_pattern):
            continue
        if message_pattern is not None and not is_glob_match(exc_message, message_pattern):
            continue
        return True
    return False


def message_matches_filters(
    message: str,
    patterns: list[tuple[str | None, str | None]],
) -> bool:
    """Matching rules for logentry messages: only type-less patterns apply."""
    for type_pattern, message_pattern in patterns:
        if type_pattern is not None or message_pattern is None:
            continue
        if is_glob_match(message, message_pattern):
            return True
    return False


def test_custom_error_filter_empty() -> None:
    # With no custom values configured, the filter is a no-op and must be omitted from
    # the Relay config entirely rather than emitting an empty condition.
    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=[]):
        condition = _custom_error_filter()

    assert condition is None
    assert not exception_matches_filters("MyError", "Something went wrong in checkout", [])


def test_custom_error_filter_builds_one_rule_per_pattern() -> None:
    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=CUSTOM_PATTERNS):
        condition = _custom_error_filter()

    # The custom filter matches exceptions AND messages: the exception branch iterates
    # over event.exception.values, while type-less patterns also glob the logentry message.
    assert condition == {
        "op": "or",
        "inner": [
            {
                "op": "any",
                "name": "event.exception.values",
                "inner": {
                    "op": "or",
                    "inner": [
                        {
                            "op": "and",
                            "inner": [
                                {"op": "glob", "name": "ty", "value": ["MyError"]},
                                {
                                    "op": "glob",
                                    "name": "value",
                                    "value": ["Something went wrong *"],
                                },
                            ],
                        },
                        {"op": "glob", "name": "value", "value": ["*known flaky test*"]},
                    ],
                },
            },
            {
                "op": "glob",
                "name": "event.logentry.formatted",
                "value": ["*known flaky test*"],
            },
        ],
    }


def test_custom_error_filter_exception_only_patterns_omit_logentry_branch() -> None:
    # Without any type-less pattern there is nothing that can match a message, so the
    # filter collapses back to the plain exception condition.
    with override_settings(
        SENTRY_INBOUND_FILTER_CUSTOM_VALUES=[("MyError", "Something went wrong *")]
    ):
        condition = _custom_error_filter()

    assert condition == {
        "op": "any",
        "name": "event.exception.values",
        "inner": {
            "op": "or",
            "inner": [
                {
                    "op": "and",
                    "inner": [
                        {"op": "glob", "name": "ty", "value": ["MyError"]},
                        {"op": "glob", "name": "value", "value": ["Something went wrong *"]},
                    ],
                },
            ],
        },
    }


def test_chunk_load_filter_unchanged_by_logentry_matching() -> None:
    # Built-in filters must not gain message matching: they keep the exception-only shape.
    condition = _chunk_load_error_filter()

    # An "any" top level (rather than the "or" wrapper) means there is no logentry branch.
    assert condition["op"] == "any"
    assert "event.logentry.formatted" not in repr(condition)


def test_error_message_condition_logentry_disabled_by_default() -> None:
    # The logentry branch is opt-in; the default keeps the historical exception-only shape.
    condition = _error_message_condition([(None, "*known flaky test*")])

    assert condition == {
        "op": "any",
        "name": "event.exception.values",
        "inner": {
            "op": "or",
            "inner": [{"op": "glob", "name": "value", "value": ["*known flaky test*"]}],
        },
    }


@django_db_all
def test_custom_error_filter_omitted_without_custom_values(default_project: Project) -> None:
    # The option is enabled by default for all projects, but with no configured custom
    # values the filter must not appear in the Relay config (no empty no-op condition).
    assert default_project.get_option("filters:custom-error") == "1"

    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=[]):
        generic_filters = get_generic_filters(default_project, InboundFilterFeatures())

    # Other default filters keep the config non-empty; only custom-error is omitted.
    assert generic_filters is not None
    filter_ids = {f["id"] for f in generic_filters["filters"]}
    assert "custom-error" not in filter_ids


@django_db_all
def test_custom_error_filter_emitted_with_custom_values(default_project: Project) -> None:
    assert default_project.get_option("filters:custom-error") == "1"

    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=CUSTOM_PATTERNS):
        generic_filters = get_generic_filters(default_project, InboundFilterFeatures())

    assert generic_filters is not None
    filter_ids = {f["id"] for f in generic_filters["filters"]}
    assert "custom-error" in filter_ids


@pytest.mark.parametrize(
    ("exc_type", "exc_message", "expected"),
    [
        ("MyError", "Something went wrong in checkout", True),
        ("MyError", "Unexpected failure", False),
        ("Error", "This is a known flaky test timeout", True),
        ("OtherError", "Something went wrong in checkout", False),
    ],
)
def test_custom_error_filter_matches_concrete_messages(
    exc_type: str, exc_message: str, expected: bool
) -> None:
    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=CUSTOM_PATTERNS):
        _custom_error_filter()

    assert exception_matches_filters(exc_type, exc_message, CUSTOM_PATTERNS) is expected


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        # Type-less pattern matches a plain message (capture_message) event.
        ("This is a known flaky test timeout", True),
        ("Something else entirely", False),
        # Patterns that carry an exception type cannot match a type-less message.
        ("Something went wrong in checkout", False),
    ],
)
def test_custom_error_filter_matches_concrete_messages_via_logentry(
    message: str, expected: bool
) -> None:
    with override_settings(SENTRY_INBOUND_FILTER_CUSTOM_VALUES=CUSTOM_PATTERNS):
        _custom_error_filter()

    assert message_matches_filters(message, CUSTOM_PATTERNS) is expected


def assert_relay_accepts_condition(condition: object) -> None:
    # Raises if Relay's actual rule parser considers the condition invalid or
    # unsupported, so these tests verify more than the expected dict shape.
    validate_rule_condition(json.dumps(condition))


def error_message_rule_condition(values: list[str]) -> dict:
    return {
        "op": "or",
        "inner": [
            {
                "op": "any",
                "name": "event.exception.values",
                "inner": {
                    "op": "or",
                    "inner": [
                        {"op": "glob", "name": "ty", "value": values},
                        {"op": "glob", "name": "value", "value": values},
                    ],
                },
            },
            {"op": "glob", "name": "event.logentry.formatted", "value": values},
        ],
    }


@django_db_all
@pytest.mark.parametrize(
    ("conditions", "expected_condition"),
    [
        pytest.param(
            [
                {"type": "error_message", "value": ["*ConnectionError*"]},
                {"type": "release", "value": ["1.*", "2.*"]},
            ],
            {
                "op": "and",
                "inner": [
                    error_message_rule_condition(["*ConnectionError*"]),
                    {"op": "glob", "name": "event.release", "value": ["1.*", "2.*"]},
                ],
            },
            id="error_message_and_release",
        ),
        pytest.param(
            [
                {"type": "log_message", "value": ["*DEBUG*"]},
                {"type": "release", "value": ["1.2.3"]},
            ],
            {
                "op": "and",
                "inner": [
                    {"op": "glob", "name": "log.body", "value": ["*DEBUG*"]},
                    {
                        "op": "glob",
                        "name": "log.attributes.sentry.release.value",
                        "value": ["1.2.3"],
                    },
                ],
            },
            id="log_message_and_release",
        ),
        pytest.param(
            [
                {"type": "metric_name", "value": ["checkout.*"]},
                {"type": "release", "value": ["1.2.3"]},
            ],
            {
                "op": "and",
                "inner": [
                    {"op": "glob", "name": "trace_metric.name", "value": ["checkout.*"]},
                    {
                        "op": "glob",
                        "name": "trace_metric.attributes.sentry.release.value",
                        "value": ["1.2.3"],
                    },
                ],
            },
            id="metric_name_and_release",
        ),
        pytest.param(
            [{"type": "metric_name", "value": ["checkout.*"]}],
            {"op": "glob", "name": "trace_metric.name", "value": ["checkout.*"]},
            id="single_condition_is_not_wrapped",
        ),
        pytest.param(
            [{"type": "release", "value": ["1.*"]}],
            {"op": "glob", "name": "event.release", "value": ["1.*"]},
            id="release_only_targets_events",
        ),
    ],
)
def test_custom_inbound_filter_condition_translation(
    default_project, factories, conditions, expected_condition
) -> None:
    custom_filter = factories.create_project_custom_inbound_filter(
        default_project, conditions=conditions
    )

    [generic_filter] = get_custom_inbound_filter_generic_filters(default_project)
    assert generic_filter == {
        "id": f"cif-{custom_filter.id}",
        "isEnabled": True,
        "condition": expected_condition,
    }
    assert_relay_accepts_condition(generic_filter["condition"])


@django_db_all
def test_custom_inbound_filter_row_becomes_relay_config(default_project, factories) -> None:
    # Golden test for the whole path: a stored filter row in, the exact generic filters
    # config Relay receives out. Spelled out literally so a change in the emitted JSON
    # has to be made deliberately here.
    for builtin_filter_id, _ in ACTIVE_GENERIC_FILTERS:
        default_project.update_option(f"filters:{builtin_filter_id}", "0")

    custom_filter = factories.create_project_custom_inbound_filter(
        default_project,
        conditions=[
            {"type": "error_message", "value": ["*ConnectionError*", "Timeout*"]},
            {"type": "release", "value": ["1.*"]},
        ],
    )

    generic_filters = get_generic_filters(
        default_project,
        InboundFilterFeatures(custom_inbound_filters=True, custom_inbound_filters_v2=True),
    )

    assert generic_filters == {
        "version": 1,
        "filters": [
            {
                "id": f"cif-{custom_filter.id}",
                "isEnabled": True,
                "condition": {
                    "op": "and",
                    "inner": [
                        {
                            "op": "or",
                            "inner": [
                                {
                                    "op": "any",
                                    "name": "event.exception.values",
                                    "inner": {
                                        "op": "or",
                                        "inner": [
                                            {
                                                "op": "glob",
                                                "name": "ty",
                                                "value": ["*ConnectionError*"],
                                            },
                                            {"op": "glob", "name": "ty", "value": ["Timeout*"]},
                                            {
                                                "op": "glob",
                                                "name": "value",
                                                "value": ["*ConnectionError*"],
                                            },
                                            {"op": "glob", "name": "value", "value": ["Timeout*"]},
                                        ],
                                    },
                                },
                                {
                                    "op": "glob",
                                    "name": "event.logentry.formatted",
                                    "value": ["*ConnectionError*"],
                                },
                                {
                                    "op": "glob",
                                    "name": "event.logentry.formatted",
                                    "value": ["Timeout*"],
                                },
                            ],
                        },
                        {"op": "glob", "name": "event.release", "value": ["1.*"]},
                    ],
                },
            }
        ],
    }
    assert_relay_accepts_condition(generic_filters["filters"][0]["condition"])


@django_db_all
def test_custom_inbound_filter_skips_inactive_filters(default_project, factories) -> None:
    factories.create_project_custom_inbound_filter(
        default_project,
        active=False,
        conditions=[{"type": "release", "value": ["1.*"]}],
    )

    assert get_custom_inbound_filter_generic_filters(default_project) == []


@django_db_all
def test_custom_inbound_filter_skips_untranslatable_filters(default_project, factories) -> None:
    # A condition that cannot be translated must disable the whole filter: conditions
    # are combined with AND, so dropping just the broken condition would filter more
    # data than the user configured.
    factories.create_project_custom_inbound_filter(
        default_project,
        conditions=[
            {"type": "error_message", "value": ["*Error*"]},
            {"type": "unknown_type", "value": ["nope"]},
        ],
    )
    factories.create_project_custom_inbound_filter(
        default_project,
        conditions=[{"type": "release", "value": []}],
    )
    factories.create_project_custom_inbound_filter(default_project, conditions=[])
    valid_filter = factories.create_project_custom_inbound_filter(
        default_project,
        conditions=[{"type": "release", "value": ["1.*"]}],
    )

    [generic_filter] = get_custom_inbound_filter_generic_filters(default_project)
    assert generic_filter["id"] == f"cif-{valid_filter.id}"


@django_db_all
def test_custom_inbound_filters_are_ordered_by_id(default_project, factories) -> None:
    created = [
        factories.create_project_custom_inbound_filter(
            default_project,
            conditions=[{"type": "release", "value": [f"{version}.*"]}],
        )
        for version in (1, 2, 3)
    ]

    generic_filters = get_custom_inbound_filter_generic_filters(default_project)
    assert [generic_filter["id"] for generic_filter in generic_filters] == [
        f"cif-{custom_filter.id}" for custom_filter in created
    ]


@django_db_all
@pytest.mark.parametrize(
    ("filter_features", "expected_ids"),
    [
        pytest.param(InboundFilterFeatures(), [], id="no_features"),
        pytest.param(
            InboundFilterFeatures(logs=True, metrics=True),
            [],
            id="inner_features_without_the_outer_one",
        ),
        pytest.param(
            InboundFilterFeatures(custom_inbound_filters=True),
            [],
            id="outer_feature_alone",
        ),
        pytest.param(
            InboundFilterFeatures(custom_inbound_filters=True, logs=True),
            ["log-message"],
            id="log_messages",
        ),
        pytest.param(
            InboundFilterFeatures(custom_inbound_filters=True, metrics=True),
            ["trace-metric-name"],
            id="trace_metric_names",
        ),
        pytest.param(
            InboundFilterFeatures(custom_inbound_filters=True, custom_inbound_filters_v2=True),
            ["cif"],
            id="custom_inbound_filters_v2",
        ),
        pytest.param(
            InboundFilterFeatures(True, True, True, True),
            ["log-message", "trace-metric-name", "cif"],
            id="every_feature",
        ),
    ],
)
def test_get_generic_filters_gates_each_source_on_its_feature(
    default_project, factories, filter_features, expected_ids
) -> None:
    for builtin_filter_id, _ in ACTIVE_GENERIC_FILTERS:
        default_project.update_option(f"filters:{builtin_filter_id}", "0")
    default_project.update_option("sentry:log_messages", ["some log"])
    default_project.update_option("sentry:trace_metric_names", ["some.metric"])
    custom_filter = factories.create_project_custom_inbound_filter(
        default_project, conditions=[{"type": "release", "value": ["1.*"]}]
    )

    generic_filters = get_generic_filters(default_project, filter_features)

    if not expected_ids:
        assert generic_filters is None
        return

    assert generic_filters is not None
    assert [f["id"] for f in generic_filters["filters"]] == [
        f"{CUSTOM_INBOUND_FILTER_ID_PREFIX}{custom_filter.id}" if id == "cif" else id
        for id in expected_ids
    ]


@django_db_all
def test_get_generic_filters_omits_gated_sources_without_configuration(default_project) -> None:
    for builtin_filter_id, _ in ACTIVE_GENERIC_FILTERS:
        default_project.update_option(f"filters:{builtin_filter_id}", "0")

    assert (
        get_generic_filters(default_project, InboundFilterFeatures(True, True, True, True)) is None
    )
