from __future__ import absolute_import, print_function
from io import BytesIO

from uuid import uuid4
from sentry.models.eventattachment import EventAttachment

from sentry.testutils import TransactionTestCase, RelayStoreHelper
from sentry.testutils.helpers.datetime import iso_format, before_now


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
