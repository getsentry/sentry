from datetime import datetime, timedelta, timezone

from django.urls import reverse

from sentry import audit_log
from sentry.data_secrecy.models import DataSecrecyWaiver
from sentry.testutils.asserts import assert_org_audit_log_exists
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import freeze_time
from sentry.testutils.outbox import outbox_runner


class DataSecrecyTest(APITestCase):
    endpoint = "sentry-api-0-data-secrecy"

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    def setUp(self):
        super().setUp()
        self.user = self.create_user("foo@example.com", is_superuser=True)
        self.org = self.create_organization(owner=self.user)
        self.login_as(self.user, superuser=True)
        self.path = reverse(self.endpoint, args=[self.org.slug])

        self.body_params = {
            "accessStart": datetime.now(tz=timezone.utc).isoformat(),
            "accessEnd": (datetime.now(tz=timezone.utc) + timedelta(days=1)).isoformat(),
        }

    def assert_response(self, response, ds: DataSecrecyWaiver, status_code=200):
        assert response.data["accessStart"] == ds.access_start.isoformat()
        assert response.data["accessEnd"] == ds.access_end.isoformat()

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    def test_get_simple(self):
        ds = DataSecrecyWaiver.objects.create(
            organization=self.org,
            access_start=datetime.now(tz=timezone.utc),
            access_end=datetime.now(tz=timezone.utc) + timedelta(days=1),
        )

        response = self.get_success_response(self.org.slug)
        self.assert_response(response, ds)

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    def test_get_no_waiver(self):
        self.get_error_response(self.org.slug, status_code=404)

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    def test_put_create(self):
        with outbox_runner():
            response = self.get_success_response(
                self.org.slug,
                method="put",
                **self.body_params,
            )

        ds = DataSecrecyWaiver.objects.get(organization=self.org)
        self.assert_response(response, ds)

        assert_org_audit_log_exists(
            organization=self.org,
            event=audit_log.get_event_id("DATA_SECRECY_WAIVED"),
        )

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    def test_put_update(self):
        ds = DataSecrecyWaiver.objects.create(
            organization=self.org,
            access_start=datetime.now(tz=timezone.utc),
            access_end=datetime.now(tz=timezone.utc) + timedelta(days=1),
        )

        self.body_params["accessStart"] = (
            datetime.now(tz=timezone.utc) + timedelta(days=1)
        ).isoformat()
        self.body_params["accessEnd"] = (
            datetime.now(tz=timezone.utc) + timedelta(days=2)
        ).isoformat()

        with outbox_runner():
            self.get_success_response(
                self.org.slug,
                method="put",
                **self.body_params,
            )

        assert DataSecrecyWaiver.objects.filter(organization=self.org).count() == 1
        ds = DataSecrecyWaiver.objects.get(organization=self.org)
        assert ds.access_start == datetime.now(tz=timezone.utc) + timedelta(days=1)
        assert ds.access_end == datetime.now(tz=timezone.utc) + timedelta(days=2)

        assert_org_audit_log_exists(
            organization=self.org,
            event=audit_log.get_event_id("DATA_SECRECY_WAIVED"),
        )

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    def test_put_invalid_dates(self):
        self.body_params["accessEnd"] = self.body_params["accessStart"]

        response = self.get_error_response(self.org.slug, method="put", **self.body_params)
        assert "Invalid timestamp" in response.data["nonFieldErrors"][0]

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    def test_put_past_end_date(self):
        self.body_params["accessEnd"], self.body_params["accessStart"] = (
            self.body_params["accessStart"],
            self.body_params["accessEnd"],
        )
        response = self.get_error_response(self.org.slug, method="put", **self.body_params)
        assert "Invalid timestamp" in response.data["nonFieldErrors"][0]

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    def test_put_missing_required_fields(self):
        self.body_params.pop("accessEnd")
        response = self.get_error_response(self.org.slug, method="put", **self.body_params)
        assert "accessEnd" in response.data

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    def test_delete_existing_waiver(self):
        DataSecrecyWaiver.objects.create(
            organization=self.org,
            access_start=datetime.now(tz=timezone.utc),
            access_end=datetime.now(tz=timezone.utc) + timedelta(days=1),
        )

        with outbox_runner():
            self.get_success_response(self.org.slug, method="delete", status_code=204)

        assert DataSecrecyWaiver.objects.filter(organization=self.org).first() is None

        assert_org_audit_log_exists(
            organization=self.org,
            event=audit_log.get_event_id("DATA_SECRECY_REINSTATED"),
        )

    @freeze_time(datetime(2024, 7, 18, 0, 0, 0, tzinfo=timezone.utc))
    def test_delete_non_existing_waiver(self):
        self.get_error_response(self.org.slug, method="delete", status_code=404)
