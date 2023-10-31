from io import BytesIO
from unittest import mock
from uuid import uuid4

import pytest

from sentry.models.eventattachment import EventAttachment
from sentry.spans.grouping.utils import hash_values
from sentry.tasks.relay import invalidate_project_config
from sentry.testutils.cases import TransactionTestCase
from sentry.testutils.helpers.datetime import before_now, iso_format, timestamp_format
from sentry.testutils.relay import RelayStoreHelper
from sentry.testutils.skips import requires_kafka

pytestmark = [requires_kafka]


class SentryRemoteTest(RelayStoreHelper, TransactionTestCase):
    # used to be test_ungzipped_data
    def test_simple_data(self):
        event_data = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}
        event = self.post_and_retrieve_event(event_data)
        assert event.message == "hello"

    def test_csp(self):
        event_data = {
            "csp-report": {
                "document-uri": "https://example.com/foo/bar",
                "referrer": "https://www.google.com/",
                "violated-directive": "default-src self",
                "original-policy": "default-src self; report-uri /csp-hotline.php",
                "blocked-uri": "http://evilhackerscripts.com",
            }
        }

        event = self.post_and_retrieve_security_report(event_data)
        assert event.message == "Blocked 'default-src' from 'evilhackerscripts.com'"

    def test_hpkp(self):
        event_data = {
            "date-time": "2014-04-06T13:00:50Z",
            "hostname": "www.example.com",
            "port": 443,
            "effective-expiration-date": "2014-05-01T12:40:50Z",
            "include-subdomains": False,
            "served-certificate-chain": [
                "-----BEGIN CERTIFICATE-----\n MIIEBDCCAuygBQUAMEIxCzAJBgNVBAYTAlVT\n -----END CERTIFICATE-----"
            ],
            "validated-certificate-chain": [
                "-----BEGIN CERTIFICATE-----\n MIIEBDCCAuygAwIBAgIDCzAJBgNVBAYTAlVT\n -----END CERTIFICATE-----"
            ],
            "known-pins": [
                'pin-sha256="d6qzRu9zOECb90Uez27xWltNsj0e1Md7GkYYkVoZWmM="',
                'pin-sha256="E9CZ9INDbd+2eRQozYqqbQ2yXLVKB9+xcprMF+44U1g="',
            ],
        }

        event = self.post_and_retrieve_security_report(event_data)
        assert event.message == "Public key pinning validation failed for 'www.example.com'"
        assert event.group.title == "Public key pinning validation failed for 'www.example.com'"

    def test_expect_ct(self):
        event_data = {
            "expect-ct-report": {
                "date-time": "2014-04-06T13:00:50Z",
                "hostname": "www.example.com",
                "port": 443,
                "effective-expiration-date": "2014-05-01T12:40:50Z",
                "served-certificate-chain": [
                    "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----"
                ],
                "validated-certificate-chain": [
                    "-----BEGIN CERTIFICATE-----\nCDE\n-----END CERTIFICATE-----"
                ],
                "scts": [
                    {
                        "version": 1,
                        "status": "invalid",
                        "source": "embedded",
                        "serialized_sct": "ABCD==",
                    }
                ],
            }
        }

        event = self.post_and_retrieve_security_report(event_data)
        assert event.message == "Expect-CT failed for 'www.example.com'"
        assert event.group.title == "Expect-CT failed for 'www.example.com'"

    def test_expect_staple(self):
        event_data = {
            "expect-staple-report": {
                "date-time": "2014-04-06T13:00:50Z",
                "hostname": "www.example.com",
                "port": 443,
                "response-status": "ERROR_RESPONSE",
                "cert-status": "REVOKED",
                "effective-expiration-date": "2014-05-01T12:40:50Z",
                "served-certificate-chain": [
                    "-----BEGIN CERTIFICATE-----\nABC\n-----END CERTIFICATE-----"
                ],
                "validated-certificate-chain": [
                    "-----BEGIN CERTIFICATE-----\nCDE\n-----END CERTIFICATE-----"
                ],
            }
        }

        event = self.post_and_retrieve_security_report(event_data)
        assert event.message == "Expect-Staple failed for 'www.example.com'"
        assert event.group.title == "Expect-Staple failed for 'www.example.com'"

    def test_standalone_attachment(self):
        event_id = uuid4().hex

        # First, ingest the attachment and ensure it is saved
        files = {"some_file": ("hello.txt", BytesIO(b"Hello World!"))}
        self.post_and_retrieve_attachment(event_id, files)

        # Next, ingest an error event
        event = self.post_and_retrieve_event({"event_id": event_id, "message": "my error"})
        assert event.event_id == event_id
        assert event.group_id

        # Finally, fetch the updated attachment and compare the group id
        attachment = EventAttachment.objects.get(project_id=self.project.id, event_id=event_id)
        assert attachment.group_id == event.group_id

    def test_transaction(self):
        event_data = {
            "event_id": "d2132d31b39445f1938d7e21b6bf0ec4",
            "type": "transaction",
            "transaction": "/organizations/:orgId/performance/:eventSlug/",
            "start_timestamp": iso_format(before_now(minutes=1, milliseconds=500)),
            "timestamp": iso_format(before_now(minutes=1)),
            "contexts": {
                "trace": {
                    "trace_id": "ff62a8b040f340bda5d830223def1d81",
                    "span_id": "8f5a2b8768cafb4e",
                    "type": "trace",
                }
            },
            "spans": [
                {
                    "description": "<OrganizationContext>",
                    "op": "react.mount",
                    "parent_span_id": "8f5a2b8768cafb4e",
                    "span_id": "bd429c44b67a3eb4",
                    "start_timestamp": timestamp_format(before_now(minutes=1, milliseconds=250)),
                    "timestamp": timestamp_format(before_now(minutes=1)),
                    "trace_id": "ff62a8b040f340bda5d830223def1d81",
                },
                {
                    "description": "browser span",
                    "op": "browser",
                    "parent_span_id": "bd429c44b67a3eb4",
                    "span_id": "a99fd04e79e17631",
                    "start_timestamp": timestamp_format(before_now(minutes=1, milliseconds=200)),
                    "timestamp": timestamp_format(before_now(minutes=1)),
                    "trace_id": "ff62a8b040f340bda5d830223def1d81",
                },
                {
                    "description": "resource span",
                    "op": "resource",
                    "parent_span_id": "bd429c44b67a3eb4",
                    "span_id": "a71a5e67db5ce938",
                    "start_timestamp": timestamp_format(before_now(minutes=1, milliseconds=200)),
                    "timestamp": timestamp_format(before_now(minutes=1)),
                    "trace_id": "ff62a8b040f340bda5d830223def1d81",
                },
                {
                    "description": "http span",
                    "op": "http",
                    "parent_span_id": "a99fd04e79e17631",
                    "span_id": "abe79ad9292b90a9",
                    "start_timestamp": timestamp_format(before_now(minutes=1, milliseconds=200)),
                    "timestamp": timestamp_format(before_now(minutes=1)),
                    "trace_id": "ff62a8b040f340bda5d830223def1d81",
                },
                {
                    "description": "db span",
                    "op": "db",
                    "parent_span_id": "abe79ad9292b90a9",
                    "span_id": "9c045ea336297177",
                    "start_timestamp": timestamp_format(before_now(minutes=1, milliseconds=200)),
                    "timestamp": timestamp_format(before_now(minutes=1)),
                    "trace_id": "ff62a8b040f340bda5d830223def1d81",
                },
            ],
        }

        event = self.post_and_retrieve_event(event_data)
        raw_event = event.get_raw_data()

        exclusive_times = [
            pytest.approx(50, abs=2),
            pytest.approx(0, abs=2),
            pytest.approx(200, abs=2),
            pytest.approx(0, abs=2),
            pytest.approx(200, abs=2),
        ]
        for actual, expected, exclusive_time in zip(
            raw_event["spans"], event_data["spans"], exclusive_times
        ):
            assert actual == dict(
                expected,
                exclusive_time=exclusive_time,
                hash=hash_values([expected["description"]]),
            )
        assert raw_event["breakdowns"] == {
            "span_ops": {
                "ops.browser": {"unit": "millisecond", "value": pytest.approx(200, abs=2)},
                "ops.resource": {"unit": "millisecond", "value": pytest.approx(200, abs=2)},
                "ops.http": {"unit": "millisecond", "value": pytest.approx(200, abs=2)},
                "ops.db": {"unit": "millisecond", "value": pytest.approx(200, abs=2)},
                "total.time": {"unit": "millisecond", "value": pytest.approx(1050, abs=2)},
            }
        }

    def test_project_config_compression(self):
        # Populate redis cache with compressed config:
        invalidate_project_config(public_key=self.projectkey, trigger="test")

        # Disable project config endpoint, to make sure Relay gets its data
        # from redis:
        with mock.patch(
            "sentry.api.endpoints.relay.project_configs.RelayProjectConfigsEndpoint.post"
        ):
            event_data = {"message": "hello", "timestamp": iso_format(before_now(seconds=1))}
            event = self.post_and_retrieve_event(event_data)
            assert event.message == "hello"
