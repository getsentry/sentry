# -*- coding: utf-8 -*-

from __future__ import absolute_import

import pytest
from sentry.utils.compat import mock

from django.core.urlresolvers import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from exam import fixture
from sentry.utils.compat.mock import Mock
from six import BytesIO

from sentry.coreapi import APIRateLimited
from sentry.models import ProjectKey, EventAttachment
from sentry.signals import event_accepted
from sentry.testutils import assert_mock_called_once_with_partial, TestCase
from sentry.utils import json
from sentry.utils.data_filters import FilterTypes


@pytest.mark.obsolete("functionality moved and tested in Relay")
class SecurityReportCspTest(TestCase):
    @fixture
    def path(self):
        path = reverse("sentry-api-security-report", kwargs={"project_id": self.project.id})
        return path + "?sentry_key=%s" % self.projectkey.public_key

    @pytest.mark.obsolete("can be removed, covered in Relay")
    def test_get_response(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 405, resp.content

    @pytest.mark.obsolete("can be removed, NOT worth porting to Relay")
    def test_invalid_content_type(self):
        resp = self.client.post(self.path, content_type="text/plain")
        assert resp.status_code == 400, resp.content

    @pytest.mark.obsolete("can be removed, NOT worth porting to Relay")
    def test_missing_csp_report(self):
        resp = self.client.post(
            self.path,
            content_type="application/csp-report",
            data='{"lol":1}',
            HTTP_USER_AGENT="awesome",
        )
        assert resp.status_code == 400, resp.content

    @pytest.mark.obsolete(
        "ported to Relay", "tests/integration/test_security_report.py::test_uses_origins"
    )
    @mock.patch("sentry.utils.http.get_origins")
    def test_bad_origin(self, get_origins):
        get_origins.return_value = ["example.com"]
        resp = self.client.post(
            self.path,
            content_type="application/csp-report",
            data='{"csp-report":{"document-uri":"http://lolnope.com","effective-directive":"img-src",'
            '"violated-directive":"img-src","source-file":"test.html"}}',
            HTTP_USER_AGENT="awesome",
        )
        assert resp.status_code == 403, resp.content

        get_origins.return_value = ["*"]
        resp = self.client.post(
            self.path,
            content_type="application/csp-report",
            data='{"csp-report":{"document-uri":"about:blank"}}',
            HTTP_USER_AGENT="awesome",
        )
        assert resp.status_code == 400, resp.content

    @pytest.mark.obsolete(
        "already covered in Relay by multiple integration tests",
        "tests/integration/test_security_report.py",
    )
    @mock.patch("sentry.web.api.is_valid_origin", mock.Mock(return_value=True))
    @mock.patch("sentry.web.api.SecurityReportView.process")
    def test_post_success(self, process):
        process.return_value = "ok"
        resp = self._postCspWithHeader(
            {
                "document-uri": "http://example.com",
                "source-file": "http://example.com",
                "effective-directive": "style-src",
                "violated-directive": "style-src",
                "disposition": "enforce",
            }
        )
        assert resp.status_code == 201, resp.content


@pytest.mark.obsolete("functionality moved and tested in Relay")
class SecurityReportHpkpTest(TestCase):
    @fixture
    def path(self):
        path = reverse("sentry-api-security-report", kwargs={"project_id": self.project.id})
        return path + "?sentry_key=%s" % self.projectkey.public_key

    @mock.patch("sentry.web.api.is_valid_origin", mock.Mock(return_value=True))
    @mock.patch("sentry.web.api.SecurityReportView.process")
    def test_post_success(self, process):
        process.return_value = "ok"
        resp = self.client.post(
            self.path,
            content_type="application/json",
            data=json.dumps(
                {
                    "date-time": "2014-04-06T13:00:50Z",
                    "hostname": "www.example.com",
                    "port": 443,
                    "effective-expiration-date": "2014-05-01T12:40:50Z",
                    "include-subdomains": False,
                    "served-certificate-chain": [
                        "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"
                    ],
                    "validated-certificate-chain": [
                        "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"
                    ],
                    "known-pins": ['pin-sha256="E9CZ9INDbd+2eRQozYqqbQ2yXLVKB9+xcprMF+44U1g="'],
                }
            ),
            HTTP_USER_AGENT="awesome",
        )
        assert resp.status_code == 201, resp.content


@pytest.mark.obsolete(
    "functionality moved and tested in Relay",
    "tests/integration/test_security_report.py::test_security_reports_no_processing",
)
class SecurityReportExpectCTTest(TestCase):
    @fixture
    def path(self):
        path = reverse("sentry-api-security-report", kwargs={"project_id": self.project.id})
        return path + "?sentry_key=%s" % self.projectkey.public_key

    @mock.patch("sentry.web.api.is_valid_origin", mock.Mock(return_value=True))
    @mock.patch("sentry.web.api.SecurityReportView.process")
    def test_post_success(self, process):
        process.return_value = "ok"
        resp = self.client.post(
            self.path,
            content_type="application/expect-ct-report+json",
            data=json.dumps(
                {
                    "expect-ct-report": {
                        "date-time": "2014-04-06T13:00:50Z",
                        "hostname": "www.example.com",
                        "port": 443,
                        "effective-expiration-date": "2014-05-01T12:40:50Z",
                        "served-certificate-chain": [
                            "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"
                        ],
                        "validated-certificate-chain": [
                            "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"
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
            ),
            HTTP_USER_AGENT="awesome",
        )
        assert resp.status_code == 201, resp.content


@pytest.mark.obsolete(
    "functionality moved and tested in Relay",
    "tests/integration/test_security_report.py::test_security_reports_no_processing",
)
class SecurityReportExpectStapleTest(TestCase):
    @fixture
    def path(self):
        path = reverse("sentry-api-security-report", kwargs={"project_id": self.project.id})
        return path + "?sentry_key=%s" % self.projectkey.public_key

    @mock.patch("sentry.web.api.is_valid_origin", mock.Mock(return_value=True))
    @mock.patch("sentry.web.api.SecurityReportView.process")
    def test_post_success(self, process):
        process.return_value = "ok"
        resp = self.client.post(
            self.path,
            content_type="application/expect-staple-report",
            data=json.dumps(
                {
                    "expect-staple-report": {
                        "date-time": "2014-04-06T13:00:50Z",
                        "hostname": "www.example.com",
                        "port": 443,
                        "response-status": "ERROR_RESPONSE",
                        "cert-status": "REVOKED",
                        "effective-expiration-date": "2014-05-01T12:40:50Z",
                        "served-certificate-chain": [
                            "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"
                        ],
                        "validated-certificate-chain": [
                            "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----"
                        ],
                    }
                }
            ),
            HTTP_USER_AGENT="awesome",
        )
        assert resp.status_code == 201, resp.content


@pytest.mark.obsolete("functionality moved in Relay")
class StoreViewTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-store", kwargs={"project_id": self.project.id})

    @pytest.mark.obsolete("covered in Relay", "tests/integration/test_store.py")
    @mock.patch("sentry.web.api.StoreView._parse_header")
    def test_options_response(self, parse_header):
        project = self.create_project()
        pk = ProjectKey.objects.get_or_create(project=project)[0]
        parse_header.return_value = {
            "sentry_project": project.id,
            "sentry_key": pk.public_key,
            "sentry_version": "2.0",
        }
        resp = self.client.options(self.path)
        assert resp.status_code == 200, (resp.status_code, resp.content)
        assert resp.has_header("Allow")
        self.assertEquals(resp["Allow"], "GET, POST, HEAD, OPTIONS")
        assert resp.has_header("Content-Length")
        self.assertEquals(resp["Content-Length"], "0")

    @pytest.mark.obsolete(
        "Will not be directly tested since implementation is part of axis-web CORS"
    )
    def test_options_with_no_origin_or_referrer(self):
        resp = self.client.options(self.path)
        assert resp.status_code == 200, (resp.status_code, resp.content)
        assert resp.has_header("Access-Control-Allow-Origin")
        self.assertEquals(resp["Access-Control-Allow-Origin"], "*")

    @pytest.mark.obsolete(
        "Will not be directly tested since implementation is part of axis-web CORS"
    )
    def test_options_response_with_valid_origin(self):
        resp = self.client.options(self.path, HTTP_ORIGIN="http://foo.com")
        assert resp.status_code == 200, (resp.status_code, resp.content)
        assert resp.has_header("Access-Control-Allow-Origin")
        self.assertEquals(resp["Access-Control-Allow-Origin"], "http://foo.com")

    @pytest.mark.obsolete(
        "Will not be directly tested since implementation is part of axis-web CORS"
    )
    def test_options_response_with_valid_referrer(self):
        resp = self.client.options(self.path, HTTP_REFERER="http://foo.com")
        assert resp.status_code == 200, (resp.status_code, resp.content)
        assert resp.has_header("Access-Control-Allow-Origin")
        self.assertEquals(resp["Access-Control-Allow-Origin"], "http://foo.com")

    @pytest.mark.obsolete(
        "Will not be directly tested since implementation is part of axis-web CORS"
    )
    def test_options_response_origin_preferred_over_referrer(self):
        resp = self.client.options(
            self.path, HTTP_REFERER="http://foo.com", HTTP_ORIGIN="http://bar.com"
        )
        assert resp.status_code == 200, (resp.status_code, resp.content)
        assert resp.has_header("Access-Control-Allow-Origin")
        self.assertEquals(resp["Access-Control-Allow-Origin"], "http://bar.com")

    @pytest.mark.obsolete("Unit test in Relay", "relay-filter/client_ips.rs")
    @mock.patch("sentry.event_manager.is_valid_ip", mock.Mock(return_value=False))
    def test_request_with_blacklisted_ip(self):
        resp = self._postWithHeader({})
        assert resp.status_code == 403, (resp.status_code, resp.content)

    @pytest.mark.obsolete("Unit test in Relay", "relay-filter/releases.rs")
    @mock.patch("sentry.event_manager.is_valid_release", mock.Mock(return_value=False))
    def test_request_with_filtered_release(self):
        body = {
            "release": "abcdefg",
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"},
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 403, (resp.status_code, resp.content)

    @pytest.mark.obsolete("Unit test in Relay", "relay-filter/error_messages.rs")
    @mock.patch("sentry.event_manager.is_valid_error_message", mock.Mock(return_value=False))
    def test_request_with_filtered_error(self):
        body = {
            "release": "abcdefg",
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"},
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 403, (resp.status_code, resp.content)

    @pytest.mark.obsolete("Unit test in Relay", "relay-filter/client_ips.rs")
    def test_request_with_invalid_ip(self):
        self.project.update_option("sentry:blacklisted_ips", ["127.0.0.1"])
        body = {
            "release": "abcdefg",
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"},
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 403, (resp.status_code, resp.content)

    @pytest.mark.obsolete("Unit test in Relay", "relay-filter/releases.rs")
    def test_request_with_invalid_release(self):
        self.project.update_option(u"sentry:{}".format(FilterTypes.RELEASES), ["1.3.2"])
        body = {
            "release": "1.3.2",
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"},
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 403, (resp.status_code, resp.content)

    @pytest.mark.obsolete("Unit test in Relay", "relay-filter/releases.rs")
    def test_request_with_short_release_globbing(self):
        self.project.update_option(u"sentry:{}".format(FilterTypes.RELEASES), ["1.*"])
        body = {
            "release": "1.3.2",
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"},
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 403, (resp.status_code, resp.content)

    @pytest.mark.obsolete("Unit test in Relay", "relay-filter/releases.rs")
    def test_request_with_longer_release_globbing(self):
        self.project.update_option(u"sentry:{}".format(FilterTypes.RELEASES), ["2.1.*"])
        body = {
            "release": "2.1.3",
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"},
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 403, (resp.status_code, resp.content)

    def test_request_with_invalid_error_messages(self):
        self.project.update_option(
            u"sentry:{}".format(FilterTypes.ERROR_MESSAGES), ["ZeroDivisionError*"]
        )
        body = {
            "release": "abcdefg",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"},
            },
            "logentry": {
                "formatted": "ZeroDivisionError: integer division or modulo by zero",
                "message": "%s: integer division or modulo by zero",
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 403, (resp.status_code, resp.content)

    @pytest.mark.obsolete(
        "Moved to Relay", "tests/integration/test_basic.py::test_store_allowed_origins_passes"
    )
    @mock.patch("sentry.relay.config.get_origins")
    def test_request_with_bad_origin(self, get_origins):
        get_origins.return_value = ["foo.com"]

        body = {"logentry": {"formatted": "hello world"}}

        resp = self._postWithHeader(body, HTTP_ORIGIN="lolnope.com")
        assert resp.status_code == 403, (resp.status_code, resp.content)
        assert b"Invalid origin" in resp.content

    @pytest.mark.obsolete("Unit test in Relay", "relay-filter/error_messages.rs")
    def test_request_with_beginning_glob(self):
        self.project.update_option(
            u"sentry:{}".format(FilterTypes.ERROR_MESSAGES),
            ["*: integer division or modulo by zero"],
        )
        body = {
            "release": "abcdefg",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"},
            },
            "logentry": {
                "message": "ZeroDivisionError: integer division or modulo by zero",
                "formatted": "",
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 403, (resp.status_code, resp.content)

    @pytest.mark.obsolete("Unit test in Relay, PII/data scrubbing")
    @mock.patch("sentry.coreapi.ClientApiHelper.insert_data_to_database")
    def test_scrubs_ip_address(self, mock_insert_data_to_database):
        self.project.update_option("sentry:scrub_ip_address", True)
        body = {
            "message": "foo bar",
            "sdk": {"name": "sentry-browser", "version": "3.23.3", "client_ip": "127.0.0.1"},
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"},
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert not call_data["user"].get("ip_address")
        assert not call_data["request"]["env"].get("REMOTE_ADDR")
        assert not call_data["sdk"].get("client_ip")

    @pytest.mark.obsolete("Unit test in Relay, PII/data scrubbing")
    @mock.patch("sentry.coreapi.ClientApiHelper.insert_data_to_database")
    def test_scrubs_org_ip_address_override(self, mock_insert_data_to_database):
        self.organization.update_option("sentry:require_scrub_ip_address", True)
        self.project.update_option("sentry:scrub_ip_address", False)
        body = {
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "env": {"REMOTE_ADDR": "127.0.0.1"},
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert not call_data["user"].get("ip_address")
        assert not call_data["request"]["env"].get("REMOTE_ADDR")

    @pytest.mark.obsolete("Unit test in Relay, PII/data scrubbing")
    @mock.patch("sentry.coreapi.ClientApiHelper.insert_data_to_database")
    def test_scrub_data_off(self, mock_insert_data_to_database):
        self.project.update_option("sentry:scrub_data", False)
        self.project.update_option("sentry:scrub_defaults", False)
        body = {
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3",
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data["request"]["data"] == {
            "password": "lol",
            "foo": "1",
            "bar": "2",
            "baz": "3",
        }

    @pytest.mark.obsolete("Unit test in Relay, PII/data scrubbing")
    @mock.patch("sentry.coreapi.ClientApiHelper.insert_data_to_database")
    def test_scrub_data_on(self, mock_insert_data_to_database):
        self.project.update_option("sentry:scrub_data", True)
        self.project.update_option("sentry:scrub_defaults", False)
        body = {
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3",
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data["request"]["data"] == {
            "password": "lol",
            "foo": "1",
            "bar": "2",
            "baz": "3",
        }

    @pytest.mark.obsolete("Unit test in Relay, PII/data scrubbing")
    @mock.patch("sentry.coreapi.ClientApiHelper.insert_data_to_database")
    def test_scrub_data_defaults(self, mock_insert_data_to_database):
        self.project.update_option("sentry:scrub_data", True)
        self.project.update_option("sentry:scrub_defaults", True)
        body = {
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3",
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data["request"]["data"] == {
            "password": "[Filtered]",
            "foo": "1",
            "bar": "2",
            "baz": "3",
        }

    @pytest.mark.obsolete("Unit test in Relay, PII/data scrubbing")
    @mock.patch("sentry.coreapi.ClientApiHelper.insert_data_to_database")
    def test_scrub_data_sensitive_fields(self, mock_insert_data_to_database):
        self.project.update_option("sentry:scrub_data", True)
        self.project.update_option("sentry:scrub_defaults", True)
        self.project.update_option("sentry:sensitive_fields", ["foo", "bar"])
        body = {
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3",
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data["request"]["data"] == {
            "password": "[Filtered]",
            "foo": "[Filtered]",
            "bar": "[Filtered]",
            "baz": "3",
        }

    @pytest.mark.obsolete("Unit test in Relay, PII/data scrubbing")
    @mock.patch("sentry.coreapi.ClientApiHelper.insert_data_to_database")
    def test_scrub_data_org_override(self, mock_insert_data_to_database):
        self.organization.update_option("sentry:require_scrub_data", True)
        self.project.update_option("sentry:scrub_data", False)
        self.organization.update_option("sentry:require_scrub_defaults", True)
        self.project.update_option("sentry:scrub_defaults", False)
        body = {
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3",
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data["request"]["data"] == {
            "password": "[Filtered]",
            "foo": "1",
            "bar": "2",
            "baz": "3",
        }

    @pytest.mark.obsolete("Unit test in Relay, PII/data scrubbing")
    @mock.patch("sentry.coreapi.ClientApiHelper.insert_data_to_database")
    def test_scrub_data_org_override_sensitive_fields(self, mock_insert_data_to_database):
        self.organization.update_option("sentry:require_scrub_data", True)
        self.organization.update_option("sentry:require_scrub_defaults", True)
        self.organization.update_option("sentry:sensitive_fields", ["baz"])
        self.project.update_option("sentry:sensitive_fields", ["foo", "bar"])
        body = {
            "message": "foo bar",
            "user": {"ip_address": "127.0.0.1"},
            "request": {
                "method": "GET",
                "url": "http://example.com/",
                "data": "password=lol&foo=1&bar=2&baz=3",
            },
        }
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data["request"]["data"] == {
            "password": "[Filtered]",
            "foo": "[Filtered]",
            "bar": "[Filtered]",
            "baz": "[Filtered]",
        }

    @mock.patch("sentry.coreapi.ClientApiHelper.insert_data_to_database")
    def test_uses_client_as_sdk(self, mock_insert_data_to_database):
        body = {"message": "foo bar"}
        resp = self._postWithHeader(body)
        assert resp.status_code == 200, (resp.status_code, resp.content)

        call_data = mock_insert_data_to_database.call_args[0][0]
        assert call_data["sdk"] == {"name": "_postWithHeader", "version": "0.0.0"}

    @mock.patch("sentry.coreapi.ClientApiHelper.insert_data_to_database", Mock())
    def test_accepted_signal(self):
        mock_event_accepted = Mock()

        event_accepted.connect(mock_event_accepted)

        resp = self._postWithHeader({"logentry": {"message": u"hello"}})

        assert resp.status_code == 200, resp.content

        assert_mock_called_once_with_partial(
            mock_event_accepted, ip="127.0.0.1", project=self.project, signal=event_accepted
        )


class CrossDomainXmlTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-crossdomain-xml", kwargs={"project_id": self.project.id})

    @mock.patch("sentry.web.api.get_origins")
    def test_output_with_global(self, get_origins):
        get_origins.return_value = "*"
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        assert resp.status_code == 200, resp.content
        self.assertEquals(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert b'<allow-access-from domain="*" secure="false" />' in resp.content

    @mock.patch("sentry.web.api.get_origins")
    def test_output_with_allowed_origins(self, get_origins):
        get_origins.return_value = ["disqus.com", "www.disqus.com"]
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert b'<allow-access-from domain="disqus.com" secure="false" />' in resp.content
        assert b'<allow-access-from domain="www.disqus.com" secure="false" />' in resp.content

    @mock.patch("sentry.web.api.get_origins")
    def test_output_with_no_origins(self, get_origins):
        get_origins.return_value = []
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert b"<allow-access-from" not in resp.content

    def test_output_allows_x_sentry_auth(self):
        resp = self.client.get(self.path)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp["Content-Type"], "application/xml")
        self.assertTemplateUsed(resp, "sentry/crossdomain.xml")
        assert (
            b'<allow-http-request-headers-from domain="*" headers="*" secure="false" />'
            in resp.content
        )


class EventAttachmentStoreViewTest(TestCase):
    @fixture
    def path(self):
        # TODO: Having the event set here means the case where event isnt' created
        # yet isn't covered by this test class
        return reverse(
            "sentry-api-event-attachment",
            kwargs={"project_id": self.project.id, "event_id": self.event.event_id},
        )

    def has_attachment(self):
        return EventAttachment.objects.filter(
            project_id=self.project.id, event_id=self.event.event_id
        ).exists()

    def test_event_attachments_feature_creates_attachment(self):
        out = BytesIO()
        out.write(b"hi")
        with self.feature("organizations:event-attachments"):
            response = self._postEventAttachmentWithHeader(
                {
                    "attachment1": SimpleUploadedFile(
                        "mapping.txt", out.getvalue(), content_type="text/plain"
                    )
                },
                format="multipart",
            )

        assert response.status_code == 201
        assert self.has_attachment()

    def test_event_attachments_without_feature_returns_forbidden(self):
        out = BytesIO()
        out.write(b"hi")
        with self.feature({"organizations:event-attachments": False}):
            response = self._postEventAttachmentWithHeader(
                {
                    "attachment1": SimpleUploadedFile(
                        "mapping.txt", out.getvalue(), content_type="text/plain"
                    )
                },
                format="multipart",
            )

        assert response.status_code == 403
        assert not self.has_attachment()

    def test_event_attachments_without_files_returns_400(self):
        out = BytesIO()
        out.write(b"hi")
        with self.feature("organizations:event-attachments"):
            response = self._postEventAttachmentWithHeader({}, format="multipart")

        assert response.status_code == 400
        assert not self.has_attachment()

    def test_event_attachments_event_doesnt_exist_creates_attachment(self):
        with self.feature("organizations:event-attachments"):
            self.path = self.path.replace(self.event.event_id, "z" * 32)
            out = BytesIO()
            out.write(b"hi")
            response = self._postEventAttachmentWithHeader(
                {
                    "attachment1": SimpleUploadedFile(
                        "mapping.txt", out.getvalue(), content_type="text/plain"
                    )
                },
                format="multipart",
            )

        assert response.status_code == 201
        assert self.has_attachment()

    def test_event_attachments_event_empty_file_creates_attachment(self):
        with self.feature("organizations:event-attachments"):
            response = self._postEventAttachmentWithHeader(
                {
                    "attachment1": SimpleUploadedFile(
                        "mapping.txt", BytesIO().getvalue(), content_type="text/plain"
                    )
                },
                format="multipart",
            )

        assert response.status_code == 201
        assert self.has_attachment()


class RobotsTxtTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-robots-txt")

    def test_robots(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "text/plain"


def rate_limited_dispatch(*args, **kwargs):
    raise APIRateLimited(retry_after=42.42)


class APIViewTest(TestCase):
    @mock.patch("sentry.web.api.APIView._dispatch", new=rate_limited_dispatch)
    def test_retry_after_int(self):
        resp = self._postWithHeader({})
        assert resp["Retry-After"] == "43"


class ClientConfigViewTest(TestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-client-config")

    def test_unauthenticated(self):
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert not data["isAuthenticated"]
        assert data["user"] is None

    def test_authenticated(self):
        user = self.create_user("foo@example.com")
        self.login_as(user)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert data["isAuthenticated"]
        assert data["user"]
        assert data["user"]["email"] == user.email

    def test_superuser(self):
        user = self.create_user("foo@example.com", is_superuser=True)
        self.login_as(user, superuser=True)

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"

        data = json.loads(resp.content)
        assert data["isAuthenticated"]
        assert data["user"]
        assert data["user"]["email"] == user.email
        assert data["user"]["isSuperuser"]
