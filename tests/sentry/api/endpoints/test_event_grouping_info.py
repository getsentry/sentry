from unittest import mock

import orjson
import pytest
from django.urls import reverse

from sentry.api.exceptions import ResourceDoesNotExist
from sentry.grouping.grouping_info import get_grouping_info
from sentry.testutils.cases import APITestCase, PerformanceIssueTestCase
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


class EventGroupingInfoEndpointTestCase(APITestCase, PerformanceIssueTestCase):
    def setUp(self):
        self.login_as(user=self.user)

        self.team = self.create_team(
            organization=self.organization, slug="tiger-team", members=[self.user]
        )

        self.project = self.create_project(
            organization=self.organization, teams=[self.team], slug="bengal"
        )

    def test_error_event(self):
        data = load_data(platform="javascript")
        event = self.store_event(data=data, project_id=self.project.id)

        url = reverse(
            "sentry-api-0-event-grouping-info",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": event.event_id,
            },
        )

        response = self.client.get(url, format="json")
        content = orjson.loads(response.content)

        assert response.status_code == 200
        assert content["system"]["type"] == "component"

    def test_transaction_event(self):
        data = load_data(platform="transaction")
        event = self.store_event(data=data, project_id=self.project.id)

        url = reverse(
            "sentry-api-0-event-grouping-info",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": event.event_id,
            },
        )

        response = self.client.get(url, format="json")
        content = orjson.loads(response.content)

        assert response.status_code == 200
        assert content == {}

    @pytest.mark.skip("We no longer return perf issue info from the grouping info endpoint")
    def test_transaction_event_with_problem(self):
        event = self.create_performance_issue()
        url = reverse(
            "sentry-api-0-event-grouping-info",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": event.event_id,
            },
        )

        response = self.client.get(url, format="json")
        content = orjson.loads(response.content)

        assert response.status_code == 200
        assert content["performance_n_plus_one_db_queries"]["type"] == "performance-problem"
        assert content["performance_n_plus_one_db_queries"]["evidence"]["parent_span_hashes"] == [
            "6a992d5529f459a4"
        ]
        assert content["performance_n_plus_one_db_queries"]["evidence"]["offender_span_hashes"] == [
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
            "d74ed7012596c3fb",
        ]

    def test_no_event(self):
        url = reverse(
            "sentry-api-0-event-grouping-info",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": "fake-event-id",
            },
        )

        response = self.client.get(url, format="json")

        assert response.exception is True
        assert response.status_code == 404
        assert response.status_text == "Not Found"

    def test_get_grouping_info_unkown_grouping_config(self):
        data = load_data(platform="javascript")
        event = self.store_event(data=data, project_id=self.project.id)

        with pytest.raises(ResourceDoesNotExist):
            get_grouping_info("fake-config", self.project, event)

    @mock.patch("sentry.grouping.grouping_info.logger")
    @mock.patch("sentry.grouping.grouping_info.metrics")
    def test_get_grouping_info_hash_mismatch(self, mock_metrics, mock_logger):
        # Make a Python event
        data = load_data(platform="python")
        python_event = self.store_event(data=data, project_id=self.project.id)
        python_grouping_variants = python_event.get_grouping_variants(
            force_config=None, normalize_stacktraces=True
        )
        # Delete all grouping variants but system
        del python_grouping_variants["app"]
        del python_grouping_variants["default"]

        # Make a Javascript event
        data = load_data(platform="javascript")
        javascript_event = self.store_event(data=data, project_id=self.project.id)
        # Force a hash mismatch by setting the variants to be for the python event
        with mock.patch(
            "sentry.eventstore.models.BaseEvent.get_grouping_variants"
        ) as mock_get_grouping_variants:
            mock_get_grouping_variants.return_value = python_grouping_variants
            get_grouping_info(None, self.project, javascript_event)

        mock_metrics.incr.assert_called_with("event_grouping_info.hash_mismatch")
        mock_logger.error.assert_called_with(
            "event_grouping_info.hash_mismatch",
            extra={"project_id": self.project.id, "event_id": javascript_event.event_id},
        )

    def test_variant_keys_and_types_use_dashes_not_underscores(self):
        """
        Test to make sure switching to using underscores on the BE doesn't change what we send
        to the FE.
        """
        data = load_data(platform="javascript")
        data["fingerprint"] = ["dogs are great"]
        event = self.store_event(data=data, project_id=self.project.id)

        url = reverse(
            "sentry-api-0-event-grouping-info",
            kwargs={
                "organization_id_or_slug": self.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": event.event_id,
            },
        )

        response = self.client.get(url, format="json")
        content = orjson.loads(response.content)

        assert response.status_code == 200

        assert "custom-fingerprint" in content
        assert "custom_fingerprint" not in content

        assert content["custom-fingerprint"]["key"] == "custom-fingerprint"
        assert content["custom-fingerprint"]["type"] == "custom-fingerprint"
