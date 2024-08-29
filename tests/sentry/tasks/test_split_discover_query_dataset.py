from unittest import mock

import pytest

from sentry.discover.dataset_split import _get_and_save_split_decision_for_query
from sentry.discover.models import DatasetSourcesTypes, DiscoverSavedQuery, DiscoverSavedQueryTypes
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.tasks.split_discover_query_dataset import (
    RATE_LIMIT_CACHE,
    NoOpException,
    _split_discover_query_dataset,
    split_discover_query_dataset,
)
from sentry.testutils.factories import Factories
from sentry.testutils.helpers import override_options
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.users.models.user import User


@pytest.fixture
def owner() -> None:
    return Factories.create_user()


@pytest.fixture
def organization(owner: User) -> None:
    return Factories.create_organization(owner=owner)


@pytest.fixture
def project(organization: Organization) -> Project:
    return Factories.create_project(organization=organization)


def create_discover_query(
    fields,
    query,
    project: Project,
    dataset=DiscoverSavedQueryTypes.DISCOVER,
    source=DatasetSourcesTypes.UNKNOWN.value,
):
    return DiscoverSavedQuery.objects.create(
        organization=project.organization,
        name="Test query",
        query={"fields": fields, "query": query},
        dataset=dataset,
        dataset_source=source,
    )


@pytest.mark.parametrize(
    [
        "option_enabled",
        "option_organization_allowlist",
        "_get_and_save_split_decision_for_query_called",
    ],
    [
        pytest.param(False, False, False, id="nothing_enabled"),
        pytest.param(True, False, False, id="option_enabled"),
        pytest.param(
            True,
            True,
            True,
            id="everything_enabled",
        ),
    ],
)
@django_db_all
def test_split_discover_query_dataset_flags(
    option_enabled: bool,
    option_organization_allowlist: list[int],
    _get_and_save_split_decision_for_query_called: bool,
    project: Project,
):
    options = {
        "discover.saved-query-dataset-split.enable": option_enabled,
        "discover.saved-query-dataset-split.organization-id-allowlist": (
            [project.organization_id] if option_organization_allowlist else []
        ),
    }

    create_discover_query(["transaction", "count()"], "", project)

    with (
        override_options(options),
        mock.patch(
            "sentry.tasks.split_discover_query_dataset._get_and_save_split_decision_for_query",
            wraps=_get_and_save_split_decision_for_query,
        ) as mock_get_and_save_split_decision_for_query,
    ):
        split_discover_query_dataset(False)
        assert (
            mock_get_and_save_split_decision_for_query.called
            == _get_and_save_split_decision_for_query_called
        )


@django_db_all
def test_prevent_hitting_ratelimit_strategy(project: Project):
    RATE_LIMIT_CACHE.clear()
    options = {
        "discover.saved-query-dataset-split.organization-id-allowlist": ([project.organization_id]),
        "discover.saved-query-dataset-split.enable": True,
    }
    create_discover_query(["transaction", "count()"], "", project)

    assert project.organization.id not in RATE_LIMIT_CACHE

    with (
        freeze_time("2025-05-01") as frozen_time,
        override_options(options),
        mock.patch(
            "sentry.tasks.split_discover_query_dataset._get_and_save_split_decision_for_query",
            wraps=_get_and_save_split_decision_for_query,
        ) as mock_get_and_save_split_decision_for_query,
    ):
        _split_discover_query_dataset(False)
        assert mock_get_and_save_split_decision_for_query.call_count == 1
        assert project.organization.id in RATE_LIMIT_CACHE

        create_discover_query(["transaction", "count()"], "", project)

        frozen_time.shift(5)
        with pytest.raises(NoOpException):
            _split_discover_query_dataset(False)
        assert mock_get_and_save_split_decision_for_query.call_count == 1

        frozen_time.shift(300)
        _split_discover_query_dataset(False)
        assert mock_get_and_save_split_decision_for_query.call_count == 2
