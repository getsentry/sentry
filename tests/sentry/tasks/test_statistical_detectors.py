import itertools
import uuid
from datetime import UTC, datetime, timedelta
from unittest import mock

import pytest
from django.db.models import F

from sentry.api.endpoints.project_performance_issue_settings import InternalProjectOptions
from sentry.issues.grouptype import (
    PerformanceP95EndpointRegressionGroupType,
    ProfileFunctionRegressionType,
)
from sentry.issues.occurrence_consumer import _process_message
from sentry.issues.producer import PayloadType
from sentry.issues.status_change_message import StatusChangeMessage
from sentry.models.group import GroupStatus
from sentry.models.options.project_option import ProjectOption
from sentry.models.project import Project
from sentry.models.statistical_detectors import (
    RegressionGroup,
    RegressionType,
    get_regression_groups,
)
from sentry.seer.breakpoints import BreakpointData
from sentry.snuba.discover import zerofill
from sentry.snuba.metrics.naming_layer.mri import TransactionMRI
from sentry.statistical_detectors.algorithm import MovingAverageDetectorState
from sentry.statistical_detectors.base import DetectorPayload, TrendType
from sentry.statistical_detectors.detector import TrendBundle, generate_fingerprint
from sentry.tasks.statistical_detectors import (
    EndpointRegressionDetector,
    FunctionRegressionDetector,
    detect_function_change_points,
    detect_function_trends,
    detect_transaction_change_points,
    detect_transaction_trends,
    emit_function_regression_issue,
    query_functions,
    query_transactions,
    query_transactions_timeseries,
    run_detection,
)
from sentry.testutils.cases import MetricsAPIBaseTestCase, ProfilesSnubaTestCase
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import before_now, freeze_time
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.types.group import GroupSubStatus
from sentry.utils.snuba import SnubaTSResult


@pytest.fixture
def timestamp():
    return datetime(2023, 8, 1, 12, 7, 42, 521000, tzinfo=UTC)


@pytest.fixture
def owner():
    return Factories.create_user()


@pytest.fixture
def organization(owner):
    return Factories.create_organization(owner=owner)


@pytest.fixture
def project(organization):
    return Factories.create_project(organization=organization)


@pytest.mark.parametrize(
    [
        "project_flags",
        "enable",
        "expected_performance_project",
        "expected_profiling_project",
    ],
    [
        pytest.param(None, False, False, False, id="disabled"),
        pytest.param(None, True, False, False, id="no projects"),
        pytest.param(None, True, False, False, id="no transactions"),
        pytest.param(None, True, False, False, id="no profiles"),
        pytest.param(
            Project.flags.has_transactions,
            True,
            True,
            False,
            id="performance only",
        ),
        pytest.param(Project.flags.has_profiles, True, False, True, id="profiling only"),
        pytest.param(
            Project.flags.has_transactions | Project.flags.has_profiles,
            True,
            True,
            True,
            id="performance + profiling",
        ),
    ],
)
@mock.patch("sentry.tasks.statistical_detectors.detect_transaction_trends")
@mock.patch("sentry.tasks.statistical_detectors.detect_function_trends")
@django_db_all
def test_run_detection_options(
    detect_function_trends,
    detect_transaction_trends,
    project_flags,
    enable,
    expected_performance_project,
    expected_profiling_project,
    project,
    timestamp,
):
    if project_flags is not None:
        project.update(flags=F("flags").bitor(project_flags))

    options = {
        "statistical_detectors.enable": enable,
    }

    with freeze_time(timestamp), override_options(options):
        run_detection()

    if expected_performance_project:
        assert detect_transaction_trends.apply_async.called
        detect_transaction_trends.apply_async.assert_has_calls(
            [mock.call(args=[[], [project.id], timestamp], countdown=0)]
        )
    else:
        assert not detect_transaction_trends.apply_async.called

    if expected_profiling_project:
        assert detect_function_trends.apply_async.called
        detect_function_trends.apply_async.assert_has_calls(
            [mock.call(args=[[project.id], timestamp], countdown=0)]
        )
    else:
        assert not detect_function_trends.apply_async.called


@mock.patch("sentry.tasks.statistical_detectors.detect_transaction_trends")
@mock.patch("sentry.tasks.statistical_detectors.detect_function_trends")
@mock.patch("sentry.tasks.statistical_detectors.PROJECTS_PER_BATCH", 5)
@django_db_all
def test_run_detection_options_multiple_batches(
    detect_function_trends,
    detect_transaction_trends,
    organization,
    timestamp,
):
    projects = []

    flags = Project.flags.has_transactions | Project.flags.has_profiles
    for _ in range(9):
        project = Factories.create_project(organization=organization)
        project.update(flags=F("flags").bitor(flags))
        projects.append(project)

    options = {
        "statistical_detectors.enable": True,
    }

    with freeze_time(timestamp), override_options(options):
        run_detection()

    # total of 9 projects, broken into batches of 5 means batch sizes of 5 + 4

    assert detect_transaction_trends.apply_async.called
    detect_transaction_trends.apply_async.assert_has_calls(
        [
            mock.call(
                args=[
                    [],
                    [project.id for project in projects[i : i + 5]],
                    timestamp,
                ],
                countdown=countdown,
            )
            for i, countdown in zip(range(0, len(projects), 5), itertools.count(start=0, step=17))
        ]
    )
    assert detect_function_trends.apply_async.called
    detect_function_trends.apply_async.assert_has_calls(
        [
            mock.call(
                args=[[project.id for project in projects[i : i + 5]], timestamp],
                countdown=countdown,
            )
            for i, countdown in zip(range(0, len(projects), 5), itertools.count(start=0, step=17))
        ]
    )


@pytest.mark.parametrize(
    ["task_enabled", "option_enabled"],
    [
        pytest.param(True, True, id="both enabled"),
        pytest.param(False, False, id="both disabled"),
        pytest.param(True, False, id="option disabled"),
        pytest.param(False, True, id="task disabled"),
    ],
)
@mock.patch("sentry.tasks.statistical_detectors.query_transactions")
@django_db_all
def test_detect_transaction_trends_options(
    query_transactions,
    task_enabled,
    option_enabled,
    timestamp,
    project,
):
    ProjectOption.objects.set_value(
        project=project,
        key="sentry:performance_issue_settings",
        value={InternalProjectOptions.TRANSACTION_DURATION_REGRESSION.value: option_enabled},
    )

    options = {
        "statistical_detectors.enable": task_enabled,
    }

    with override_options(options):
        detect_transaction_trends([project.organization_id], [project.id], timestamp)
    assert query_transactions.called == (task_enabled and option_enabled)


@pytest.mark.parametrize(
    ["task_enabled", "option_enabled"],
    [
        pytest.param(True, True, id="both enabled"),
        pytest.param(False, False, id="both disabled"),
        pytest.param(True, False, id="option disabled"),
        pytest.param(False, True, id="task disabled"),
    ],
)
@mock.patch("sentry.tasks.statistical_detectors.query_functions")
@django_db_all
def test_detect_function_trends_options(
    query_functions,
    task_enabled,
    option_enabled,
    timestamp,
    project,
):
    ProjectOption.objects.set_value(
        project=project,
        key="sentry:performance_issue_settings",
        value={InternalProjectOptions.FUNCTION_DURATION_REGRESSION.value: option_enabled},
    )

    options = {
        "statistical_detectors.enable": task_enabled,
    }

    with override_options(options):
        detect_function_trends([project.id], timestamp)
    assert query_functions.called == (task_enabled and option_enabled)


@mock.patch("sentry.snuba.functions.query")
@django_db_all
def test_detect_function_trends_query_timerange(functions_query, timestamp, project):
    options = {
        "statistical_detectors.enable": True,
    }

    with override_options(options):
        detect_function_trends([project.id], timestamp)

    assert functions_query.called
    params = functions_query.mock_calls[0].kwargs["snuba_params"]
    assert params.start == datetime(2023, 8, 1, 11, 0, tzinfo=UTC)
    assert params.end == datetime(2023, 8, 1, 11, 1, tzinfo=UTC)


@pytest.mark.parametrize(
    ["count", "should_emit"],
    [(100, True), (10, False)],
)
@mock.patch("sentry.tasks.statistical_detectors.query_transactions")
@mock.patch("sentry.tasks.statistical_detectors.detect_transaction_change_points")
@django_db_all
def test_detect_transaction_trends(
    detect_transaction_change_points,
    query_transactions,
    timestamp,
    project,
    count,
    should_emit,
):
    n = 50
    timestamps = [timestamp - timedelta(hours=n - i) for i in range(n)]

    query_transactions.side_effect = [
        [
            DetectorPayload(
                project_id=project.id,
                group="/123",
                fingerprint="/123",
                count=count,
                value=100 if i < n / 2 else 300,
                timestamp=ts,
            ),
        ]
        for i, ts in enumerate(timestamps)
    ]

    options = {
        "statistical_detectors.enable": True,
    }

    with override_options(options):
        for ts in timestamps:
            detect_transaction_trends([project.organization.id], [project.id], ts)

    if should_emit:
        assert detect_transaction_change_points.apply_async.called
    else:
        assert not detect_transaction_change_points.apply_async.called


@mock.patch("sentry.issues.status_change_message.uuid4", return_value=uuid.UUID(int=0))
@mock.patch("sentry.tasks.statistical_detectors.raw_snql_query")
@mock.patch("sentry.tasks.statistical_detectors.detect_transaction_change_points")
@mock.patch("sentry.statistical_detectors.detector.produce_occurrence_to_kafka")
@django_db_all
@pytest.mark.sentry_metrics
def test_detect_transaction_trends_auto_resolution(
    produce_occurrence_to_kafka,
    detect_transaction_change_points,
    raw_snql_query,
    mock_uuid4,
    timestamp,
    project,
):
    n = 150
    timestamps = [timestamp - timedelta(hours=n - i) for i in range(n)]

    raw_snql_query.side_effect = [
        {
            "data": [
                {
                    "project_id": project.id,
                    "transaction_name": "/123",
                    "count": 100,
                    "p95": 100 if i < 25 or i >= 50 else 300,
                },
            ],
        }
        for i, ts in enumerate(timestamps)
    ]

    options = {
        "statistical_detectors.enable": True,
    }

    with override_options(options):
        for ts in timestamps[:50]:
            detect_transaction_trends([project.organization.id], [project.id], ts)

    assert detect_transaction_change_points.apply_async.called

    with override_options(options):
        RegressionGroup.objects.create(
            type=RegressionType.ENDPOINT.value,
            date_regressed=timestamps[10],
            version=1,
            active=True,
            project_id=project.id,
            fingerprint=generate_fingerprint(RegressionType.ENDPOINT, "/123"),
            baseline=100,
            regressed=300,
        )
        for ts in timestamps[50:]:
            detect_transaction_trends([project.organization.id], [project.id], ts)

    status_change = StatusChangeMessage(
        fingerprint=[generate_fingerprint(RegressionType.ENDPOINT, "/123")],
        project_id=project.id,
        new_status=GroupStatus.RESOLVED,
        new_substatus=None,
    )
    produce_occurrence_to_kafka.assert_has_calls(
        [mock.call(payload_type=PayloadType.STATUS_CHANGE, status_change=status_change)]
    )


@pytest.mark.parametrize(
    ["ratelimit", "expected_calls"],
    [(-1, 3), (0, 0), (1, 1), (2, 2), (3, 3)],
)
@mock.patch("sentry.tasks.statistical_detectors.query_transactions")
@mock.patch("sentry.tasks.statistical_detectors.detect_transaction_change_points")
@django_db_all
def test_detect_transaction_trends_ratelimit(
    detect_transaction_change_points,
    query_transactions,
    ratelimit,
    expected_calls,
    timestamp,
    organization,
    project,
):
    n = 50
    timestamps = [timestamp - timedelta(hours=n - i) for i in range(n)]

    query_transactions.side_effect = [
        [
            DetectorPayload(
                project_id=project.id,
                group="/1",
                fingerprint="/1",
                count=100,
                value=100 if i < n / 2 else 301,
                timestamp=ts,
            ),
            DetectorPayload(
                project_id=project.id,
                group="/2",
                fingerprint="/2",
                count=100,
                value=100 if i < n / 2 else 302,
                timestamp=ts,
            ),
            DetectorPayload(
                project_id=project.id,
                group="/3",
                fingerprint="/3",
                count=100,
                value=100 if i < n / 2 else 303,
                timestamp=ts,
            ),
        ]
        for i, ts in enumerate(timestamps)
    ]

    options = {
        "statistical_detectors.enable": True,
        "statistical_detectors.ratelimit.ema": ratelimit,
    }

    with override_options(options):
        for ts in timestamps:
            detect_transaction_trends([project.organization.id], [project.id], ts)

    if expected_calls > 0:
        assert detect_transaction_change_points.apply_async.call_count == 1
        detect_transaction_change_points.apply_async.assert_has_calls(
            [
                mock.call(
                    args=[
                        [(project.id, "/1"), (project.id, "/2"), (project.id, "/3")][
                            -expected_calls:
                        ],
                        mock.ANY,
                    ],
                    countdown=12 * 60 * 60,
                ),
            ],
        )
    else:
        assert detect_transaction_change_points.apply_async.call_count == 0


@pytest.mark.parametrize(
    ["detector_cls"],
    [
        pytest.param(EndpointRegressionDetector, id="endpoint"),
        pytest.param(FunctionRegressionDetector, id="function"),
    ],
)
@pytest.mark.parametrize(
    ["ratelimit", "expected_idx"],
    [
        pytest.param(-1, 4, id="all"),
        pytest.param(0, 0, id="zero per project"),
        pytest.param(1, 2, id="one per project"),
        pytest.param(2, 3, id="two per project"),
        pytest.param(3, 4, id="three per project"),
    ],
)
def test_limit_regressions_by_project(detector_cls, ratelimit, timestamp, expected_idx):
    payloads = {
        (project_id, group): DetectorPayload(
            project_id=project_id,
            group=f"{project_id}_{group}",
            fingerprint=f"{project_id}_{group}",
            count=int(f"{project_id}_{group}"),
            value=int(f"{project_id}_{group}"),
            timestamp=timestamp,
        )
        for project_id in range(1, 4)
        for group in range(1, project_id + 1)
    }

    def trends():
        yield TrendBundle(TrendType.Skipped, 0, payloads[(1, 1)])
        yield TrendBundle(TrendType.Improved, 0, payloads[(2, 1)])
        yield TrendBundle(TrendType.Regressed, 0, payloads[(2, 2)])
        yield TrendBundle(TrendType.Regressed, 0, payloads[(3, 1)])
        yield TrendBundle(TrendType.Regressed, 1, payloads[(3, 2)])
        yield TrendBundle(TrendType.Regressed, 2, payloads[(3, 3)])

    expected_regressions = [
        TrendBundle(TrendType.Regressed, 0, payloads[(2, 2)]),
        TrendBundle(TrendType.Regressed, 2, payloads[(3, 3)]),
        TrendBundle(TrendType.Regressed, 1, payloads[(3, 2)]),
        TrendBundle(TrendType.Regressed, 0, payloads[(3, 1)]),
    ][:expected_idx]
    regressions = detector_cls.limit_regressions_by_project(trends(), ratelimit)
    assert set(regressions) == set(expected_regressions)


@pytest.mark.parametrize(
    ["detector_cls"],
    [
        pytest.param(EndpointRegressionDetector, id="endpoint"),
        pytest.param(FunctionRegressionDetector, id="function"),
    ],
)
@pytest.mark.parametrize(
    ["regression_groups", "expected_versions"],
    [
        pytest.param([], [0], id="no existing"),
        pytest.param(
            [
                (1, False, "1"),
                (2, False, "1"),
            ],
            [2],
            id="existing inactive",
        ),
        pytest.param(
            [
                (1, False, "1"),
                (2, True, "1"),
            ],
            [None],
            id="existing active",
        ),
        pytest.param(
            [
                (1, False, "1"),
                (2, False, "1"),
                (1, False, "2"),
                (2, False, "2"),
                (3, False, "2"),
                (4, True, "2"),
            ],
            [2, None],
            id="mixed active and inactive",
        ),
        pytest.param(
            [
                (1, True, "1"),
                (2, False, "1"),
            ],
            [2],
            id="use latest version",
        ),
    ],
)
@django_db_all
def test_get_regression_versions(
    detector_cls,
    regression_groups,
    expected_versions,
    project,
    timestamp,
):
    if regression_groups:
        RegressionGroup.objects.bulk_create(
            RegressionGroup(
                type=detector_cls.regression_type.value,
                date_regressed=timestamp,
                version=version,
                active=active,
                project_id=project.id,
                fingerprint=generate_fingerprint(
                    detector_cls.regression_type,
                    transaction,
                ),
                baseline=100000000.0,
                regressed=500000000.0,
            )
            for version, active, transaction in regression_groups
        )

    breakpoints: list[BreakpointData] = [
        {
            "absolute_percentage_change": 5.0,
            "aggregate_range_1": 100000000.0,
            "aggregate_range_2": 500000000.0,
            "breakpoint": 1687323600,
            "project": str(project.id),
            "transaction": "1",
            "trend_difference": 400000000.0,
            "trend_percentage": 5.0,
            "unweighted_p_value": 0.0,
            "unweighted_t_value": -float("inf"),
        }
    ]

    def mock_regressions():
        yield from breakpoints

    regressions = list(detector_cls.get_regression_versions(mock_regressions()))

    assert regressions == [
        (expected_version, None if expected_version == 0 else timestamp, breakpoints[i])
        for i, expected_version in enumerate(expected_versions)
        if expected_version is not None
    ]


@pytest.mark.parametrize(
    ["detector_cls", "object_name", "issue_type"],
    [
        pytest.param(
            EndpointRegressionDetector,
            "transaction_1",
            PerformanceP95EndpointRegressionGroupType,
            id="endpoint",
        ),
        pytest.param(
            FunctionRegressionDetector,
            123,
            ProfileFunctionRegressionType,
            id="function",
        ),
    ],
)
@pytest.mark.parametrize(
    ["status", "substatus", "should_emit"],
    [
        pytest.param(GroupStatus.UNRESOLVED, GroupSubStatus.ESCALATING, False, id="escalating"),
        pytest.param(GroupStatus.UNRESOLVED, GroupSubStatus.ONGOING, False, id="ongoing"),
        pytest.param(GroupStatus.UNRESOLVED, GroupSubStatus.REGRESSED, False, id="regressed"),
        pytest.param(GroupStatus.UNRESOLVED, GroupSubStatus.NEW, False, id="new"),
        pytest.param(GroupStatus.RESOLVED, None, True, id="resolved"),
        pytest.param(
            GroupStatus.IGNORED, GroupSubStatus.UNTIL_ESCALATING, False, id="until escalating"
        ),
        pytest.param(
            GroupStatus.IGNORED, GroupSubStatus.UNTIL_CONDITION_MET, False, id="until condition met"
        ),
        pytest.param(GroupStatus.IGNORED, GroupSubStatus.FOREVER, False, id="forever"),
    ],
)
@django_db_all
def test_get_regression_versions_active(
    detector_cls,
    object_name,
    issue_type,
    status,
    substatus,
    should_emit,
    project,
    timestamp,
    django_cache,  # the environment can persist in the cache otherwise
):
    fingerprint = generate_fingerprint(detector_cls.regression_type, object_name)

    RegressionGroup.objects.create(
        type=detector_cls.regression_type.value,
        date_regressed=timestamp,
        version=1,
        active=True,
        project_id=project.id,
        fingerprint=fingerprint,
        baseline=1000,
        regressed=2000,
    )

    event_id = uuid.uuid4().hex
    message = {
        "id": uuid.uuid4().hex,
        "project_id": project.id,
        "event_id": event_id,
        "fingerprint": [fingerprint],
        "issue_title": issue_type.description,
        "subtitle": "",
        "resource_id": None,
        "evidence_data": {},
        "evidence_display": [],
        "type": issue_type.type_id,
        "detection_time": timestamp.isoformat(),
        "level": "info",
        "culprit": "",
        "payload_type": PayloadType.OCCURRENCE.value,
        "event": {
            "timestamp": timestamp.isoformat(),
            "project_id": project.id,
            "transaction": "",
            "event_id": event_id,
            "platform": "python",
            "received": timestamp.isoformat(),
            "tags": {},
        },
    }

    result = _process_message(message)
    assert result is not None
    _, group_info = result
    assert group_info is not None
    group = group_info.group
    group.status = status
    group.substatus = substatus
    group.save()

    breakpoints: list[BreakpointData] = [
        {
            "absolute_percentage_change": 5.0,
            "aggregate_range_1": 100000000.0,
            "aggregate_range_2": 500000000.0,
            "breakpoint": 1687323600,
            "project": str(project.id),
            "transaction": object_name,
            "trend_difference": 400000000.0,
            "trend_percentage": 5.0,
            "unweighted_p_value": 0.0,
            "unweighted_t_value": -float("inf"),
        }
    ]

    def mock_regressions():
        yield from breakpoints

    regressions = list(detector_cls.get_regression_versions(mock_regressions()))

    if should_emit:
        assert regressions == [(1, timestamp, breakpoints[0])]
    else:
        assert regressions == []


@pytest.mark.parametrize(
    ["count", "should_emit"],
    [(100, True), (10, False)],
)
@mock.patch("sentry.tasks.statistical_detectors.query_functions")
@mock.patch("sentry.tasks.statistical_detectors.detect_function_change_points")
@django_db_all
def test_detect_function_trends(
    detect_function_change_points,
    query_functions,
    timestamp,
    project,
    count,
    should_emit,
):
    n = 50
    timestamps = [timestamp - timedelta(hours=n - i) for i in range(n)]

    query_functions.side_effect = [
        [
            DetectorPayload(
                project_id=project.id,
                group=123,
                fingerprint=f"{123:x}",
                count=count,
                value=100 if i < n / 2 else 300,
                timestamp=ts,
            ),
        ]
        for i, ts in enumerate(timestamps)
    ]

    options = {
        "statistical_detectors.enable": True,
    }

    with override_options(options):
        for ts in timestamps:
            detect_function_trends([project.id], ts)

    if should_emit:
        assert detect_function_change_points.apply_async.called
    else:
        assert not detect_function_change_points.apply_async.called


@mock.patch("sentry.tasks.statistical_detectors.functions.query")
@mock.patch("sentry.tasks.statistical_detectors.detect_function_change_points")
@mock.patch("sentry.statistical_detectors.detector.produce_occurrence_to_kafka")
@django_db_all
def test_detect_function_trends_auto_resolution(
    produce_occurrence_to_kafka,
    detect_function_change_points,
    functions_query,
    timestamp,
    project,
):
    n = 150
    timestamps = [timestamp - timedelta(hours=n - i) for i in range(n)]

    functions_query.side_effect = [
        {
            "data": [
                {
                    "project.id": project.id,
                    "fingerprint": 123,
                    "count()": 100,
                    "p95()": 100 if i < 25 or i >= 50 else 300,
                    "timestamp": ts.isoformat(),
                },
            ],
        }
        for i, ts in enumerate(timestamps)
    ]

    options = {
        "statistical_detectors.enable": True,
    }

    with override_options(options):
        for ts in timestamps[:50]:
            detect_function_trends([project.id], ts)

    assert detect_function_change_points.apply_async.called

    with override_options(options):
        RegressionGroup.objects.create(
            type=RegressionType.FUNCTION.value,
            date_regressed=timestamps[10],
            version=1,
            active=True,
            project_id=project.id,
            fingerprint=f"{123:x}",
            baseline=100,
            regressed=300,
        )
        for ts in timestamps[50:]:
            detect_function_trends([project.id], ts)

    assert produce_occurrence_to_kafka.called


@pytest.mark.parametrize(
    ["ratelimit", "expected_calls"],
    [(-1, 3), (0, 0), (1, 1), (2, 2), (3, 3)],
)
@mock.patch("sentry.tasks.statistical_detectors.query_functions")
@mock.patch("sentry.tasks.statistical_detectors.detect_function_change_points")
@django_db_all
def test_detect_function_trends_ratelimit(
    detect_function_change_points,
    query_functions,
    ratelimit,
    expected_calls,
    timestamp,
    project,
):
    n = 50
    timestamps = [timestamp - timedelta(hours=n - i) for i in range(n)]

    query_functions.side_effect = [
        [
            DetectorPayload(
                project_id=project.id,
                group=1,
                fingerprint=f"{1:x}",
                count=100,
                value=100 if i < n / 2 else 301,
                timestamp=ts,
            ),
            DetectorPayload(
                project_id=project.id,
                group=2,
                fingerprint=f"{2:x}",
                count=100,
                value=100 if i < n / 2 else 302,
                timestamp=ts,
            ),
            DetectorPayload(
                project_id=project.id,
                group=3,
                fingerprint=f"{3:x}",
                count=100,
                value=100 if i < n / 2 else 303,
                timestamp=ts,
            ),
        ]
        for i, ts in enumerate(timestamps)
    ]

    options = {
        "statistical_detectors.enable": True,
        "statistical_detectors.ratelimit.ema": ratelimit,
    }

    with override_options(options):
        for ts in timestamps:
            detect_function_trends([project.id], ts)

    if expected_calls > 0:
        assert detect_function_change_points.apply_async.call_count == 1
        detect_function_change_points.apply_async.assert_has_calls(
            [
                mock.call(
                    args=[
                        [(project.id, 1), (project.id, 2), (project.id, 3)][-expected_calls:],
                        mock.ANY,
                    ],
                    countdown=12 * 60 * 60,
                ),
            ],
        )
    else:
        assert detect_function_change_points.apply_async.call_count == 0


@mock.patch("sentry.tasks.statistical_detectors.emit_function_regression_issue")
@mock.patch("sentry.statistical_detectors.detector.detect_breakpoints")
@mock.patch("sentry.search.events.builder.base.raw_snql_query")
@django_db_all
def test_detect_function_change_points(
    mock_raw_snql_query,
    mock_detect_breakpoints,
    mock_emit_function_regression_issue,
    timestamp,
    project,
):
    start_of_hour = timestamp.replace(minute=0, second=0, microsecond=0)

    fingerprint = 12345

    mock_raw_snql_query.return_value = {
        "data": [
            {
                "time": (start_of_hour - timedelta(days=day, hours=hour)).isoformat(),
                "project.id": project.id,
                "fingerprint": fingerprint,
                "p95": 2 if day < 1 and hour < 8 else 1,
            }
            for day in reversed(range(14))
            for hour in reversed(range(24))
        ],
        "meta": [
            {"name": "time", "type": "DateTime"},
            {"name": "project.id", "type": "UInt64"},
            {"name": "fingerprint", "type": "UInt32"},
            {"name": "p95", "type": "Float64"},
        ],
    }

    mock_detect_breakpoints.return_value = {
        "data": [
            {
                "absolute_percentage_change": 5.0,
                "aggregate_range_1": 100000000.0,
                "aggregate_range_2": 500000000.0,
                "breakpoint": 1687323600,
                "change": "regression",
                "project": str(project.id),
                "transaction": str(fingerprint),
                "trend_difference": 400000000.0,
                "trend_percentage": 5.0,
                "unweighted_p_value": 0.0,
                "unweighted_t_value": -float("inf"),
            },
        ]
    }

    options = {
        "statistical_detectors.enable": True,
    }

    with override_options(options):
        detect_function_change_points([(project.id, fingerprint)], timestamp)
    assert mock_emit_function_regression_issue.called


@pytest.mark.parametrize(
    ["detector_cls", "object_name"],
    [
        pytest.param(
            EndpointRegressionDetector,
            "transaction_1",
            id="endpoint",
        ),
        pytest.param(
            FunctionRegressionDetector,
            "123",
            id="function",
        ),
    ],
)
@mock.patch("sentry.statistical_detectors.detector.produce_occurrence_to_kafka")
@django_db_all
def test_new_regression_group(
    produce_occurrence_to_kafka,
    detector_cls,
    object_name,
    project,
    timestamp,
):
    def get_regressions(ts):
        yield {
            "project": str(project.id),
            "transaction": object_name,
            "aggregate_range_1": 100,
            "aggregate_range_2": 200,
            "unweighted_t_value": 1.23,
            "unweighted_p_value": 1.23,
            "trend_percentage": 1.23,
            "absolute_percentage_change": 1.23,
            "trend_difference": 1.23,
            "breakpoint": (ts - timedelta(days=1)).timestamp(),
        }

    regressions = get_regressions(timestamp)
    regressions = detector_cls.save_regressions_with_versions(regressions)
    assert len(list(regressions)) == 1  # indicates we should've saved 1 regression group

    regression_groups = get_regression_groups(
        detector_cls.regression_type,
        [(project.id, generate_fingerprint(detector_cls.regression_type, object_name))],
        active=True,
    )
    assert len(regression_groups) == 1  # confirm the regression group was saved

    def get_trends(ts):
        payload = DetectorPayload(
            project_id=project.id,
            group=object_name,
            fingerprint="",  # this fingerprint isn't used so leave it blank
            count=100,
            value=100,
            timestamp=ts - timedelta(hours=1),
        )
        state = MovingAverageDetectorState(
            timestamp=ts - timedelta(hours=1),
            count=100,
            moving_avg_short=100,
            moving_avg_long=100,
        )
        yield TrendBundle(
            type=TrendType.Unchanged,
            score=1,
            payload=payload,
            state=state,
        )

    # there is a buffer on auto resolution, so in the first 24 hours
    # after the regression is detected, we will not auto resolve the issue
    for hours in reversed(range(1, 24)):
        ts = timestamp - timedelta(hours=hours)
        trends = get_trends(ts)
        trends = detector_cls.get_regression_groups(trends)
        trends = detector_cls.redirect_resolutions(trends, ts)
        assert len(list(trends)) == 1
        assert not produce_occurrence_to_kafka.called

    # once the buffer period is over, we allow auto resolution again
    trends = get_trends(timestamp)
    trends = detector_cls.get_regression_groups(trends)
    trends = detector_cls.redirect_resolutions(trends, timestamp)
    assert len(list(trends)) == 0  # should resolve, so it is redirected, thus 0
    assert produce_occurrence_to_kafka.called


@pytest.mark.parametrize(
    ["detector_cls", "object_name"],
    [
        pytest.param(
            EndpointRegressionDetector,
            "transaction_1",
            id="endpoint",
        ),
        pytest.param(
            FunctionRegressionDetector,
            "123",
            id="function",
        ),
    ],
)
@django_db_all
def test_save_regressions_with_versions(
    detector_cls,
    object_name,
    project,
    timestamp,
):
    RegressionGroup.objects.create(
        type=detector_cls.regression_type.value,
        date_regressed=timestamp,
        version=1,
        active=False,
        project_id=project.id,
        fingerprint=generate_fingerprint(detector_cls.regression_type, object_name),
        baseline=100,
        regressed=300,
    )

    def get_regressions(ts):
        yield {
            "project": str(project.id),
            "transaction": object_name,
            "aggregate_range_1": 100,
            "aggregate_range_2": 200,
            "unweighted_t_value": 1.23,
            "unweighted_p_value": 1.23,
            "trend_percentage": 1.23,
            "absolute_percentage_change": 1.23,
            "trend_difference": 1.23,
            "breakpoint": ts.timestamp(),
        }

    # there is a buffer on issue creation, so in the first 24 hours
    # after the first regression is detected, we will not regress the issue
    for hours in range(1, 24):
        regressions = get_regressions(timestamp + timedelta(hours=hours))
        regressions = detector_cls.save_regressions_with_versions(regressions)
        assert len(list(regressions)) == 0

    # once the buffer period is over, we allow regressions again
    regressions = get_regressions(timestamp + timedelta(hours=24))
    regressions = detector_cls.save_regressions_with_versions(regressions)
    assert len(list(regressions)) == 1


@pytest.mark.parametrize(
    ["detector_cls", "object_name", "baseline", "regressed", "escalated", "issue_type"],
    [
        pytest.param(
            EndpointRegressionDetector,
            "transaction_1",
            100,
            300,
            500,
            PerformanceP95EndpointRegressionGroupType,
            id="endpoint",
        ),
        pytest.param(
            FunctionRegressionDetector,
            123,
            100_000_000,
            300_000_000,
            500_000_000,
            ProfileFunctionRegressionType,
            id="function",
        ),
    ],
)
@pytest.mark.parametrize(
    ["status", "substatus", "should_escalate"],
    [
        pytest.param(GroupStatus.UNRESOLVED, GroupSubStatus.ESCALATING, False, id="escalating"),
        pytest.param(GroupStatus.UNRESOLVED, GroupSubStatus.ONGOING, True, id="ongoing"),
        pytest.param(GroupStatus.UNRESOLVED, GroupSubStatus.REGRESSED, False, id="regressed"),
        pytest.param(GroupStatus.UNRESOLVED, GroupSubStatus.NEW, False, id="new"),
        pytest.param(GroupStatus.RESOLVED, None, False, id="resolved"),
        pytest.param(
            GroupStatus.IGNORED, GroupSubStatus.UNTIL_ESCALATING, True, id="until escalating"
        ),
        pytest.param(
            GroupStatus.IGNORED, GroupSubStatus.UNTIL_CONDITION_MET, False, id="until condition met"
        ),
        pytest.param(GroupStatus.IGNORED, GroupSubStatus.FOREVER, False, id="forever"),
    ],
)
@mock.patch("sentry.issues.status_change_message.uuid4", return_value=uuid.UUID(int=0))
@mock.patch("sentry.statistical_detectors.detector.produce_occurrence_to_kafka")
@django_db_all
def test_redirect_escalations(
    produce_occurrence_to_kafka,
    mock_uuid4,
    detector_cls,
    object_name,
    baseline,
    regressed,
    escalated,
    issue_type,
    status,
    substatus,
    should_escalate,
    project,
    timestamp,
    django_cache,  # the environment can persist in the cache otherwise
):
    fingerprint = generate_fingerprint(detector_cls.regression_type, object_name)

    RegressionGroup.objects.create(
        type=detector_cls.regression_type.value,
        date_regressed=timestamp - timedelta(days=1),
        version=1,
        active=True,
        project_id=project.id,
        fingerprint=fingerprint,
        baseline=baseline,
        regressed=regressed,
    )

    event_id = uuid.uuid4().hex
    message = {
        "id": uuid.uuid4().hex,
        "project_id": project.id,
        "event_id": event_id,
        "fingerprint": [fingerprint],
        "issue_title": issue_type.description,
        "subtitle": "",
        "resource_id": None,
        "evidence_data": {},
        "evidence_display": [],
        "type": issue_type.type_id,
        "detection_time": timestamp.isoformat(),
        "level": "info",
        "culprit": "",
        "payload_type": PayloadType.OCCURRENCE.value,
        "event": {
            "timestamp": timestamp.isoformat(),
            "project_id": project.id,
            "transaction": "",
            "event_id": event_id,
            "platform": "python",
            "received": timestamp.isoformat(),
            "tags": {},
        },
    }

    result = _process_message(message)
    assert result is not None
    _, group_info = result
    assert group_info is not None
    group = group_info.group
    group.status = status
    group.substatus = substatus
    group.save()

    def get_trends(ts):
        payload = DetectorPayload(
            project_id=project.id,
            group=object_name,
            fingerprint="",  # this fingerprint isn't used so leave it blank
            count=100,
            value=escalated,
            timestamp=ts - timedelta(hours=1),
        )
        state = MovingAverageDetectorState(
            timestamp=ts - timedelta(hours=1),
            count=100,
            moving_avg_short=escalated,
            moving_avg_long=escalated,
        )
        yield TrendBundle(
            type=TrendType.Unchanged,
            score=1,
            payload=payload,
            state=state,
        )

    trends = get_trends(timestamp)
    trends = detector_cls.get_regression_groups(trends)
    trends = detector_cls.redirect_escalations(trends, timestamp)

    assert len(list(trends)) == 0

    if should_escalate:
        assert produce_occurrence_to_kafka.called
        status_change = StatusChangeMessage(
            fingerprint=[fingerprint],
            project_id=project.id,
            new_status=GroupStatus.UNRESOLVED,
            new_substatus=GroupSubStatus.ESCALATING,
        )
        produce_occurrence_to_kafka.assert_has_calls(
            [mock.call(payload_type=PayloadType.STATUS_CHANGE, status_change=status_change)]
        )

        # version 1 should be inactive now
        assert (
            RegressionGroup.objects.get(
                type=detector_cls.regression_type.value,
                version=1,
                project_id=project.id,
                fingerprint=fingerprint,
                active=False,
            )
            is not None
        )

        # version 2 should be created and active
        assert (
            RegressionGroup.objects.get(
                type=detector_cls.regression_type.value,
                version=2,
                project_id=project.id,
                fingerprint=fingerprint,
                active=True,
            )
            is not None
        )
    else:
        assert not produce_occurrence_to_kafka.called

        # version 1 should still be active
        assert (
            RegressionGroup.objects.get(
                type=detector_cls.regression_type.value,
                version=1,
                project_id=project.id,
                fingerprint=fingerprint,
                active=True,
            )
            is not None
        )

        # version 2 should not exist
        assert (
            RegressionGroup.objects.filter(
                type=detector_cls.regression_type.value,
                version=2,
                project_id=project.id,
                fingerprint=fingerprint,
            ).first()
            is None
        )


class FunctionsTasksTest(ProfilesSnubaTestCase):
    def setUp(self):
        super().setUp()

        self.now = before_now(minutes=10)
        self.hour_ago = (self.now - timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        self.projects = [
            self.create_project(organization=self.organization, teams=[self.team], name="Foo"),
            self.create_project(organization=self.organization, teams=[self.team], name="Bar"),
        ]

        self.transaction_functions = []
        self.continuous_functions = []

        for project in self.projects:
            stored = self.store_functions(
                [
                    {
                        "self_times_ns": [100_000_000 for _ in range(10)],
                        "package": "foo",
                        "function": "foo",
                        # only in app functions should
                        # appear in the results
                        "in_app": True,
                    },
                    {
                        # this function has a lower count, so `foo` is prioritized
                        "self_times_ns": [200_000_000 for _ in range(20)],
                        "package": "baz",
                        "function": "baz",
                        # only in app functions should
                        # appear in the results
                        "in_app": True,
                    },
                    {
                        "self_times_ns": [300_000_000 for _ in range(30)],
                        "package": "qux",
                        "function": "qux",
                        # non in app functions should not
                        # appear in the results
                        "in_app": False,
                    },
                ],
                project=project,
                timestamp=self.hour_ago,
            )
            self.transaction_functions.append(stored)

            stored = self.store_functions_chunk(
                [
                    {
                        "self_times_ns": [100_000_000 for _ in range(10)],
                        "package": "bar",
                        "function": "bar",
                        "thread_id": "1",
                        # only in app functions should
                        # appear in the results
                        "in_app": True,
                    },
                    {
                        "self_times_ns": [200_000_000 for _ in range(20)],
                        "package": "baz",
                        "function": "baz",
                        "thread_id": "2",
                        # only in app functions should
                        # appear in the results
                        "in_app": True,
                    },
                    {
                        "self_times_ns": [300_000_000 for _ in range(30)],
                        "package": "qux",
                        "function": "qux",
                        "thread_id": "3",
                        # non in app functions should not
                        # appear in the results
                        "in_app": False,
                    },
                ],
                project=project,
                timestamp=self.hour_ago,
            )
            self.continuous_functions.append(stored)

    @mock.patch("sentry.tasks.statistical_detectors.FUNCTIONS_PER_PROJECT", 1)
    def test_functions_query(self):
        results = query_functions(self.projects, self.now)
        fingerprint = self.function_fingerprint({"package": "baz", "function": "baz"})
        assert results == [
            DetectorPayload(
                project_id=project.id,
                group=fingerprint,
                fingerprint=f"{fingerprint:x}",
                count=40,
                value=pytest.approx(200_000_000),  # type: ignore[arg-type]
                timestamp=self.hour_ago,
            )
            for project in self.projects
        ]

    @mock.patch("sentry.tasks.statistical_detectors.get_from_profiling_service")
    def test_emit_function_regression_issue_transaction_function(
        self, mock_get_from_profiling_service
    ):
        mock_value = mock.MagicMock()
        mock_value.status = 200
        mock_value.data = b'{"occurrences":2}'
        mock_get_from_profiling_service.return_value = mock_value

        fingerprint = self.function_fingerprint({"package": "foo", "function": "foo"})
        breakpoint = int((self.hour_ago - timedelta(hours=12)).timestamp())

        regressions: list[BreakpointData] = [
            {
                "project": str(project.id),
                "transaction": str(fingerprint),
                "aggregate_range_1": 100_000_000,
                "aggregate_range_2": 200_000_000,
                "unweighted_t_value": 1.23,
                "unweighted_p_value": 1.23,
                "trend_percentage": 1.23,
                "absolute_percentage_change": 1.23,
                "trend_difference": 1.23,
                "breakpoint": breakpoint,
            }
            for project in self.projects
        ]
        emit_function_regression_issue(
            {project.id: project for project in self.projects}, regressions, self.now
        )

        def get_example(stored):
            return {
                "profile_id": stored["transaction"]["contexts"]["profile"]["profile_id"],
            }

        mock_get_from_profiling_service.assert_has_calls(
            [
                mock.call(
                    method="POST",
                    path="/regressed",
                    json_data=[
                        {
                            "organization_id": self.organization.id,
                            "project_id": project.id,
                            "example": get_example(stored),
                            "fingerprint": fingerprint,
                            "absolute_percentage_change": 1.23,
                            "aggregate_range_1": 100_000_000,
                            "aggregate_range_2": 200_000_000,
                            "breakpoint": breakpoint,
                            "trend_difference": 1.23,
                            "trend_percentage": 1.23,
                            "unweighted_p_value": 1.23,
                            "unweighted_t_value": 1.23,
                        }
                        for project, stored in zip(self.projects, self.transaction_functions)
                    ],
                )
            ],
        )

    @mock.patch("sentry.tasks.statistical_detectors.get_from_profiling_service")
    @mock.patch("sentry.tasks.statistical_detectors.raw_snql_query")
    def test_emit_function_regression_issue_continuous_function(
        self,
        mock_raw_snql_query,
        mock_get_from_profiling_service,
    ):
        mock_raw_snql_query.return_value = {
            "data": [
                {
                    "project_id": project.id,
                    "profiler_id": stored["profiler_id"],
                    "chunk_id": stored["chunk_id"],
                    "start_timestamp": self.hour_ago.isoformat(),
                    "end_timestamp": (self.hour_ago + timedelta(microseconds=300_000)).isoformat(),
                }
                for project, stored in zip(
                    self.projects,
                    self.continuous_functions,
                )
            ],
        }

        mock_value = mock.MagicMock()
        mock_value.status = 200
        mock_value.data = b'{"occurrences":2}'
        mock_get_from_profiling_service.return_value = mock_value

        fingerprint = self.function_fingerprint({"package": "bar", "function": "bar"})
        breakpoint = int((self.hour_ago - timedelta(hours=12)).timestamp())

        regressions: list[BreakpointData] = [
            {
                "project": str(project.id),
                "transaction": str(fingerprint),
                "aggregate_range_1": 100_000_000,
                "aggregate_range_2": 200_000_000,
                "unweighted_t_value": 1.23,
                "unweighted_p_value": 1.23,
                "trend_percentage": 1.23,
                "absolute_percentage_change": 1.23,
                "trend_difference": 1.23,
                "breakpoint": breakpoint,
            }
            for project in self.projects
        ]
        emit_function_regression_issue(
            {project.id: project for project in self.projects}, regressions, self.now
        )

        def get_example(stored):
            return {
                "profiler_id": stored["profiler_id"],
                "thread_id": "1",
                "start": self.hour_ago.timestamp(),
                "end": (self.hour_ago + timedelta(microseconds=300_000)).timestamp(),
                "chunk_id": stored["chunk_id"],
            }

        mock_get_from_profiling_service.assert_has_calls(
            [
                mock.call(
                    method="POST",
                    path="/regressed",
                    json_data=[
                        {
                            "organization_id": self.organization.id,
                            "project_id": project.id,
                            "example": get_example(stored),
                            "fingerprint": fingerprint,
                            "absolute_percentage_change": 1.23,
                            "aggregate_range_1": 100_000_000,
                            "aggregate_range_2": 200_000_000,
                            "breakpoint": breakpoint,
                            "trend_difference": 1.23,
                            "trend_percentage": 1.23,
                            "unweighted_p_value": 1.23,
                            "unweighted_t_value": 1.23,
                        }
                        for project, stored in zip(self.projects, self.continuous_functions)
                    ],
                )
            ],
        )

    @mock.patch("sentry.tasks.statistical_detectors.get_from_profiling_service")
    def test_emit_function_regression_issue_mixed(self, mock_get_from_profiling_service):
        mock_value = mock.MagicMock()
        mock_value.status = 200
        mock_value.data = b'{"occurrences":2}'
        mock_get_from_profiling_service.return_value = mock_value

        fingerprint = self.function_fingerprint({"package": "foo", "function": "foo"})
        breakpoint = int((self.hour_ago - timedelta(hours=12)).timestamp())

        regressions: list[BreakpointData] = [
            {
                "project": str(project.id),
                "transaction": str(fingerprint),
                "aggregate_range_1": 100_000_000,
                "aggregate_range_2": 200_000_000,
                "unweighted_t_value": 1.23,
                "unweighted_p_value": 1.23,
                "trend_percentage": 1.23,
                "absolute_percentage_change": 1.23,
                "trend_difference": 1.23,
                "breakpoint": breakpoint,
            }
            for project in self.projects
        ]
        emit_function_regression_issue(
            {project.id: project for project in self.projects}, regressions, self.now
        )

        def get_example(stored):
            # when the 2 modes are mixed, we try to prefer transaction based profiles
            return {
                "profile_id": stored["transaction"]["contexts"]["profile"]["profile_id"],
            }

        mock_get_from_profiling_service.assert_has_calls(
            [
                mock.call(
                    method="POST",
                    path="/regressed",
                    json_data=[
                        {
                            "organization_id": self.organization.id,
                            "project_id": project.id,
                            "example": get_example(stored),
                            "fingerprint": fingerprint,
                            "absolute_percentage_change": 1.23,
                            "aggregate_range_1": 100_000_000,
                            "aggregate_range_2": 200_000_000,
                            "breakpoint": breakpoint,
                            "trend_difference": 1.23,
                            "trend_percentage": 1.23,
                            "unweighted_p_value": 1.23,
                            "unweighted_t_value": 1.23,
                        }
                        for project, stored in zip(self.projects, self.transaction_functions)
                    ],
                )
            ],
        )


@pytest.mark.sentry_metrics
class TestTransactionsQuery(MetricsAPIBaseTestCase):
    def setUp(self):
        super().setUp()
        self.num_projects = 2
        self.num_transactions = 4

        self.hour_ago = (self.now - timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        self.hour_ago_seconds = int(self.hour_ago.timestamp())
        self.projects = [
            self.create_project(organization=self.organization) for _ in range(self.num_projects)
        ]

        for project in self.projects:
            for i in range(self.num_transactions):
                # Store metrics for a backend transaction
                self.store_metric(
                    self.organization.id,
                    project.id,
                    TransactionMRI.DURATION.value,
                    {"transaction": f"transaction_{i}", "transaction.op": "http.server"},
                    self.hour_ago_seconds,
                    1.0,
                )
                self.store_metric(
                    self.organization.id,
                    project.id,
                    TransactionMRI.DURATION.value,
                    {"transaction": f"transaction_{i}", "transaction.op": "http.server"},
                    self.hour_ago_seconds,
                    9.5,
                )

                # Store metrics for a frontend transaction, which should be
                # ignored by the query
                self.store_metric(
                    self.organization.id,
                    project.id,
                    TransactionMRI.DURATION.value,
                    {"transaction": f"fe_transaction_{i}", "transaction.op": "navigation"},
                    self.hour_ago_seconds,
                    1.0,
                )
                self.store_metric(
                    self.organization.id,
                    project.id,
                    TransactionMRI.DURATION.value,
                    {"transaction": f"fe_transaction_{i}", "transaction.op": "navigation"},
                    self.hour_ago_seconds,
                    9.5,
                )

    @property
    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_transactions_query(self) -> None:
        res = query_transactions(
            self.projects,
            self.now,
            self.num_transactions + 1,  # detect if any extra transactions are returned
        )

        assert len(res) == len(self.projects) * self.num_transactions
        for trend_payload in res:
            assert trend_payload.count == 2
            # p95 is  calculated by a probabilistic data structure, as such the value won't actually be 9.5 since we only have
            # one sample at 9.5, but it should be close
            assert trend_payload.value > 9
            assert trend_payload.timestamp == self.hour_ago


@pytest.mark.sentry_metrics
class TestTransactionChangePointDetection(MetricsAPIBaseTestCase):
    def setUp(self):
        super().setUp()
        self.num_projects = 2
        self.num_transactions = 4

        self.hour_ago = (self.now - timedelta(hours=1)).replace(minute=0, second=0, microsecond=0)
        self.hour_ago_seconds = int(self.hour_ago.timestamp())
        self.projects = [
            self.create_project(organization=self.organization) for _ in range(self.num_projects)
        ]

        def store_metric(project_id, transaction, minutes_ago, value):
            self.store_metric(
                self.organization.id,
                project_id,
                TransactionMRI.DURATION_LIGHT.value,
                {"transaction": transaction},
                int((self.now - timedelta(minutes=minutes_ago)).timestamp()),
                value,
            )

        for project in self.projects:
            for i in range(self.num_transactions):
                store_metric(project.id, f"transaction_{i}", 20, 9.5)
                store_metric(project.id, f"transaction_{i}", 40, 9.5)
                store_metric(project.id, f"transaction_{i}", 60, 9.5)
                store_metric(project.id, f"transaction_{i}", 80, 1.0)
                store_metric(project.id, f"transaction_{i}", 100, 1.0)
                store_metric(project.id, f"transaction_{i}", 120, 1.0)

    @property
    def now(self):
        return MetricsAPIBaseTestCase.MOCK_DATETIME

    def test_query_transactions_timeseries(self) -> None:
        results = [
            timeseries
            for timeseries in query_transactions_timeseries(
                [
                    (self.projects[0], "transaction_1"),
                    (self.projects[0], "transaction_2"),
                    (self.projects[1], "transaction_1"),
                ],
                self.now,
                "p95(transaction.duration)",
            )
        ]

        end = self.now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
        start = end - timedelta(days=14)
        first_timeseries_time = self.now - timedelta(hours=2)
        second_timeseries_time = self.now - timedelta(hours=1)
        assert results == [
            (
                self.projects[0].id,
                "transaction_1",
                SnubaTSResult(
                    {
                        "data": zerofill(
                            [
                                {
                                    "transaction": "transaction_1",
                                    "time": first_timeseries_time.isoformat(),
                                    "project_id": self.projects[0].id,
                                    "p95_transaction_duration": 1.0,
                                },
                                {
                                    "transaction": "transaction_1",
                                    "time": second_timeseries_time.isoformat(),
                                    "project_id": self.projects[0].id,
                                    "p95_transaction_duration": 9.5,
                                },
                            ],
                            start,
                            end,
                            3600,
                            ["time"],
                        ),
                        "project": self.projects[0].id,
                    },
                    start,
                    end,
                    3600,
                ),
            ),
            (
                self.projects[0].id,
                "transaction_2",
                SnubaTSResult(
                    {
                        "data": zerofill(
                            [
                                {
                                    "transaction": "transaction_2",
                                    "time": first_timeseries_time.isoformat(),
                                    "project_id": self.projects[0].id,
                                    "p95_transaction_duration": 1.0,
                                },
                                {
                                    "transaction": "transaction_2",
                                    "time": second_timeseries_time.isoformat(),
                                    "project_id": self.projects[0].id,
                                    "p95_transaction_duration": 9.5,
                                },
                            ],
                            start,
                            end,
                            3600,
                            ["time"],
                        ),
                        "project": self.projects[0].id,
                    },
                    start,
                    end,
                    3600,
                ),
            ),
            (
                self.projects[1].id,
                "transaction_1",
                SnubaTSResult(
                    {
                        "data": zerofill(
                            [
                                {
                                    "transaction": "transaction_1",
                                    "time": first_timeseries_time.isoformat(),
                                    "project_id": self.projects[1].id,
                                    "p95_transaction_duration": 1.0,
                                },
                                {
                                    "transaction": "transaction_1",
                                    "time": second_timeseries_time.isoformat(),
                                    "project_id": self.projects[1].id,
                                    "p95_transaction_duration": 9.5,
                                },
                            ],
                            start,
                            end,
                            3600,
                            ["time"],
                        ),
                        "project": self.projects[1].id,
                    },
                    start,
                    end,
                    3600,
                ),
            ),
        ]

    def test_query_transactions_single_timeseries(self) -> None:
        results = [
            timeseries
            for timeseries in query_transactions_timeseries(
                [(self.projects[0], "transaction_1")],
                self.now,
                "p95(transaction.duration)",
            )
        ]
        assert len(results) == 1

    @mock.patch("sentry.tasks.statistical_detectors.send_regression_to_platform")
    @mock.patch("sentry.statistical_detectors.detector.detect_breakpoints")
    def test_transaction_change_point_detection(
        self, mock_detect_breakpoints, mock_send_regression_to_platform
    ) -> None:
        mock_detect_breakpoints.return_value = {
            "data": [
                {
                    "absolute_percentage_change": 5.0,
                    "aggregate_range_1": 100000000.0,
                    "aggregate_range_2": 500000000.0,
                    "breakpoint": 1687323600,
                    "change": "regression",
                    "project": str(self.projects[0].id),
                    "transaction": "transaction_1",
                    "trend_difference": 400000000.0,
                    "trend_percentage": 5.0,
                    "unweighted_p_value": 0.0,
                    "unweighted_t_value": -float("inf"),
                },
            ]
        }

        options = {"statistical_detectors.enable": True}

        with override_options(options):
            detect_transaction_change_points(
                [
                    (self.projects[0].id, "transaction_1"),
                    (self.projects[0].id, "transaction_2"),
                    (self.projects[1].id, "transaction_1"),
                ],
                self.now,
            )
        assert mock_send_regression_to_platform.called
