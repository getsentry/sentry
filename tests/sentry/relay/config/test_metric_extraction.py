from unittest import mock

import pytest

from sentry.models.dashboard_widget import DashboardWidgetQueryOnDemand, DashboardWidgetTypes
from sentry.models.project import Project
from sentry.relay.config.metric_extraction import get_current_widget_specs
from sentry.snuba.metrics.extraction import SpecVersion
from sentry.testutils.helpers.on_demand import create_widget
from sentry.testutils.pytest.fixtures import django_db_all


@pytest.mark.parametrize(
    ("current_version", "expected"),
    [
        pytest.param(SpecVersion(2), {"1234", "5678"}, id="test_returns_current_version"),
        pytest.param(SpecVersion(1), {"abcd", "defg"}, id="test_returns_specified_version"),
    ],
)
@django_db_all
@pytest.mark.parametrize(
    "widget_type", [DashboardWidgetTypes.DISCOVER, DashboardWidgetTypes.TRANSACTION_LIKE]
)
def test_get_current_widget_specs(
    default_project: Project, current_version: SpecVersion, expected: set[str], widget_type: int
) -> None:
    for index, (version, hashes, state) in enumerate(
        (
            (1, ["abcd", "defg"], "enabled:manual"),
            (2, ["1234", "5678"], "enabled:manual"),
            (2, ["ab12", "cd78"], "disabled:high-cardinality"),
            (2, ["1234"], "enabled:manual"),
        )
    ):
        widget_query, _, _ = create_widget(
            ["epm()"],
            f"transaction.duration:>={index}",
            default_project,
            title=f"Dashboard {index}",
            columns=["user.id", "release", "count()"],
            widget_type=widget_type,
        )
        DashboardWidgetQueryOnDemand.objects.create(
            dashboard_widget_query=widget_query,
            spec_version=version,
            spec_hashes=hashes,
            extraction_state=state,
        )

    with mock.patch(
        "sentry.snuba.metrics.extraction.OnDemandMetricSpecVersioning.get_query_spec_version",
        return_value=current_version,
    ):
        specs = get_current_widget_specs(default_project.organization)

    assert specs == expected
