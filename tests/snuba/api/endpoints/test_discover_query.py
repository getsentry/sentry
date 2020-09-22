from __future__ import absolute_import

import pytest

from datetime import datetime, timedelta
from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class DiscoverQueryTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super(DiscoverQueryTest, self).setUp()

        self.now = datetime.now()
        self.one_second_ago = iso_format(before_now(seconds=1))

        self.login_as(user=self.user, superuser=False)

        self.org = self.create_organization(owner=self.user, name="foo")

        self.project = self.create_project(name="bar", organization=self.org)

        self.other_project = self.create_project(name="other")

        self.event = self.store_event(
            data={
                "platform": "python",
                "timestamp": self.one_second_ago,
                "environment": "production",
                "tags": {"sentry:release": "foo", "error.custom": "custom"},
                "exception": {
                    "values": [
                        {
                            "type": "ValidationError",
                            "value": "Bad request",
                            "mechanism": {"type": "1", "value": "1"},
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "?",
                                        "filename": "http://localhost:1337/error.js",
                                        "lineno": 29,
                                        "colno": 3,
                                        "in_app": True,
                                    }
                                ]
                            },
                        }
                    ]
                },
            },
            project_id=self.project.id,
        )

    def test(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["environment", "platform.name"],
                    "start": iso_format(datetime.now() - timedelta(seconds=10)),
                    "end": iso_format(datetime.now()),
                    "orderby": "-timestamp",
                    "range": None,
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["environment"] == "production"
        assert response.data["data"][0]["platform.name"] == "python"

    def test_with_discover_basic(self):
        # Dashboards requires access to the discover1 endpoints for now.
        # But newer saas plans don't include discover1, only discover2 (discover-basic).
        with self.feature("organizations:discover-basic"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["environment", "platform.name"],
                    "start": iso_format(datetime.now() - timedelta(seconds=10)),
                    "end": iso_format(datetime.now()),
                    "orderby": "-timestamp",
                    "range": None,
                },
            )
        assert response.status_code == 200, response.content

    def test_relative_dates(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["environment", "platform.name"],
                    "range": "1d",
                    "orderby": "-timestamp",
                    "start": None,
                    "end": None,
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["environment"] == "production"
        assert response.data["data"][0]["platform.name"] == "python"

    def test_invalid_date_request(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["message", "platform"],
                    "range": "1d",
                    "start": iso_format(datetime.now() - timedelta(seconds=10)),
                    "end": iso_format(datetime.now()),
                    "orderby": "-timestamp",
                },
            )

        assert response.status_code == 400, response.content

        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["message", "platform"],
                    "statsPeriodStart": "7d",
                    "statsPeriodEnd": "1d",
                    "start": iso_format(datetime.now() - timedelta(seconds=10)),
                    "end": iso_format(datetime.now()),
                    "orderby": "-timestamp",
                },
            )

        assert response.status_code == 400, response.content

    def test_conditional_fields(self):
        with self.feature("organizations:discover"):
            self.store_event(
                data={
                    "platform": "javascript",
                    "environment": "production",
                    "tags": {"sentry:release": "bar"},
                    "timestamp": self.one_second_ago,
                },
                project_id=self.project.id,
            )
            self.store_event(
                data={
                    "platform": "javascript",
                    "environment": "production",
                    "tags": {"sentry:release": "baz"},
                    "timestamp": self.one_second_ago,
                },
                project_id=self.project.id,
            )
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "aggregations": [["count()", None, "count"]],
                    "conditionFields": [
                        [
                            "if",
                            [["in", ["release", "tuple", ["'foo'"]]], "release", "'other'"],
                            "release",
                        ]
                    ],
                    "start": iso_format(datetime.now() - timedelta(seconds=10)),
                    "end": iso_format(datetime.now()),
                    "groupby": ["time", "release"],
                    "rollup": 86400,
                    "limit": 1000,
                    "orderby": "-time",
                    "range": None,
                },
            )

        assert response.status_code == 200, response.content

        # rollup is by one day and diff of start/end is 10 seconds, so we only have one day
        assert len(response.data["data"]) == 2

        for data in response.data["data"]:
            # note this "release" key represents the alias for the column condition
            # and is also used in `groupby`, it is NOT the release tag
            if data["release"] == "foo":
                assert data["count"] == 1
            elif data["release"] == "other":
                assert data["count"] == 2

    def test_invalid_range_value(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["message", "platform"],
                    "range": "1x",
                    "orderby": "-timestamp",
                    "start": None,
                    "end": None,
                },
            )

        assert response.status_code == 400, response.content

    def test_invalid_aggregation_function(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["message", "platform"],
                    "aggregations": [["test", "test", "test"]],
                    "range": "14d",
                    "orderby": "-timestamp",
                    "start": None,
                    "end": None,
                },
            )

        assert response.status_code == 400, response.content

    @pytest.mark.xfail(reason="Failing due to constrain_columns_to_dataset")
    def test_boolean_condition(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["environment", "platform.name"],
                    "conditions": [["stack.in_app", "=", True]],
                    "start": (datetime.now() - timedelta(seconds=10)).strftime("%Y-%m-%dT%H:%M:%S"),
                    "end": (datetime.now()).strftime("%Y-%m-%dT%H:%M:%S"),
                    "orderby": "-timestamp",
                    "range": None,
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["environment"] == "production"
        assert response.data["data"][0]["platform.name"] == "python"

    def test_strip_double_quotes_in_condition_strings(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["environment"],
                    "conditions": [["environment", "=", '"production"']],
                    "range": "14d",
                    "orderby": "-timestamp",
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["environment"] == "production"

    def test_array_join(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["message", "error.type"],
                    "start": (datetime.now() - timedelta(seconds=10)).strftime("%Y-%m-%dT%H:%M:%S"),
                    "end": (datetime.now() + timedelta(seconds=10)).strftime("%Y-%m-%dT%H:%M:%S"),
                    "orderby": "-timestamp",
                    "range": None,
                },
            )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert response.data["data"][0]["error.type"] == "ValidationError"

    def test_array_condition_equals(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "conditions": [["error.type", "=", "ValidationError"]],
                    "fields": ["message"],
                    "start": (datetime.now() - timedelta(seconds=10)).strftime("%Y-%m-%dT%H:%M:%S"),
                    "end": (datetime.now()).strftime("%Y-%m-%dT%H:%M:%S"),
                    "orderby": "-timestamp",
                    "range": None,
                },
            )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1

    def test_array_condition_not_equals(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "conditions": [["error.type", "!=", "ValidationError"]],
                    "fields": ["message"],
                    "start": (datetime.now() - timedelta(seconds=10)).strftime("%Y-%m-%dT%H:%M:%S"),
                    "end": (datetime.now()).strftime("%Y-%m-%dT%H:%M:%S"),
                    "orderby": "-timestamp",
                    "range": None,
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_array_condition_custom_tag(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "conditions": [["error.custom", "!=", "custom"]],
                    "fields": ["message"],
                    "start": (datetime.now() - timedelta(seconds=10)).strftime("%Y-%m-%dT%H:%M:%S"),
                    "end": (datetime.now()).strftime("%Y-%m-%dT%H:%M:%S"),
                    "orderby": "-timestamp",
                    "range": None,
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 0

    def test_select_project_name(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["project.name"],
                    "range": "14d",
                    "orderby": "-timestamp",
                    "start": None,
                    "end": None,
                },
            )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert (response.data["data"][0]["project.name"]) == "bar"

    def test_groupby_project_name(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "aggregations": [["count()", "", "count"]],
                    "fields": ["project.name"],
                    "range": "14d",
                    "orderby": "-count",
                    "start": None,
                    "end": None,
                },
            )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert (response.data["data"][0]["project.name"]) == "bar"
        assert (response.data["data"][0]["count"]) == 1

    def test_zerofilled_dates_when_rollup_relative(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "aggregations": [["count()", "", "count"]],
                    "fields": ["project.name"],
                    "groupby": ["time"],
                    "orderby": "time",
                    "range": "5d",
                    "rollup": 86400,
                    "start": None,
                    "end": None,
                },
            )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 6
        assert (response.data["data"][5]["time"]) > response.data["data"][4]["time"]
        assert (response.data["data"][5]["project.name"]) == "bar"
        assert (response.data["data"][5]["count"]) == 1

    def test_zerofilled_dates_when_rollup_absolute(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "aggregations": [["count()", "", "count"]],
                    "fields": ["project.name"],
                    "groupby": ["time"],
                    "orderby": "-time",
                    "start": (self.now - timedelta(seconds=300)).strftime("%Y-%m-%dT%H:%M:%S"),
                    "end": self.now.strftime("%Y-%m-%dT%H:%M:%S"),
                    "rollup": 60,
                    "range": None,
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 6
        event_record = response.data["data"][0]
        # This test can span across an hour, where the start is in hour 1, end is in hour 2, and event is in hour 2.
        # That pushes the result to the second row.
        if "project.name" not in event_record:
            event_record = response.data["data"][1]
        assert (event_record["time"]) > response.data["data"][2]["time"]
        assert (event_record["project.name"]) == "bar"
        assert (event_record["count"]) == 1

    def test_uniq_project_name(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "aggregations": [["uniq", "project.name", "uniq_project_name"]],
                    "range": "14d",
                    "orderby": "-uniq_project_name",
                    "start": None,
                    "end": None,
                },
            )
        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 1
        assert (response.data["data"][0]["uniq_project_name"]) == 1

    def test_meta_types(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["project.id", "project.name"],
                    "aggregations": [["count()", "", "count"]],
                    "range": "14d",
                    "orderby": "-count",
                    "start": None,
                    "end": None,
                },
            )
        assert response.status_code == 200, response.content
        assert response.data["meta"] == [
            {"name": "project.id", "type": "integer"},
            {"name": "project.name", "type": "string"},
            {"name": "count", "type": "integer"},
        ]

    def test_no_feature_access(self):
        url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
        with self.feature({"organizations:discover": False, "organizations:discover-basic": False}):
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["message", "platform"],
                    "range": "14d",
                    "orderby": "-timestamp",
                    "start": None,
                    "end": None,
                },
            )
        assert response.status_code == 404, response.content

    def test_invalid_project(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.other_project.id],
                    "fields": ["message", "platform"],
                    "range": "14d",
                    "orderby": "-timestamp",
                    "start": None,
                    "end": None,
                },
            )

        assert response.status_code == 403, response.content

    def test_superuser(self):
        self.new_org = self.create_organization(name="foo_new")
        self.new_project = self.create_project(name="bar_new", organization=self.new_org)
        self.login_as(user=self.user, superuser=True)

        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.new_org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.new_project.id],
                    "fields": ["message", "platform"],
                    "start": iso_format(datetime.now() - timedelta(seconds=10)),
                    "end": iso_format(datetime.now()),
                    "orderby": "-timestamp",
                    "range": None,
                },
            )

        assert response.status_code == 200, response.content

    def test_all_projects(self):
        project = self.create_project(organization=self.org)
        self.event = self.store_event(
            data={
                "message": "other message",
                "platform": "python",
                "timestamp": iso_format(self.now - timedelta(minutes=1)),
            },
            project_id=project.id,
        )

        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [-1],
                    "fields": ["message", "platform.name"],
                    "range": "1d",
                    "orderby": "-timestamp",
                    "start": None,
                    "end": None,
                },
            )

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 2

    def test_measurements_histogram_orderby(self):
        with self.feature("organizations:discover"):
            url = reverse("sentry-api-0-discover-query", args=[self.org.slug])
            response = self.client.post(
                url,
                {
                    "projects": [self.project.id],
                    "fields": ["measurements_histogram(50, measurements.fp, measurements.fcp)"],
                    "start": None,
                    "end": None,
                },
            )
            response

        assert False
