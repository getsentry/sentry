from datetime import datetime, timedelta, timezone

from sentry.constants import DataCategory
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
        super().setUp()
        self.db = SnubaTSDB()

        # Set up the times
        self.now = datetime.now(timezone.utc)
        self.start_time = self.now - timedelta(days=7)
        self.one_day_later = self.start_time + timedelta(days=1)
        self.day_before_start_time = self.start_time - timedelta(days=1)

    def test_organization_outcomes(self):
        other_organization = self.create_organization()

        for outcome in [Outcome.ACCEPTED, Outcome.RATE_LIMITED, Outcome.FILTERED]:
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.start_time,
                    "quantity": 1,
                },
                3,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.one_day_later,
                    "quantity": 1,
                },
                4,
            )
            # security and default should be included in these queries
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.SECURITY,
                    "timestamp": self.start_time,
                    "quantity": 1,
                },
                1,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.DEFAULT,
                    "timestamp": self.one_day_later,
                    "quantity": 1,
                },
                1,
            )

            # Also create some outcomes we shouldn't be querying
            self.store_outcomes(
                {
                    "org_id": other_organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.one_day_later,
                    "quantity": 1,
                },
                5,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.day_before_start_time,
                    "quantity": 1,
                },
                6,
            )
            # we also shouldn't see any other datacategories in these queries
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.TRANSACTION,
                    "timestamp": self.one_day_later,
                    "quantity": 1,
                },
                1,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ATTACHMENT,
                    "timestamp": self.one_day_later,
                    "quantity": 1,
                },
                1,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.SESSION,
                    "timestamp": self.one_day_later,
                    "quantity": 1,
                },
                1,
            )

        # Add client-discards (which we shouldn't show in total queries)
        self.store_outcomes(
            {
                "org_id": other_organization.id,
                "project_id": self.project.id,
                "outcome": Outcome.CLIENT_DISCARD.value,
                "category": DataCategory.ERROR,
                "timestamp": self.start_time,
                "quantity": 1,
            },
            5,
        )

        for tsdb_model, granularity, floor_func, start_time_count, day_later_count in [
            (TSDBModel.organization_total_received, 3600, floor_to_hour_epoch, 4 * 3, 5 * 3),
            (TSDBModel.organization_total_rejected, 3600, floor_to_hour_epoch, 4, 5),
            (TSDBModel.organization_total_blacklisted, 3600, floor_to_hour_epoch, 4, 5),
            (TSDBModel.organization_total_received, 10, floor_to_10s_epoch, 4 * 3, 5 * 3),
            (TSDBModel.organization_total_rejected, 10, floor_to_10s_epoch, 4, 5),
            (TSDBModel.organization_total_blacklisted, 10, floor_to_10s_epoch, 4, 5),
        ]:
            # Query SnubaTSDB
            response = self.db.get_range(
                tsdb_model,
                [self.organization.id],
                self.start_time,
                self.now,
                granularity,
                None,
                tenant_ids={"referrer": "tests", "organization_id": 1},
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
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.start_time,
                    "key_id": 1,
                },
                1,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.start_time,
                    "key_id": 1,
                    "quantity": 2,
                },
                1,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.one_day_later,
                    "key_id": 1,
                },
                4,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.SECURITY,
                    "timestamp": self.start_time,
                    "key_id": 1,
                },
                1,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.DEFAULT,
                    "timestamp": self.one_day_later,
                    "key_id": 1,
                },
                1,
            )

            # Also create some outcomes we shouldn't be querying
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": other_project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.one_day_later,
                    "key_id": 1,
                },
                5,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.day_before_start_time,
                    "key_id": 1,
                },
                6,
            )

            # we also shouldn't see any other datacategories in these queries
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.TRANSACTION,
                    "timestamp": self.one_day_later,
                    "key_id": 1,
                },
                1,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ATTACHMENT,
                    "timestamp": self.one_day_later,
                    "key_id": 1,
                },
                1,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.SESSION,
                    "timestamp": self.one_day_later,
                    "key_id": 1,
                },
                1,
            )

        for tsdb_model, granularity, floor_func, start_time_count, day_later_count in [
            (TSDBModel.project_total_received, 3600, floor_to_hour_epoch, 4 * 3, 5 * 3),
            (TSDBModel.project_total_rejected, 3600, floor_to_hour_epoch, 4, 5),
            (TSDBModel.project_total_blacklisted, 3600, floor_to_hour_epoch, 4, 5),
            (TSDBModel.project_total_received, 10, floor_to_10s_epoch, 4 * 3, 5 * 3),
            (TSDBModel.project_total_rejected, 10, floor_to_10s_epoch, 4, 5),
            (TSDBModel.project_total_blacklisted, 10, floor_to_10s_epoch, 4, 5),
        ]:
            response = self.db.get_range(
                tsdb_model,
                [self.project.id],
                self.start_time,
                self.now,
                granularity,
                None,
                tenant_ids={"referrer": "tests", "organization_id": 1},
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
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.start_time,
                    "key_id": project_key.id,
                },
                3,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.one_day_later,
                    "key_id": project_key.id,
                },
                4,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.SECURITY,
                    "timestamp": self.start_time,
                    "key_id": project_key.id,
                },
                1,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.DEFAULT,
                    "timestamp": self.one_day_later,
                    "key_id": project_key.id,
                },
                1,
            )

            # Also create some outcomes we shouldn't be querying
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.one_day_later,
                    "key_id": other_project_key.id,
                },
                5,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ERROR,
                    "timestamp": self.day_before_start_time,
                    "key_id": project_key.id,
                },
                6,
            )
            # we also shouldn't see any other datacategories in these queries
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.TRANSACTION,
                    "timestamp": self.one_day_later,
                    "key_id": project_key.id,
                },
                1,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.ATTACHMENT,
                    "timestamp": self.one_day_later,
                    "key_id": project_key.id,
                },
                1,
            )
            self.store_outcomes(
                {
                    "org_id": self.organization.id,
                    "project_id": self.project.id,
                    "outcome": outcome.value,
                    "category": DataCategory.SESSION,
                    "timestamp": self.one_day_later,
                    "key_id": project_key.id,
                },
                1,
            )

        for tsdb_model, granularity, floor_func, start_time_count, day_later_count in [
            (TSDBModel.key_total_received, 3600, floor_to_hour_epoch, 4 * 3, 5 * 3),
            (TSDBModel.key_total_rejected, 3600, floor_to_hour_epoch, 4, 5),
            (TSDBModel.key_total_blacklisted, 3600, floor_to_hour_epoch, 4, 5),
            (TSDBModel.key_total_received, 10, floor_to_10s_epoch, 4 * 3, 5 * 3),
            (TSDBModel.key_total_rejected, 10, floor_to_10s_epoch, 4, 5),
            (TSDBModel.key_total_blacklisted, 10, floor_to_10s_epoch, 4, 5),
        ]:
            response = self.db.get_range(
                # with [project_key.id, str(project_key.id), we are imitating the hack in
                # project_key_stats.py cause that is what `get_range` will be called with.
                tsdb_model,
                [project_key.id, str(project_key.id)],
                self.start_time,
                self.now,
                granularity,
                None,
                tenant_ids={"referrer": "tests", "organization_id": 123},
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
