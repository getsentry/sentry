from django.urls import reverse
from rest_framework.exceptions import ErrorDetail

from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.utils.samples import load_data


@region_silo_test
class OrganizationEventsHasMeasurementsTest(APITestCase, SnubaTestCase):
    def setUp(self):
        super().setUp()
        self.min_ago = iso_format(before_now(minutes=1))
        self.two_min_ago = iso_format(before_now(minutes=2))
        self.transaction_data = load_data("transaction", timestamp=before_now(minutes=1))
        self.features = {}

    def do_request(self, query, features=None):
        if features is None:
            features = {
                "organizations:discover-basic": True,
                "organizations:global-views": True,
            }
        features.update(self.features)
        self.login_as(user=self.user)
        url = reverse(
            "sentry-api-0-organization-events-has-measurements",
            kwargs={"organization_slug": self.organization.slug},
        )
        with self.feature(features):
            return self.client.get(url, query, format="json")

    def test_without_feature(self):
        response = self.do_request({}, features={"organizations:discover-basic": False})
        assert response.status_code == 404, response.content

    def test_no_projects(self):
        response = self.do_request({})

        assert response.status_code == 200, response.content
        assert response.data == {"measurements": False}

    def test_more_than_one_project(self):
        project = self.create_project()

        response = self.do_request(
            {
                "project": [self.project.id, project.id],
                "transaction": self.transaction_data["transaction"],
                "type": "web",
            }
        )

        assert response.status_code == 400, response.content
        assert response.data == {
            "non_field_errors": [ErrorDetail("Only 1 project allowed.", code="invalid")],
        }

    def test_no_transaction(self):
        response = self.do_request(
            {
                "project": [self.project.id],
                "type": "web",
            }
        )

        assert response.status_code == 400, response.content
        assert response.data == {
            "transaction": [ErrorDetail("This field may not be null.", code="null")],
        }

    def test_no_type(self):
        response = self.do_request(
            {
                "project": [self.project.id],
                "transaction": self.transaction_data["transaction"],
            }
        )

        assert response.status_code == 400, response.content
        assert response.data == {
            "type": [ErrorDetail("This field may not be null.", code="null")],
        }

    def test_unknown_type(self):
        response = self.do_request(
            {
                "project": [self.project.id],
                "transaction": self.transaction_data["transaction"],
                "type": "foo",
            }
        )

        assert response.status_code == 400, response.content
        assert response.data == {
            "type": [ErrorDetail('"foo" is not a valid choice.', code="invalid_choice")],
        }

    def test_no_events(self):
        response = self.do_request(
            {
                "project": [self.project.id],
                "transaction": self.transaction_data["transaction"],
                "type": "web",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {"measurements": False}

    def test_has_event_but_no_web_measurements(self):
        # make sure the transaction doesnt have measurements
        self.transaction_data["measurements"] = {}
        self.store_event(self.transaction_data, self.project.id)

        response = self.do_request(
            {
                "project": [self.project.id],
                "transaction": self.transaction_data["transaction"],
                "type": "web",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {"measurements": False}

    def test_has_event_and_no_recent_web_measurements(self):
        # make sure the event is older than 7 days
        transaction_data = load_data("transaction", timestamp=before_now(days=8))
        # make sure the transaction has some web measurements
        transaction_data["measurements"] = {"lcp": {"value": 100}}
        self.store_event(transaction_data, self.project.id)

        response = self.do_request(
            {
                "project": [self.project.id],
                "transaction": self.transaction_data["transaction"],
                "type": "web",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {"measurements": False}

    def test_has_event_and_web_measurements(self):
        # make sure the transaction has some web measurements
        self.transaction_data["measurements"] = {"lcp": {"value": 100}}
        self.store_event(self.transaction_data, self.project.id)

        response = self.do_request(
            {
                "project": [self.project.id],
                "transaction": self.transaction_data["transaction"],
                "type": "web",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {"measurements": True}

    def test_has_event_and_no_recent_mobile_measurements(self):
        # make sure the event is older than 7 days
        transaction_data = load_data("transaction", timestamp=before_now(days=8))
        # make sure the transaction has some web measurements
        transaction_data["measurements"] = {"app_start_cold": {"value": 100}}
        self.store_event(transaction_data, self.project.id)

        response = self.do_request(
            {
                "project": [self.project.id],
                "transaction": self.transaction_data["transaction"],
                "type": "mobile",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {"measurements": False}

    def test_has_event_and_mobile_measurements(self):
        # make sure the transaction has some mobile measurements
        self.transaction_data["measurements"] = {"app_start_cold": {"value": 100}}
        self.store_event(self.transaction_data, self.project.id)

        response = self.do_request(
            {
                "project": [self.project.id],
                "transaction": self.transaction_data["transaction"],
                "type": "mobile",
            }
        )

        assert response.status_code == 200, response.content
        assert response.data == {"measurements": True}
