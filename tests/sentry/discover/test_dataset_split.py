from datetime import datetime, timedelta

import pytest

from sentry.discover.dataset_split import (
    SplitDataset,
    _dataset_split_decision_inferred_from_query,
)
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.search.events.builder.discover import DiscoverQueryBuilder
from sentry.search.events.builder.errors import ErrorsQueryBuilder
from sentry.search.events.types import SnubaParams
from sentry.snuba.dataset import Dataset
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.users.models.user import User


@pytest.fixture
def owner() -> User:
    return Factories.create_user()


@pytest.fixture
def organization(owner: User) -> Organization:
    return Factories.create_organization(owner=owner)


@pytest.fixture
def project(organization: Organization) -> Project:
    return Factories.create_project(organization=organization)


@pytest.mark.parametrize(
    ["query", "selected_columns", "expected_dataset"],
    [
        pytest.param("", ["count()"], None),
        pytest.param(
            "stack.filename:'../../sentry/scripts/views.js' AND (branch:foo OR branch:bar)",
            ["count()"],
            SplitDataset.Errors,
        ),
        pytest.param(
            "error.unhandled:true",
            ["count()"],
            SplitDataset.Errors,
        ),
        pytest.param(
            "(event:type:error AND branch:foo) OR (event:type:transaction AND branch:bar)",
            ["count()"],
            None,
        ),
        pytest.param(
            "branch:foo branch:bar",
            ["count()"],
            None,
        ),
        pytest.param(
            "branch:foo branch:bar",
            ["stack.function", "avg(transaction.duration)"],
            SplitDataset.Errors,
        ),
        pytest.param(
            "",
            ["error.handled", "count()"],
            SplitDataset.Errors,
        ),
        pytest.param(
            "transaction.duration:>100ms",
            ["count()"],
            SplitDataset.Transactions,
        ),
        pytest.param(
            "tag:value event.type:transaction",
            ["count()"],
            SplitDataset.Transactions,
        ),
        pytest.param(
            "(tag:value OR branch:foo) AND event.type:transaction",
            ["count()"],
            SplitDataset.Transactions,
        ),
        pytest.param(
            "branch:foo branch:bar",
            ["avg(transaction.duration)"],
            SplitDataset.Transactions,
        ),
        pytest.param(
            "branch:foo branch:bar",
            ["p95(measurements.app_start_cold)"],
            SplitDataset.Transactions,
        ),
    ],
)
@django_db_all
def test_dataset_split_decision_inferred_from_query(
    query: str,
    selected_columns: list[str],
    expected_dataset: SplitDataset | None,
    project: Project,
) -> None:
    snuba_dataclass = SnubaParams(
        start=datetime.now() - timedelta(days=1),
        end=datetime.now(),
        environments=[],
        projects=[project],
        user=None,
        teams=[],
        organization=project.organization,
    )

    errors_builder = ErrorsQueryBuilder(
        Dataset.Events,
        params={},
        snuba_params=snuba_dataclass,
        query=query,
        selected_columns=selected_columns,
        equations=[],
        limit=1,
    )

    transactions_builder = DiscoverQueryBuilder(
        Dataset.Transactions,
        params={},
        snuba_params=snuba_dataclass,
        query=query,
        selected_columns=selected_columns,
        equations=[],
        limit=1,
    )

    assert expected_dataset == _dataset_split_decision_inferred_from_query(
        errors_builder=errors_builder, transactions_builder=transactions_builder
    )
