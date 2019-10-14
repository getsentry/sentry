from __future__ import absolute_import

import pytz
from datetime import datetime, timedelta

from sentry.testutils.cases import OutcomesSnubaTest
from sentry.tsdb.base import TSDBModel
from sentry.tsdb.snuba import SnubaTSDB
from sentry.utils.outcomes import Outcome


def to_epoch_time(value):
    value = value.replace(minute=0, second=0, microsecond=0)
    return int((value - datetime(1970, 1, 1, tzinfo=pytz.utc)).total_seconds())


class SnubaTSDBTest(OutcomesSnubaTest):
    def setUp(self):
        super(SnubaTSDBTest, self).setUp()
        self.db = SnubaTSDB()

        # Set up the times
        self.now = datetime.now(pytz.utc)
        self.skew_days = 7
        self.skew = timedelta(days=self.skew_days)
        self.start_time = self.now - self.skew
        self.one_day_later = self.start_time + timedelta(days=1)

    def test_organization_outcomes(self):
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

            response = self.db.get_range(
                tsdb_model, [self.organization.id], self.start_time, self.now, 3600, None
            )

            assert self.organization.id in response.keys()
            response_dict = {k: v for (k, v) in response[self.organization.id]}

            assert response_dict[to_epoch_time(self.start_time)] == 3
            assert response_dict[to_epoch_time(self.one_day_later)] == 4

            for time, count in response[self.organization.id]:
                if time not in [to_epoch_time(self.start_time), to_epoch_time(self.one_day_later)]:
                    assert count == 0

    def test_project_outcomes(self):
        from time import sleep

        for tsdb_model, outcome in [
            (TSDBModel.organization_total_received, Outcome.ACCEPTED),
            (TSDBModel.organization_total_rejected, Outcome.RATE_LIMITED),
            (TSDBModel.organization_total_blacklisted, Outcome.FILTERED),
        ]:
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.start_time, 3
            )
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.one_day_later, 4
            )

            sleep(2)

            response = self.db.get_range(
                tsdb_model, [self.project.id], self.start_time, self.now, 3600, None
            )

            assert self.project.id in response.keys()
            response_dict = {k: v for (k, v) in response[self.project.id]}

            assert response_dict[to_epoch_time(self.start_time)] == 3
            assert response_dict[to_epoch_time(self.one_day_later)] == 4

            for time, count in response[self.project.id]:
                if time not in [to_epoch_time(self.start_time), to_epoch_time(self.one_day_later)]:
                    assert count == 0
