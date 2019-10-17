from __future__ import absolute_import

import pytz
from datetime import datetime, timedelta

from sentry.testutils.cases import OutcomesSnubaTest
from sentry.tsdb.base import TSDBModel
from sentry.tsdb.snuba import SnubaTSDB
from sentry.utils.dates import to_timestamp
from sentry.utils.outcomes import Outcome


def floor_to_hour_epoch(value):
    value = value.replace(minute=0, second=0, microsecond=0)
    return int(to_timestamp(value))


class SnubaTSDBTest(OutcomesSnubaTest):
    def setUp(self):
        super(SnubaTSDBTest, self).setUp()
        self.db = SnubaTSDB()

        # Set up the times
        self.now = datetime.now(pytz.utc)
        self.start_time = self.now - timedelta(days=7)
        self.one_day_later = self.start_time + timedelta(days=1)
        self.day_before_start_time = self.start_time - timedelta(days=1)

    def test_organization_outcomes(self):
        other_organization = self.create_organization()

        for tsdb_model, outcome in [
            (TSDBModel.organization_total_received, Outcome.ACCEPTED),
            (TSDBModel.organization_total_rejected, Outcome.RATE_LIMITED),
            (TSDBModel.organization_total_blacklisted, Outcome.FILTERED),
        ]:
            # Create all the outcomes we will be querying
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.start_time, 3
            )
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.one_day_later, 4
            )

            # Also create some outcomes we shouldn't be querying
            self.store_outcomes(
                other_organization.id, self.project.id, outcome.value, self.one_day_later, 5
            )
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.day_before_start_time, 6
            )

            # Query SnubaTSDB
            response = self.db.get_range(
                tsdb_model, [self.organization.id], self.start_time, self.now, 3600, None
            )

            # Assert that the response has values set for the times we expect, and nothing more
            assert self.organization.id in response.keys()
            response_dict = {k: v for (k, v) in response[self.organization.id]}

            assert response_dict[floor_to_hour_epoch(self.start_time)] == 3
            assert response_dict[floor_to_hour_epoch(self.one_day_later)] == 4

            for time, count in response[self.organization.id]:
                if time not in [
                    floor_to_hour_epoch(self.start_time),
                    floor_to_hour_epoch(self.one_day_later),
                ]:
                    assert count == 0

    def test_project_outcomes(self):
        other_project = self.create_project(organization=self.organization)

        for tsdb_model, outcome in [
            (TSDBModel.project_total_received, Outcome.ACCEPTED),
            (TSDBModel.project_total_rejected, Outcome.RATE_LIMITED),
            (TSDBModel.project_total_blacklisted, Outcome.FILTERED),
        ]:
            # Create all the outcomes we will be querying
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.start_time, 3
            )
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.one_day_later, 4
            )

            # Also create some outcomes we shouldn't be querying
            self.store_outcomes(
                self.organization.id, other_project.id, outcome.value, self.one_day_later, 5
            )
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.day_before_start_time, 6
            )

            # Query SnubaTSDB
            response = self.db.get_range(
                tsdb_model, [self.project.id], self.start_time, self.now, 3600, None
            )

            # Assert that the response has values set for the times we expect, and nothing more
            assert self.project.id in response.keys()
            response_dict = {k: v for (k, v) in response[self.project.id]}

            assert response_dict[floor_to_hour_epoch(self.start_time)] == 3
            assert response_dict[floor_to_hour_epoch(self.one_day_later)] == 4

            for time, count in response[self.project.id]:
                if time not in [
                    floor_to_hour_epoch(self.start_time),
                    floor_to_hour_epoch(self.one_day_later),
                ]:
                    assert count == 0
