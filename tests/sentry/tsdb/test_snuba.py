from __future__ import absolute_import, division

import pytz
import six
from datetime import datetime, timedelta

from sentry.testutils.cases import OutcomesSnubaTest
from sentry.tsdb.base import TSDBModel
from sentry.tsdb.snuba import SnubaTSDB
from sentry.utils.dates import to_timestamp
from sentry.utils.outcomes import Outcome


def floor_to_hour_epoch(value):
    value = value.replace(minute=0, second=0, microsecond=0)
    return int(to_timestamp(value))


def floor_to_10s_epoch(value):
    seconds = value.second
    floored_second = 10 * (seconds // 10)

    value = value.replace(second=floored_second, microsecond=0)
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

        for outcome in [Outcome.ACCEPTED, Outcome.RATE_LIMITED, Outcome.FILTERED]:
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.start_time, 1, 3
            )
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.one_day_later, 1, 4
            )

            # Also create some outcomes we shouldn't be querying
            self.store_outcomes(
                other_organization.id, self.project.id, outcome.value, self.one_day_later, 1, 5
            )
            self.store_outcomes(
                self.organization.id,
                self.project.id,
                outcome.value,
                self.day_before_start_time,
                1,
                6,
            )

        for tsdb_model, granularity, floor_func, start_time_count, day_later_count in [
            (TSDBModel.organization_total_received, 3600, floor_to_hour_epoch, 3 * 3, 4 * 3),
            (TSDBModel.organization_total_rejected, 3600, floor_to_hour_epoch, 3, 4),
            (TSDBModel.organization_total_blacklisted, 3600, floor_to_hour_epoch, 3, 4),
            (TSDBModel.organization_total_received, 10, floor_to_10s_epoch, 3 * 3, 4 * 3),
            (TSDBModel.organization_total_rejected, 10, floor_to_10s_epoch, 3, 4),
            (TSDBModel.organization_total_blacklisted, 10, floor_to_10s_epoch, 3, 4),
        ]:
            # Query SnubaTSDB
            response = self.db.get_range(
                tsdb_model, [self.organization.id], self.start_time, self.now, granularity, None
            )

            # Assert that the response has values set for the times we expect, and nothing more
            assert self.organization.id in response
            response_dict = {k: v for (k, v) in response[self.organization.id]}

            assert response_dict[floor_func(self.start_time)] == start_time_count
            assert response_dict[floor_func(self.one_day_later)] == day_later_count

            for time, count in response[self.organization.id]:
                if time not in [floor_func(self.start_time), floor_func(self.one_day_later)]:
                    assert count == 0

    def test_project_outcomes(self):
        other_project = self.create_project(organization=self.organization)

        for outcome in [Outcome.ACCEPTED, Outcome.RATE_LIMITED, Outcome.FILTERED]:
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.start_time, 1, 3
            )
            self.store_outcomes(
                self.organization.id, self.project.id, outcome.value, self.one_day_later, 1, 4
            )

            # Also create some outcomes we shouldn't be querying
            self.store_outcomes(
                self.organization.id, other_project.id, outcome.value, self.one_day_later, 1, 5
            )
            self.store_outcomes(
                self.organization.id,
                self.project.id,
                outcome.value,
                self.day_before_start_time,
                1,
                6,
            )

        for tsdb_model, granularity, floor_func, start_time_count, day_later_count in [
            (TSDBModel.project_total_received, 3600, floor_to_hour_epoch, 3 * 3, 4 * 3),
            (TSDBModel.project_total_rejected, 3600, floor_to_hour_epoch, 3, 4),
            (TSDBModel.project_total_blacklisted, 3600, floor_to_hour_epoch, 3, 4),
            (TSDBModel.project_total_received, 10, floor_to_10s_epoch, 3 * 3, 4 * 3),
            (TSDBModel.project_total_rejected, 10, floor_to_10s_epoch, 3, 4),
            (TSDBModel.project_total_blacklisted, 10, floor_to_10s_epoch, 3, 4),
        ]:
            response = self.db.get_range(
                tsdb_model, [self.project.id], self.start_time, self.now, granularity, None
            )

            # Assert that the response has values set for the times we expect, and nothing more
            assert self.project.id in response
            response_dict = {k: v for (k, v) in response[self.project.id]}

            assert response_dict[floor_func(self.start_time)] == start_time_count
            assert response_dict[floor_func(self.one_day_later)] == day_later_count

            for time, count in response[self.project.id]:
                if time not in [floor_func(self.start_time), floor_func(self.one_day_later)]:
                    assert count == 0

    def test_key_outcomes(self):
        project_key = self.create_project_key(project=self.project)
        other_project = self.create_project(organization=self.organization)
        other_project_key = self.create_project_key(project=other_project)

        for outcome in [Outcome.ACCEPTED, Outcome.RATE_LIMITED, Outcome.FILTERED]:
            self.store_outcomes(
                self.organization.id,
                self.project.id,
                outcome.value,
                self.start_time,
                project_key.id,
                3,
            )
            self.store_outcomes(
                self.organization.id,
                self.project.id,
                outcome.value,
                self.one_day_later,
                project_key.id,
                4,
            )

            # Also create some outcomes we shouldn't be querying
            self.store_outcomes(
                self.organization.id,
                self.project.id,
                outcome.value,
                self.one_day_later,
                other_project_key.id,
                5,
            )
            self.store_outcomes(
                self.organization.id,
                self.project.id,
                outcome.value,
                self.day_before_start_time,
                project_key.id,
                6,
            )

        for tsdb_model, granularity, floor_func, start_time_count, day_later_count in [
            (TSDBModel.key_total_received, 3600, floor_to_hour_epoch, 3 * 3, 4 * 3),
            (TSDBModel.key_total_rejected, 3600, floor_to_hour_epoch, 3, 4),
            (TSDBModel.key_total_blacklisted, 3600, floor_to_hour_epoch, 3, 4),
            (TSDBModel.key_total_received, 10, floor_to_10s_epoch, 3 * 3, 4 * 3),
            (TSDBModel.key_total_rejected, 10, floor_to_10s_epoch, 3, 4),
            (TSDBModel.key_total_blacklisted, 10, floor_to_10s_epoch, 3, 4),
        ]:
            response = self.db.get_range(
                # with [project_key.id, six.text_type(project_key.id)], we are imitating the hack in
                # project_key_stats.py cause that is what `get_range` will be called with.
                tsdb_model,
                [project_key.id, six.text_type(project_key.id)],
                self.start_time,
                self.now,
                granularity,
                None,
            )

            # Assert that the response has values set for the times we expect, and nothing more
            assert project_key.id in response
            response_dict = {k: v for (k, v) in response[project_key.id]}

            assert response_dict[floor_func(self.start_time)] == start_time_count
            assert response_dict[floor_func(self.one_day_later)] == day_later_count

            for time, count in response[project_key.id]:
                if time not in [floor_func(self.start_time), floor_func(self.one_day_later)]:
                    assert count == 0

    def test_all_tsdb_models_have_an_entry_in_model_query_settings(self):
        # Ensure that the models we expect to be using Snuba are using Snuba
        exceptions = [
            TSDBModel.project_total_forwarded  # this is not outcomes and will be moved separately
        ]

        # does not include the internal TSDB model
        models = [
            model for model in list(TSDBModel) if 0 < model.value < 700 and model not in exceptions
        ]
        for model in models:
            assert model in SnubaTSDB.model_query_settings

    def test_outcomes_have_a_10s_setting(self):
        exceptions = [
            TSDBModel.project_total_forwarded  # this is not outcomes and will be moved separately
        ]

        def is_an_outcome(model):
            if model in exceptions:
                return False

            # 100 - 200: project outcomes
            # 200 - 300: organization outcomes
            # 500 - 600: key outcomes
            # 600 - 700: filtered project based outcomes
            return (
                (100 <= model.value < 200)
                or (200 <= model.value < 300)
                or (500 <= model.value < 600)
                or (600 <= model.value < 700)
            )

        models = [x for x in list(TSDBModel) if is_an_outcome(x)]
        for model in models:
            assert model in SnubaTSDB.lower_rollup_query_settings
