from __future__ import absolute_import

from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.discover.utils import transform_aliases_and_query


class TransformAliasesAndQueryTest(SnubaTestCase, TestCase):
    def setUp(self):
        super(TransformAliasesAndQueryTest, self).setUp()
        self.environment = self.create_environment(self.project, name="prod")
        self.release = self.create_release(self.project, version="first-release")

        self.store_event(
            data={
                "message": "oh no",
                "release": "first-release",
                "environment": "prod",
                "platform": "python",
                "user": {"id": "99", "email": "bruce@example.com", "username": "brucew"},
                "timestamp": iso_format(before_now(minutes=1)),
            },
            project_id=self.project.id,
        )

    def test_field_aliasing_in_selected_columns(self):
        result = transform_aliases_and_query(
            selected_columns=["project.id", "user.email", "release"],
            filter_keys={"project_id": [self.project.id]},
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user.email"] == "bruce@example.com"
        assert data[0]["release"] == "first-release"

    def test_field_aliasing_in_aggregate_functions_and_groupby(self):
        result = transform_aliases_and_query(
            selected_columns=["project.id"],
            aggregations=[["uniq", "user.email", "uniq_email"]],
            filter_keys={"project_id": [self.project.id]},
            groupby=["project.id"],
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["uniq_email"] == 1

    def test_field_aliasing_in_conditions(self):
        result = transform_aliases_and_query(
            selected_columns=["project.id", "user.email"],
            conditions=[["user.email", "=", "bruce@example.com"]],
            filter_keys={"project_id": [self.project.id]},
        )
        data = result["data"]
        assert len(data) == 1
        assert data[0]["project.id"] == self.project.id
        assert data[0]["user.email"] == "bruce@example.com"

    def test_autoconversion_of_time_column(self):
        result = transform_aliases_and_query(
            aggregations=[["count", None, "count"]],
            filter_keys={"project_id": [self.project.id]},
            start=before_now(minutes=10),
            end=before_now(minutes=-1),
            groupby=["time"],
            orderby=["time"],
            rollup=3600,
        )

        # If the date range spans across two hours, then one row will have results
        # and the other one won't.
        for row in result["data"]:
            assert isinstance(row["time"], int)
            if "count" in row:
                assert row["count"] == 1

    def test_conversion_of_release_filter_key(self):
        result = transform_aliases_and_query(
            selected_columns=["id", "message"],
            filter_keys={
                "release": [self.create_release(self.project).id],
                "project_id": [self.project.id],
            },
        )
        assert len(result["data"]) == 0

        result = transform_aliases_and_query(
            selected_columns=["id", "message"],
            filter_keys={"release": [self.release.id], "project_id": [self.project.id]},
        )
        assert len(result["data"]) == 1

    def test_conversion_of_environment_filter_key(self):
        result = transform_aliases_and_query(
            selected_columns=["id", "message"],
            filter_keys={
                "environment": [self.create_environment(self.project).id],
                "project_id": [self.project.id],
            },
        )
        assert len(result["data"]) == 0

        result = transform_aliases_and_query(
            selected_columns=["id", "message"],
            filter_keys={"environment": [self.environment.id], "project_id": [self.project.id]},
        )
        assert len(result["data"]) == 1
