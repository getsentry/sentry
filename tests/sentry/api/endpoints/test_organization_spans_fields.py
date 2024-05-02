from uuid import uuid4

from django.urls import reverse

from sentry.testutils.cases import APITestCase, BaseSpansTestCase
from sentry.testutils.helpers.datetime import before_now


class OrganizationSpansTagsEndpointTest(BaseSpansTestCase, APITestCase):
    view = "sentry-api-0-organization-spans-fields"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-trace-explorer"]
        with self.feature(features):
            return self.client.get(
                reverse(self.view, kwargs={"organization_slug": self.organization.slug}),
                format="json",
                **kwargs,
            )

    def test_no_feature(self):
        response = self.do_request(features=[])
        assert response.status_code == 404, response.data

    def test_no_project(self):
        response = self.do_request()
        assert response.status_code == 200, response.data
        assert response.data == []

    def test_tags(self):
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                parent_span_id=None,
                timestamp=before_now(days=0, minutes=10).replace(microsecond=0),
                transaction="foo",
                duration=100,
                exclusive_time=100,
                tags={tag: tag},
            )
        query = {
            "project": [self.project.id],
        }
        response = self.do_request(query=query)
        assert response.status_code == 200, response.data
        assert response.data == [
            {"key": "bar", "name": "Bar"},
            {"key": "baz", "name": "Baz"},
            {"key": "foo", "name": "Foo"},
        ]


class OrganizationSpansTagKeyValuesEndpointTest(BaseSpansTestCase, APITestCase):
    view = "sentry-api-0-organization-spans-fields-values"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)

    def do_request(self, key: str, features=None, **kwargs):
        if features is None:
            features = ["organizations:performance-trace-explorer"]
        with self.feature(features):
            return self.client.get(
                reverse(
                    self.view, kwargs={"organization_slug": self.organization.slug, "key": key}
                ),
                format="json",
                **kwargs,
            )

    def test_no_feature(self):
        response = self.do_request("tag", features=[])
        assert response.status_code == 404, response.data

    def test_no_project(self):
        response = self.do_request("tag")
        assert response.status_code == 200, response.data
        assert response.data == []

    def test_tags_keys(self):
        timestamp = before_now(days=0, minutes=10).replace(microsecond=0)
        for tag in ["foo", "bar", "baz"]:
            self.store_segment(
                self.project.id,
                uuid4().hex,
                uuid4().hex,
                span_id=uuid4().hex[:15],
                parent_span_id=None,
                timestamp=timestamp,
                transaction="foo",
                duration=100,
                exclusive_time=100,
                tags={"tag": tag},
            )

        query = {
            "project": [self.project.id],
        }
        response = self.do_request("tag", query=query)
        assert response.status_code == 200, response.data
        assert response.data == [
            {
                "count": 1,
                "key": "tag",
                "value": "bar",
                "name": "bar",
                "firstSeen": timestamp.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
                "lastSeen": timestamp.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
            },
            {
                "count": 1,
                "key": "tag",
                "value": "baz",
                "name": "baz",
                "firstSeen": timestamp.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
                "lastSeen": timestamp.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
            },
            {
                "count": 1,
                "key": "tag",
                "value": "foo",
                "name": "foo",
                "firstSeen": timestamp.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
                "lastSeen": timestamp.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
            },
        ]
