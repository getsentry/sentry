from datetime import datetime
from unittest import mock

from snuba_sdk.column import Column
from snuba_sdk.conditions import Condition, Op

from sentry.api.endpoints.release_thresholds.utils import (
    get_errors_counts_timeseries_by_project_and_release,
)
from sentry.testutils.cases import TestCase


class GetErrorCountTimeseriesTest(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.project = self.create_project(name="foo", organization=self.org)

    @mock.patch("sentry.api.endpoints.release_thresholds.utils.snuba.raw_snql_query")
    def test_errors_timeseries_snuba_fetch(self, mock_snql_query):
        now = datetime.utcnow()
        get_errors_counts_timeseries_by_project_and_release(
            end=now,
            organization_id=self.org.id,
            project_id_list=[],
            release_value_list=[],
            start=now,
        )

        assert mock_snql_query.call_count == 1

    @mock.patch("sentry.api.endpoints.release_thresholds.utils.snuba.raw_snql_query")
    def test_errors_timeseries_snuba_fetch_called_with_env(self, mock_snql_query):
        now = datetime.utcnow()
        env_list = ["foo"]
        get_errors_counts_timeseries_by_project_and_release(
            end=now,
            organization_id=self.org.id,
            project_id_list=[],
            release_value_list=[],
            start=now,
            environments_list=env_list,
        )

        env_condition = Condition(Column("environment"), Op.IN, env_list)
        call_conditions = mock_snql_query.call_args[1]["request"].query.where
        assert env_condition in call_conditions
