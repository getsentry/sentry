from __future__ import annotations

from unittest import mock

import responses
from django.core.handlers.wsgi import WSGIRequest
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.test import RequestFactory, override_settings
from django.urls import reverse
from rest_framework import status

from fixtures.gitea import (
    BASE_URL,
    EXTERNAL_ID,
    INSTANCE,
    REPO_ID,
    WEBHOOK_SECRET,
    push_event,
    webhook_url,
)
from sentry.integrations.models.integration import Integration
from sentry.middleware.integrations.parsers.gitea import GiteaRequestParser
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.cell import override_cells
from sentry.testutils.outbox import assert_no_webhook_payloads, assert_webhook_payloads_for_mailbox
from sentry.testutils.silo import control_silo_test
from sentry.types.cell import Cell

cell = Cell("us", 1, "https://us.testserver")
other_cell = Cell("de", 2, "https://de.testserver")
cell_config = (cell, other_cell)


@control_silo_test
class GiteaRequestParserTest(TestCase):
    factory = RequestFactory()

    def get_response(self, req: HttpRequest) -> HttpResponse:
        return HttpResponse(status=200, content="passthrough")

    def get_integration(self) -> Integration:
        self.organization = self.create_organization(owner=self.user, cell="us")
        return self.create_integration(
            organization=self.organization,
            provider="gitea",
            name=INSTANCE,
            external_id=EXTERNAL_ID,
            metadata={
                "instance": INSTANCE,
                "domain_name": INSTANCE,
                "base_url": BASE_URL,
                "verify_ssl": True,
                "webhook_secret": WEBHOOK_SECRET,
            },
        )

    def _delivery(self, path: str, event: str = "push") -> WSGIRequest:
        return self.factory.post(
            path,
            data=push_event(),
            content_type="application/json",
            HTTP_X_GITEA_EVENT=event,
        )

    def run_parser(self, request: WSGIRequest) -> HttpResponseBase:
        parser = GiteaRequestParser(request=request, response_handler=self.get_response)
        return parser.get_response()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_routing_webhook_with_cells(self) -> None:
        integration = self.get_integration()
        request = self._delivery(webhook_url(self.organization.id, integration.id))

        response = self.run_parser(request)

        assert response.status_code == status.HTTP_202_ACCEPTED
        # Queued rather than handled inline, which is what keeps us inside
        # Gitea's 5 second delivery timeout.
        assert len(responses.calls) == 0
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"gitea:{integration.id}",
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_routing_uses_the_organization_in_the_path(self) -> None:
        """
        One integration installed on two organizations in two different cells.

        Only the organization named in the URL should receive the delivery -
        the shared `Integration` row must not fan the payload out to every
        organization that installed the same OAuth app.
        """
        integration = self.get_integration()
        other_org = self.create_organization(owner=self.create_user(), cell="de")
        integration.add_organization(other_org)

        request = self._delivery(webhook_url(other_org.id, integration.id))
        response = self.run_parser(request)

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"gitea:{integration.id}",
            cell_names=[other_cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_routing_webhook_with_mailbox_buckets(self) -> None:
        integration = self.get_integration()
        request = self._delivery(webhook_url(self.organization.id, integration.id))

        with mock.patch(
            "sentry.integrations.middleware.hybrid_cloud.parser.ratelimiter.is_limited"
        ) as mock_is_limited:
            mock_is_limited.return_value = True
            response = self.run_parser(request)

        assert response.status_code == status.HTTP_202_ACCEPTED
        # Gitea hooks are per-repository, so a busy instance shards by repo.
        assert_webhook_payloads_for_mailbox(
            request=request,
            mailbox_name=f"gitea:{integration.id}:{REPO_ID}",
            cell_names=[cell.name],
        )

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_unknown_organization_falls_through(self) -> None:
        integration = self.get_integration()
        response = self.run_parser(
            self._delivery(webhook_url(self.organization.id + 999, integration.id))
        )

        # No mapping means no cell to forward to, so hand it to the control
        # silo rather than guessing.
        assert response.status_code == status.HTTP_200_OK
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_non_numeric_organization_id_falls_through(self) -> None:
        integration = self.get_integration()
        response = self.run_parser(
            self._delivery(f"/extensions/gitea/organizations/nope/webhook/{integration.id}/")
        )

        # A non-numeric id raises ValueError rather than DoesNotExist; both
        # have to land here rather than as a 500.
        assert response.status_code == status.HTTP_200_OK
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    @responses.activate
    def test_routing_issue_search_to_the_control_silo(self) -> None:
        integration = self.get_integration()
        path = reverse(
            "sentry-extensions-gitea-search",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "integration_id": integration.id,
            },
        )
        request = self.factory.get(path)
        parser = GiteaRequestParser(request=request, response_handler=self.get_response)

        response = parser.get_response()

        # Only webhook deliveries are forwarded to a cell; the search endpoint
        # is served where it is defined.
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response, HttpResponse)
        assert response.content == b"passthrough"
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_unknown_integration(self) -> None:
        integration = self.get_integration()
        response = self.run_parser(
            self._delivery(webhook_url(self.organization.id, integration.id + 999))
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert_no_webhook_payloads()

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_get_integration_from_request(self) -> None:
        integration = self.get_integration()
        parser = GiteaRequestParser(
            request=self._delivery(webhook_url(self.organization.id, integration.id)),
            response_handler=self.get_response,
        )

        assert parser.get_integration_from_request() == integration

    @override_settings(SILO_MODE=SiloMode.CONTROL)
    @override_cells(cell_config)
    def test_get_integration_from_request_non_json(self) -> None:
        integration = self.get_integration()
        request = self.factory.post(
            webhook_url(self.organization.id, integration.id),
            data="ref=refs/heads/main",
            content_type="application/x-www-form-urlencoded",
            HTTP_X_GITEA_EVENT="push",
        )
        parser = GiteaRequestParser(request=request, response_handler=self.get_response)

        assert parser.get_integration_from_request() is None
