import pytest
from django.test import override_settings
from django.urls import reverse

from sentry.testutils.cases import APITestCase, SnubaTestCase, SpanTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.helpers.features import with_feature
from sentry.viewer_context import Actor, ActorType, ViewerContext, encode_viewer_context


class OrganizationSamplingEffectiveSampleRateEndpointTest(APITestCase, SnubaTestCase, SpanTestCase):
    endpoint = "sentry-api-0-organization-sampling-effective-sample-rate"
    method = "GET"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(user=self.user)

    def test_without_feature(self) -> None:
        self.get_error_response(self.organization.slug, status_code=404)

    def test_get(self) -> None:
        project = self.create_project(teams=[self.team])

        # One stored segment sampled at 1/2 extrapolates to 2 received segments → rate = 1/2
        self.store_spans(
            [
                self.create_span(
                    {"is_segment": True},
                    organization=self.organization,
                    project=project,
                    start_ts=before_now(minutes=15),
                    measurements={"server_sample_rate": {"value": 0.5}},
                )
            ]
        )

        with self.feature("organizations:dynamic-sampling"):
            response = self.get_success_response(self.organization.slug)

        assert response.data == {"eapEffectiveSampleRate": pytest.approx(0.5, rel=1e-6)}

    def test_no_data(self) -> None:
        self.create_project(teams=[self.team])

        with self.feature("organizations:dynamic-sampling"):
            response = self.get_success_response(self.organization.slug)

        assert response.data == {"eapEffectiveSampleRate": None}

    @pytest.mark.xfail(
        strict=True,
        reason="Known gap: the rate covers every project in the org, not only the service account's projects.",
    )
    @override_settings(SEER_API_SHARED_SECRET="service-account-secret")
    @with_feature(["organizations:service-accounts", "organizations:dynamic-sampling"])
    def test_service_account_rate_covers_only_linked_projects(self) -> None:
        linked = self.create_project(teams=[self.team])
        unlinked = self.create_project(teams=[self.team])
        # Linked: 1 received, 1 stored. Unlinked: 4 received, 1 stored.
        self.store_spans(
            [
                self.create_span(
                    {"is_segment": True},
                    organization=self.organization,
                    project=linked,
                    start_ts=before_now(minutes=15),
                    measurements={"server_sample_rate": {"value": 1.0}},
                ),
                self.create_span(
                    {"is_segment": True},
                    organization=self.organization,
                    project=unlinked,
                    start_ts=before_now(minutes=15),
                    measurements={"server_sample_rate": {"value": 0.25}},
                ),
            ]
        )
        service_account = self.create_service_account(
            organization=self.organization, scope_list=["org:read"], project_ids=[linked.id]
        )
        viewer_context = encode_viewer_context(
            ViewerContext(
                actor=Actor(type=ActorType.SERVICE_ACCOUNT, actor_id=service_account.id),
                organization_id=self.organization.id,
            ),
            key="service-account-secret",
        )

        response = self.client.get(
            reverse(self.endpoint, args=[self.organization.slug]),
            HTTP_X_VIEWER_CONTEXT=viewer_context,
        )

        assert response.status_code == 200, response.content
        assert response.data == {"eapEffectiveSampleRate": pytest.approx(1.0, rel=1e-6)}
