import logging
from collections.abc import Callable
from unittest import mock
from urllib.parse import quote, urlencode, urlparse
from uuid import uuid4

import pytest
from django.conf import settings
from django.http import HttpResponse, HttpResponseBase
from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import options
from sentry.feedback.endpoints.error_page_embed import ErrorEmbedResolver
from sentry.models.environment import Environment
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.models.userreport import UserReport
from sentry.silo.base import SiloLimit, SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.apigateway import ApiGatewayTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.response import close_streaming_response
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell, get_cell_by_name, get_local_locality
from sentry.utils import json


class ErrorPageEmbedTest(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.project = self.create_project()
        self.project.update_option("sentry:origins", ["example.com"])
        self.key = self.create_project_key(self.project)
        self.event_id = uuid4().hex
        self.path = reverse("sentry-error-page-embed")
        self.path_with_qs = (
            f"{self.path}?eventId={quote(self.event_id)}&dsn={quote(self.key.dsn_public)}"
        )

    def test_invalid_referer(self) -> None:
        resp = self.client.get(self.path_with_qs, HTTP_REFERER="http://foo.com")
        assert resp.status_code == 403, resp.content
        assert resp["Content-Type"] == "application/json"

    def test_invalid_origin(self) -> None:
        resp = self.client.get(self.path_with_qs, HTTP_ORIGIN="http://foo.com")
        assert resp.status_code == 403, resp.content
        assert resp["Content-Type"] == "application/json"

    def test_invalid_origin_respects_accept(self) -> None:
        resp = self.client.get(
            self.path_with_qs,
            HTTP_ORIGIN="http://foo.com",
            HTTP_ACCEPT="text/html, text/javascript",
        )
        assert resp.status_code == 403, resp.content
        assert resp["Content-Type"] == "text/javascript"

    def test_missing_eventId(self) -> None:
        path = f"{self.path}?dsn={quote(self.key.dsn_public)}"
        resp = self.client.get(
            path, HTTP_REFERER="http://example.com", HTTP_ACCEPT="text/html, text/javascript"
        )
        assert resp.status_code == 400, resp.content
        assert resp["Content-Type"] == "text/javascript"
        assert resp["X-Sentry-Context"] == '{"eventId":"Missing or invalid parameter."}'
        assert resp.content == b""

    def test_missing_dsn(self) -> None:
        path = f"{self.path}?eventId={quote(self.event_id)}"
        resp = self.client.get(
            path, HTTP_REFERER="http://example.com", HTTP_ACCEPT="text/html, text/javascript"
        )
        assert resp.status_code == 404, resp.content
        assert resp["Content-Type"] == "text/javascript"
        assert resp["X-Sentry-Context"] == '{"dsn":"Missing or invalid parameter."}'
        assert resp.content == b""

    def test_renders(self) -> None:
        resp = self.client.get(
            self.path_with_qs,
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="text/html, text/javascript",
        )
        assert resp.status_code == 200, resp.content
        assert resp["Access-Control-Allow-Origin"] == "*"
        self.assertTemplateUsed(resp, "sentry/error-page-embed.html")

    def test_endpoint_reflects_region_url(self) -> None:
        resp = self.client.get(
            self.path_with_qs,
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="text/html, text/javascript",
        )
        assert resp.status_code == 200, resp.content
        assert resp["Access-Control-Allow-Origin"] == "*"
        self.assertTemplateUsed(resp, "sentry/error-page-embed.html")

        region_url = get_local_locality().to_url(self.path_with_qs)
        body = resp.content.decode("utf8")
        assert f'endpoint = /**/"{region_url}";/**/' in body

    def test_uses_locale_from_header(self) -> None:
        resp = self.client.get(
            self.path_with_qs,
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT_LANGUAGE="fr",
            HTTP_ACCEPT="text/html, text/javascript",
        )
        assert resp.status_code == 200, resp.content
        self.assertTemplateUsed(resp, "sentry/error-page-embed.html")
        assert b"Fermer" in resp.content  # Close

    def test_xss(self) -> None:
        user_feedback_options = {}

        option_keys = [
            "errorFormEntry",
            "successMessage",
            "errorGeneric",
            "title",
            "subtitle",
            "subtitle2",
            "labelName",
            "labelEmail",
            "labelComments",
            "labelSubmit",
            "labelClose",
        ]
        for key in option_keys:
            user_feedback_options[key] = f"<img src=x onerror=alert({key})>XSS_{key}".encode()

        user_feedback_options_qs = urlencode(user_feedback_options)
        path_with_qs = f"{self.path}?eventId={quote(self.event_id)}&dsn={quote(self.key.dsn_public)}&{user_feedback_options_qs}"
        resp = self.client.get(
            path_with_qs,
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="text/html, text/javascript",
        )
        assert resp.status_code == 200, resp.content
        self.assertTemplateUsed(resp, "sentry/error-page-embed.html")

        for xss_payload in user_feedback_options.values():
            assert xss_payload not in resp.content

    def test_submission(self) -> None:
        resp = self.client.post(
            self.path_with_qs,
            {"name": "Jane Bloggs", "email": "jane@example.com", "comments": "This is an example!"},
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert resp.status_code == 200, resp.content

        report = UserReport.objects.get()
        assert report.name == "Jane Bloggs"
        assert report.email == "jane@example.com"
        assert report.comments == "This is an example!"
        assert report.event_id == self.event_id
        assert report.project_id == self.project.id
        assert report.group_id is None

        resp = self.client.post(
            self.path_with_qs,
            {"name": "Joe Shmoe", "email": "joe@example.com", "comments": "haha I updated it!"},
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert resp.status_code == 200, resp.content

        report = UserReport.objects.get()
        assert report.name == "Joe Shmoe"
        assert report.email == "joe@example.com"
        assert report.comments == "haha I updated it!"
        assert report.event_id == self.event_id
        assert report.project_id == self.project.id
        assert report.group_id is None

    def test_submission_invalid_event_id(self) -> None:
        self.event_id = "x" * 100
        path = f"{self.path}?eventId={quote(self.event_id)}&dsn={quote(self.key.dsn_public)}"

        resp = self.client.post(
            path,
            {"name": "Jane Bloggs", "email": "jane@example.com", "comments": "This is an example!"},
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert resp.status_code == 400, resp.content

    def test_submission_message_too_large(self) -> None:
        resp = self.client.post(
            self.path_with_qs,
            {"name": "Jane Bloggs", "email": "jane@example.com", "comments": "a" * 9001},
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert resp.status_code == 400, resp.content
        assert not UserReport.objects.exists()


class ErrorPageEmbedEnvironmentTest(TestCase):
    def setUp(self) -> None:
        self.project = self.create_project()
        self.project.update_option("sentry:origins", ["example.com"])
        self.key = self.create_project_key(self.project)
        self.event_id = uuid4().hex
        self.path = "{}?eventId={}&dsn={}".format(
            reverse("sentry-error-page-embed"),
            quote(self.event_id),
            quote(self.key.dsn_public),
        )
        self.environment = Environment.objects.create(
            organization_id=self.project.organization_id,
            name="production",
        )
        self.environment.add_project(self.project)

    def make_event(self, **kwargs):
        min_ago = before_now(minutes=1).isoformat()
        result = {
            "event_id": "a" * 32,
            "message": "foo",
            "timestamp": min_ago,
            "level": logging.ERROR,
            "logger": "default",
            "tags": [],
        }
        result.update(kwargs)
        return self.store_event(data=result, project_id=self.project.id, assert_no_errors=False)

    def test_environment_gets_user_report(self) -> None:
        self.make_event(environment=self.environment.name, event_id=self.event_id)
        self.login_as(user=self.user)
        response = self.client.post(
            self.path,
            {"name": "Jane Bloggs", "email": "jane@example.com", "comments": "This is an example!"},
            HTTP_REFERER="http://example.com",
        )

        assert response.status_code == 200, response.content
        assert UserReport.objects.get(event_id=self.event_id).environment_id == self.environment.id

    @mock.patch("sentry.feedback.usecases.ingest.create_feedback.produce_occurrence_to_kafka")
    def test_calls_feedback_shim_if_ff_enabled(
        self, mock_produce_occurrence_to_kafka: mock.MagicMock
    ) -> None:
        self.make_event(environment=self.environment.name, event_id=self.event_id)
        self.client.post(
            self.path,
            {
                "name": "Jane Bloggs",
                "email": "jane@example.com",
                "comments": "This is an example!",
            },
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 1
        mock_event_data = mock_produce_occurrence_to_kafka.call_args_list[0][1]["event_data"]
        assert mock_event_data["contexts"]["feedback"]["contact_email"] == "jane@example.com"
        assert mock_event_data["contexts"]["feedback"]["message"] == "This is an example!"
        assert mock_event_data["contexts"]["feedback"]["name"] == "Jane Bloggs"
        assert mock_event_data["platform"] == "other"
        assert mock_event_data["contexts"]["feedback"]["associated_event_id"] == self.event_id
        assert mock_event_data["level"] == "error"

    @mock.patch("sentry.feedback.usecases.ingest.create_feedback.produce_occurrence_to_kafka")
    def test_does_not_call_feedback_shim_no_event_if_ff_enabled(
        self, mock_produce_occurrence_to_kafka
    ):
        self.client.post(
            self.path,
            {
                "name": "Jane Bloggs",
                "email": "jane@example.com",
                "comments": "This is an example!",
            },
            HTTP_REFERER="http://example.com",
            HTTP_ACCEPT="application/json",
        )
        assert len(mock_produce_occurrence_to_kafka.mock_calls) == 0


def _get_incr_calls(mock_metrics: mock.MagicMock) -> set[tuple[str, tuple[tuple[str, str], ...]]]:
    return {
        (args[0], tuple(sorted(kwargs["tags"].items())))
        for args, kwargs in mock_metrics.incr.call_args_list
    }


@control_silo_test(cells=[ApiGatewayTestCase.CELL])
class ErrorEmbedCellProxyTest(ApiGatewayTestCase):
    def _create_project_key_with_mapping(self) -> ProjectKey:
        with outbox_runner():
            project_key = self.create_project_key(self.project)

        return project_key

    def test_proxy_error_embed_dsn(self) -> None:
        self.httpx_router.add(
            "GET",
            f"{self.CELL.address}/api/embed/error-page/",
            json_data={"proxy": True, "name": "error-embed"},
        )
        with override_settings(MIDDLEWARE=tuple(self.middleware), ROOT_URLCONF="sentry.web.urls"):
            # no dsn
            with pytest.raises(SiloLimit.AvailabilityError):
                self.client.get("/api/embed/error-page/")

            # invalid dsn
            with pytest.raises(SiloLimit.AvailabilityError):
                self.client.get("/api/embed/error-page/", data={"dsn": "lolnope"})

            # invalid DSN that doesn't match our domain
            with pytest.raises(SiloLimit.AvailabilityError):
                self.client.get(
                    "/api/embed/error-page/", data={"dsn": "https://abc123@nope.com/123"}
                )

            # Older DSN with no region -> monolith region
            resp = self.client.get(
                "/api/embed/error-page/", data={"dsn": "https://abc123@testserver/123"}
            )
            assert resp.status_code == 200
            self._check_response(resp, "error-embed")

            # DSN with o123.ingest.sentry.io style hosts
            resp = self.client.get(
                "/api/embed/error-page/", data={"dsn": "https://abc123@o123.ingest.testserver/123"}
            )
            assert resp.status_code == 200
            self._check_response(resp, "error-embed")

            # DSN with o123.ingest.us.sentry.io style hosts
            resp = self.client.get(
                "/api/embed/error-page/",
                data={"dsn": "https://abc123@o123.ingest.us.testserver/123"},
            )
            assert resp.status_code == 200
            self._check_response(resp, "error-embed")

            # DSN with o123.ingest.us.sentry.io style hosts with a garbage region
            with pytest.raises(SiloLimit.AvailabilityError):
                self.client.get(
                    "/api/embed/error-page/",
                    data={"dsn": "https://abc123@o123.ingest.zz.testserver/123"},
                )

    @staticmethod
    def _check_response(resp: Response, expected_name: str) -> None:
        if SiloMode.get_current_mode() == SiloMode.MONOLITH:
            assert resp.status_code == 401
            return
        assert resp.status_code == 200
        resp_json = json.loads(close_streaming_response(resp))
        assert resp_json["proxy"] is True
        assert resp_json["name"] == expected_name


SECONDARY_CELL = Cell(
    name="eu",
    snowflake_id=2,
    address="http://eu.internal.sentry.io",
)


@control_silo_test(cells=[ApiGatewayTestCase.CELL, SECONDARY_CELL])
class ErrorEmbedCellResolverTest(ApiGatewayTestCase):
    def create_project_data(self, cell_name: str) -> tuple[Organization, Project, ProjectKey]:
        organization = self.create_organization(cell=cell_name)
        project = self.create_project(organization=organization)
        project_key = self.create_project_key(project)
        return organization, project, project_key

    def setUp(self) -> None:
        super().setUp()
        self.primary_organization, self.primary_project, self.primary_key = (
            self.create_project_data(ApiGatewayTestCase.CELL.name)
        )
        self.secondary_organization, self.secondary_project, self.secondary_key = (
            self.create_project_data(SECONDARY_CELL.name)
        )

    @property
    def app_host(self) -> str:
        return urlparse(options.get("system.url-prefix")).netloc

    def _cell_dsn(self, project_key: ProjectKey, cell: Cell, port: int | None = None) -> str:
        """Build a cell-style ingest DSN (``o{org_id}.ingest.{cell}.{app_host}``)."""
        org_id = project_key.project.organization_id
        host = f"o{org_id}.ingest.{cell.name}.{self.app_host}"
        if port is not None:
            host = f"{host}:{port}"
        return f"https://{project_key.public_key}@{host}/{project_key.project_id}"

    def _resolve(self, dsn: str | None) -> Cell | None:
        params = {"dsn": dsn} if dsn is not None else {}
        request = Request(RequestFactory().get("/api/embed/error-page/", params))
        view_func: Callable[..., HttpResponseBase] = mock.Mock(return_value=HttpResponse())
        return ErrorEmbedResolver().resolve(request, view_func, {})

    def test_resolver_selects_correct_cell(self) -> None:
        primary_dsn = self._cell_dsn(self.primary_key, ApiGatewayTestCase.CELL)
        assert self._resolve(primary_dsn) == ApiGatewayTestCase.CELL

        secondary_dsn = self._cell_dsn(self.secondary_key, SECONDARY_CELL)
        assert self._resolve(secondary_dsn) == SECONDARY_CELL

    def test_resolver_returns_none_for_unroutable_requests(self) -> None:
        # No dsn supplied at all.
        assert self._resolve(None) is None

        # A dsn with no usable host.
        assert self._resolve("lolnope") is None

        # A dsn for a host that isn't ours.
        foreign_dsn = f"https://{self.primary_key.public_key}@o1.ingest.us.example.com/1"
        assert self._resolve(foreign_dsn) is None

        # A valid host shape but an unknown cell segment.
        unknown_cell_dsn = f"https://{self.primary_key.public_key}@o1.ingest.zz.{self.app_host}/1"
        assert self._resolve(unknown_cell_dsn) is None

    def test_resolver_ignores_port_when_extracting_host(self) -> None:
        dsn = self._cell_dsn(self.primary_key, ApiGatewayTestCase.CELL, port=9000)
        assert self._resolve(dsn) == ApiGatewayTestCase.CELL

    def test_resolver_falls_back_to_monolith_region(self) -> None:
        monolith_cell = get_cell_by_name(settings.SENTRY_MONOLITH_REGION)

        # Bare app host with no cell/ingest segments.
        bare_dsn = f"https://{self.primary_key.public_key}@{self.app_host}/1"
        assert self._resolve(bare_dsn) == monolith_cell

        # Older ingest host that omits the cell segment.
        no_cell_dsn = f"https://{self.primary_key.public_key}@o1.ingest.{self.app_host}/1"
        assert self._resolve(no_cell_dsn) == monolith_cell
