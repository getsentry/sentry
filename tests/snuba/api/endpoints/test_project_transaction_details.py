from datetime import datetime, timedelta, timezone
from uuid import uuid4

from django.urls import reverse

from sentry.testutils.silo import region_silo_test
from tests.snuba.api.endpoints.test_organization_events import OrganizationEventsEndpointTestBase


@region_silo_test
class OrganizationTransactionDetailsTest(OrganizationEventsEndpointTestBase):
    def setUp(self):
        self.owner = self.create_user()
        self.organization = self.create_organization(owner=self.owner)
        self.project = self.create_project(organization=self.organization)
        self.trace_id = uuid4().hex
        self.transaction_id = uuid4().hex
        self.url = reverse(
            "sentry-api-0-organization-transaction-details",
            kwargs={
                "organization_slug": self.organization.slug,
                "project_slug": self.project.slug,
                "transaction_id": self.transaction_id,
            },
        )

    def create_transaction_as_spans(self):
        pass

    def test_returns_spans_inside_timestamps(self):
        self.login_as(user=self.owner)

        start_ts = datetime.now() - timedelta(minutes=1)
        span = self.create_span(
            organization=self.organization,
            project=self.project,
            start_ts=start_ts,
            extra_data={
                "trace_id": self.trace_id,
                "event_id": self.transaction_id,
                "is_segment": True,
            },
        )
        self.store_span(span)

        response = self.client.get(
            self.url,
            data={
                "start_timestamp": str(start_ts.timestamp()),
                "end_timestamp": str(datetime.now().timestamp()),
            },
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.data["contexts"]["trace"]["span_id"] == span["span_id"]

    def test_404s_if_given_incorrect_timestamps(self):
        self.login_as(user=self.owner)

        start_ts = datetime.now() - timedelta(minutes=1)
        span = self.create_span(
            organization=self.organization,
            project=self.project,
            start_ts=start_ts,
            extra_data={
                "trace_id": self.trace_id,
                "event_id": self.transaction_id,
                "is_segment": True,
            },
        )
        self.store_span(span)

        response = self.client.get(
            self.url,
            data={
                "start_timestamp": str(datetime.now().timestamp()),
                "end_timestamp": str(datetime.now().timestamp()),
            },
            format="json",
        )
        assert response.status_code == 404, response.content

    def test_imitates_the_organization_event_details_endpoint_format(self):
        self.login_as(user=self.owner)

        release = "backend@123"
        transaction_name = "/api/0/{organization_slug}/{project_slug}/transactions/{transaction_id}"
        environment = "prod"
        transaction_op = "http.server"
        span_duration = 1000
        browser_name = "Chrome"
        os_name = "Linux"
        sdk_name = "javascript"
        sdk_version = "8.0.0"
        span_hash = "abc123"
        start_ts = datetime.now() - timedelta(minutes=1)

        root_span = self.create_span(
            organization=self.organization,
            project=self.project,
            start_ts=start_ts,
            duration=span_duration,
            extra_data={
                "trace_id": self.trace_id,
                "transaction_id": self.transaction_id,
                "segment_id": self.transaction_id,
                "event_id": self.transaction_id,
                "parent_span_id": None,
                "is_segment": True,
                "op": transaction_op,
                "sentry_tags": {
                    "transaction": transaction_name,
                    "release": release,
                    "environment": environment,
                    "op": transaction_op,
                    "browser.name": browser_name,
                    "os.name": os_name,
                    "sdk.name": sdk_name,
                    "sdk.version": sdk_version,
                    "group": span_hash,
                },
                "tags": {
                    "tag": "value",
                },
            },
        )
        self.store_span(root_span)

        response = self.client.get(
            self.url,
            data={
                "start_timestamp": str(start_ts.timestamp()),
                "end_timestamp": str(datetime.now().timestamp()),
            },
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.data == {
            "id": self.transaction_id,
            "groupID": None,
            "eventID": self.transaction_id,
            "projectID": self.project.id,
            "entries": [
                {
                    "type": "spans",
                    "data": [],
                }
            ],
            "dist": None,
            "message": "",
            "title": transaction_name,
            "location": transaction_name,
            "user": {},
            "contexts": {
                "browser": {
                    "name": browser_name,
                },
                "client_os": {
                    "name": os_name,
                },
                "trace": {
                    "trace_id": self.trace_id,
                    "span_id": root_span["span_id"],
                    "parent_span_id": None,
                    "op": transaction_op,
                    "status": "unknown",
                    "exclusive_time": float(span_duration),
                    "hash": span_hash,
                    "type": "trace",
                },
            },
            "sdk": {
                "name": sdk_name,
                "version": sdk_version,
            },
            "context": {},
            "packages": {},
            "type": "transaction",
            "metadata": {
                "location": transaction_name,
                "title": transaction_name,
            },
            "tags": [
                {"key": k, "value": v}
                for k, v in [
                    ("tag", "value"),
                    ("browser.name", browser_name),
                    ("environment", environment),
                    ("group", span_hash),
                    ("op", transaction_op),
                    ("os.name", os_name),
                    ("release", release),
                    ("sdk.name", sdk_name),
                    ("sdk.version", sdk_version),
                    ("transaction", transaction_name),
                ]
            ],
            "platform": "",
            "dateReceived": datetime.fromtimestamp(
                root_span.get("start_timestamp_ms", 0.0) / 1000.0, tz=timezone.utc
            ).isoformat(),
            "errors": [],
            "occurrence": None,
            "_meta": {},
            "start_timestamp": root_span.get("start_timestamp_ms", 0.0) / 1000,
            "timestamp": (root_span.get("start_timestamp_ms", 0.0) + span_duration) / 1000,
            "measurements": {},
            "breakdowns": {
                "span_ops": {
                    "total.time": {
                        "value": 0.0,
                        "unit": "milliseconds",
                    },
                },
            },
            "release": {
                "version": release,
            },
            "projectSlug": self.project.slug,
        }

    def test_imitates_event_details_span_output_format(self):
        self.login_as(user=self.owner)

        release = "backend@123"
        transaction_name = "/api/0/{organization_slug}/{project_slug}/transactions/{transaction_id}"
        environment = "prod"
        transaction_op = "http.server"
        span_duration = 1000
        browser_name = "Chrome"
        os_name = "Linux"
        sdk_name = "javascript"
        sdk_version = "8.0.0"
        start_ts = datetime.now() - timedelta(minutes=1)
        db_span_duration = 100

        root_span = self.create_span(
            organization=self.organization,
            project=self.project,
            start_ts=start_ts,
            duration=span_duration,
            extra_data={
                "trace_id": self.trace_id,
                "transaction_id": self.transaction_id,
                "segment_id": self.transaction_id,
                "event_id": self.transaction_id,
                "parent_span_id": None,
                "is_segment": True,
                "op": transaction_op,
                "sentry_tags": {
                    "transaction": transaction_name,
                    "release": release,
                    "environment": environment,
                    "op": transaction_op,
                    "browser.name": browser_name,
                    "os.name": os_name,
                    "sdk.name": sdk_name,
                    "sdk.version": sdk_version,
                },
                "tags": {
                    "tag": "value",
                },
                "exclusive_time": span_duration - db_span_duration,
            },
        )
        self.store_span(root_span)

        db_span_hash = "abc123"
        db_span = self.create_span(
            organization=self.organization,
            project=self.project,
            start_ts=start_ts + timedelta(milliseconds=50),
            duration=db_span_duration,
            extra_data={
                "trace_id": self.trace_id,
                "transaction_id": self.transaction_id,
                "segment_id": self.transaction_id,
                "event_id": self.transaction_id,
                "parent_span_id": root_span.get("span_id"),
                "is_segment": False,
                "description": "SELECT * FROM my_table",
                "tags": {
                    "another_tag": "another_value",
                },
                "sentry_tags": {
                    "op": "db",
                    "group": db_span_hash,
                },
            },
        )
        self.store_span(db_span)

        response = self.client.get(
            self.url,
            data={
                "start_timestamp": str(start_ts.timestamp()),
                "end_timestamp": str(datetime.now().timestamp()),
            },
            format="json",
        )
        assert response.status_code == 200, response.content
        assert response.data["entries"][0]["data"] == [
            {
                "timestamp": (db_span.get("start_timestamp_ms", 0.0) + db_span_duration) / 1000,
                "start_timestamp": db_span.get("start_timestamp_ms", 0.0) / 1000,
                "exclusive_time": float(db_span_duration),
                "description": db_span.get("description"),
                "op": "db",
                "span_id": db_span.get("span_id"),
                "parent_span_id": root_span.get("span_id"),
                "trace_id": self.trace_id,
                "tags": {"another_tag": "another_value"},
                "data": {},
                "sentry_tags": {"op": "db", "group": db_span_hash},
                "hash": db_span_hash,
                "same_process_as_parent": None,
            },
        ]

    def test_span_ops_breakdown(self):
        # Copies the Relay test here:
        # https://github.com/getsentry/relay/blob/b2fcde7ddb829e53f8b312bc25b2dc24eaae3b84/relay-event-normalization/src/normalize/breakdowns.rs#L291
        # Since this test actually exercises Snuba, times are changed to relative so that they're within the supported range.

        self.login_as(user=self.owner)

        two_days_ago = datetime.now() - timedelta(days=2)
        base_datetime = datetime(two_days_ago.year, two_days_ago.month, two_days_ago.day)

        root_span = self.create_span(
            organization=self.organization,
            project=self.project,
            start_ts=base_datetime,
            duration=int(timedelta(hours=7).total_seconds() * 1000),
            extra_data={
                "trace_id": self.trace_id,
                "event_id": self.transaction_id,
                "is_segment": True,
            },
        )
        self.store_span(root_span)

        def _store_child_span(op, start_ts, duration):
            self.store_span(
                self.create_span(
                    organization=self.organization,
                    project=self.project,
                    start_ts=start_ts,
                    duration=int(duration.total_seconds() * 1000),
                    extra_data={
                        "trace_id": self.trace_id,
                        "event_id": self.transaction_id,
                        "parent_span_id": root_span["span_id"],
                        "sentry_tags": {"op": op},
                    },
                )
            )

        _store_child_span("http", base_datetime, timedelta(hours=1))
        _store_child_span("db", base_datetime + timedelta(hours=2), timedelta(hours=1))
        _store_child_span(
            "db.postgres", base_datetime + timedelta(hours=2, minutes=30), timedelta(hours=1)
        )
        _store_child_span("db.mongo", base_datetime + timedelta(hours=4), timedelta(minutes=30))
        # Relay's test uses microseconds, but we don't store span timestamps to that granularity.
        _store_child_span(
            "custom", base_datetime + timedelta(hours=5), timedelta(hours=1, milliseconds=10)
        )

        response = self.client.get(
            self.url,
            data={
                "start_timestamp": str(base_datetime.timestamp()),
                "end_timestamp": str((base_datetime + timedelta(hours=8)).timestamp()),
            },
            format="json",
        )
        assert response.data["breakdowns"] == {
            "span_ops": {
                "ops.db": {
                    "value": timedelta(hours=2).total_seconds() * 1000,
                    "unit": "milliseconds",
                },
                "ops.http": {
                    "value": timedelta(hours=1).total_seconds() * 1000,
                    "unit": "milliseconds",
                },
                "total.time": {
                    "value": timedelta(hours=4, milliseconds=10).total_seconds() * 1000,
                    "unit": "milliseconds",
                },
            }
        }
