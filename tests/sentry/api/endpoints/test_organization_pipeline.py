from __future__ import annotations

from collections.abc import Sequence
from functools import cached_property
from typing import Any, Never
from unittest.mock import patch

import responses
from django.http import HttpResponse
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.urls import reverse

from sentry.integrations.pipeline import IntegrationPipeline
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.pipeline.base import Pipeline
from sentry.pipeline.provider import PipelineProvider
from sentry.pipeline.store import PipelineSessionStore
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineEndpoint, PipelineView
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


class DummyStep:
    def dispatch(self, request: HttpRequest, pipeline: Any) -> HttpResponseBase:
        return HttpResponse("ok")


class DummyApiStep:
    step_name = "pick_thing"

    def get_step_data(self, pipeline: DummyPipeline, request: HttpRequest) -> dict[str, Any]:
        return {"options": ["a", "b"]}

    def get_serializer_cls(self) -> type | None:
        return None

    def handle_post(
        self, validated_data: Any, pipeline: DummyPipeline, request: HttpRequest
    ) -> PipelineStepResult:
        pipeline.bind_state("thing", validated_data.get("thing", "a"))
        return PipelineStepResult.advance()


class DummyProvider(PipelineProvider["DummyPipeline"]):
    key = "dummy"
    name = "Dummy"

    def get_pipeline_views(self) -> Sequence[DummyStep]:
        return [DummyStep()]

    def get_pipeline_api_steps(self) -> Sequence[ApiPipelineEndpoint[DummyPipeline]]:
        return [DummyApiStep()]


class DummyPipeline(Pipeline[Never, PipelineSessionStore]):
    """A single-step pipeline that supports API mode."""

    pipeline_name = "test_dummy_pipeline"

    @cached_property
    def provider(self) -> DummyProvider:
        ret = DummyProvider()
        ret.set_pipeline(self)
        ret.update_config(self.config)
        return ret

    def get_pipeline_views(self) -> Sequence[DummyStep]:
        return self.provider.get_pipeline_views()

    def get_pipeline_api_steps(self) -> Sequence[ApiPipelineEndpoint[DummyPipeline]] | None:
        return self.provider.get_pipeline_api_steps()

    def finish_pipeline(self) -> HttpResponseBase:
        return HttpResponse("done")

    def api_finish_pipeline(self) -> PipelineStepResult:
        return PipelineStepResult.complete(data={"thing": self.fetch_state("thing")})


class NonApiProvider(PipelineProvider["NonApiPipeline"]):
    key = "non_api"
    name = "Non-API"

    def get_pipeline_views(self) -> Sequence[PipelineView[NonApiPipeline]]:
        return [DummyStep()]


class NonApiPipeline(Pipeline[Never, PipelineSessionStore]):
    """A pipeline that does NOT support API mode (no get_pipeline_api_steps)."""

    pipeline_name = "test_non_api_pipeline"

    @cached_property
    def provider(self) -> NonApiProvider:
        ret = NonApiProvider()
        ret.set_pipeline(self)
        ret.update_config(self.config)
        return ret

    def get_pipeline_views(self) -> Sequence[PipelineView[NonApiPipeline]]:
        return self.provider.get_pipeline_views()

    def finish_pipeline(self) -> HttpResponseBase:
        return HttpResponse("done")


@control_silo_test
class OrganizationPipelineEndpointTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)

    def _get_pipeline_url(self, pipeline_name: str | None = None) -> str:
        return reverse(
            self.endpoint,
            args=[
                self.organization.slug,
                pipeline_name or IntegrationPipeline.pipeline_name,
            ],
        )

    def _init_pipeline_in_session(
        self, pipeline_cls: type[Pipeline], provider_key: str = "dummy"
    ) -> Pipeline:
        """Create and initialize a pipeline, storing it in the test client's session."""
        with assume_test_silo_mode(SiloMode.CELL):
            rpc_org = serialize_rpc_organization(self.organization)

        # Use make_request so the request shares the test client's session
        request = self.make_request(self.user)
        pipeline = pipeline_cls(request=request, organization=rpc_org, provider_key=provider_key)
        pipeline.initialize()
        self.save_session()
        return pipeline

    @responses.activate
    def test_initialize_missing_provider(self) -> None:
        resp = self.client.post(
            self._get_pipeline_url(),
            data={"action": "initialize"},
            format="json",
        )
        assert resp.status_code == 400
        assert "provider is required" in resp.data["detail"]

    @responses.activate
    def test_initialize_invalid_provider(self) -> None:
        resp = self.client.post(
            self._get_pipeline_url(),
            data={"action": "initialize", "provider": "nonexistent"},
            format="json",
        )
        assert resp.status_code == 404
        assert "Unknown provider" in resp.data["detail"]

    @responses.activate
    def test_initialize_wrong_pipeline_name(self) -> None:
        resp = self.client.post(
            self._get_pipeline_url("identity_pipeline"),
            data={"action": "initialize", "provider": "github"},
            format="json",
        )
        assert resp.status_code == 400
        assert "Initialization not supported" in resp.data["detail"]

    @responses.activate
    def test_get_no_active_session(self) -> None:
        resp = self.client.get(self._get_pipeline_url())
        assert resp.status_code == 404
        assert "No active pipeline session" in resp.data["detail"]

    @responses.activate
    def test_post_no_active_session(self) -> None:
        resp = self.client.post(
            self._get_pipeline_url(),
            data={"code": "abc", "state": "xyz"},
            format="json",
        )
        assert resp.status_code == 404
        assert "No active pipeline session" in resp.data["detail"]

    @responses.activate
    @patch(
        "sentry.api.endpoints.organization_pipeline.PIPELINE_CLASSES",
        (DummyPipeline,),
    )
    def test_get_step_info(self) -> None:
        self._init_pipeline_in_session(DummyPipeline)
        url = self._get_pipeline_url(DummyPipeline.pipeline_name)

        resp = self.client.get(url)
        assert resp.status_code == 200
        assert resp.data["step"] == "pick_thing"
        assert resp.data["stepIndex"] == 0
        assert resp.data["totalSteps"] == 1
        assert resp.data["provider"] == "dummy"
        assert resp.data["data"] == {"options": ["a", "b"]}

    @responses.activate
    @patch(
        "sentry.api.endpoints.organization_pipeline.PIPELINE_CLASSES",
        (DummyPipeline,),
    )
    def test_post_advance_completes_single_step_pipeline(self) -> None:
        self._init_pipeline_in_session(DummyPipeline)
        url = self._get_pipeline_url(DummyPipeline.pipeline_name)

        resp = self.client.post(url, data={"thing": "b"}, format="json")
        assert resp.status_code == 200
        assert resp.data["status"] == "complete"
        assert resp.data["data"] == {"thing": "b"}

    @responses.activate
    @patch(
        "sentry.api.endpoints.organization_pipeline.PIPELINE_CLASSES",
        (NonApiPipeline,),
    )
    def test_get_non_api_pipeline_returns_400(self) -> None:
        self._init_pipeline_in_session(NonApiPipeline, provider_key="non_api")
        url = self._get_pipeline_url(NonApiPipeline.pipeline_name)

        resp = self.client.get(url)
        assert resp.status_code == 400
        assert "Pipeline does not support API mode" in resp.data["detail"]

    @responses.activate
    @patch(
        "sentry.api.endpoints.organization_pipeline.PIPELINE_CLASSES",
        (NonApiPipeline,),
    )
    def test_post_non_api_pipeline_returns_400(self) -> None:
        self._init_pipeline_in_session(NonApiPipeline, provider_key="non_api")
        url = self._get_pipeline_url(NonApiPipeline.pipeline_name)

        resp = self.client.post(url, data={"thing": "a"}, format="json")
        assert resp.status_code == 400
        assert "Pipeline does not support API mode" in resp.data["detail"]

    @responses.activate
    def test_get_unknown_pipeline_name(self) -> None:
        resp = self.client.get(self._get_pipeline_url("totally_fake_pipeline"))
        assert resp.status_code == 404
        assert "Invalid pipeline type" in resp.data["detail"]

    @responses.activate
    @patch(
        "sentry.api.endpoints.organization_pipeline.PIPELINE_CLASSES",
        (DummyPipeline,),
    )
    @patch.object(
        DummyApiStep,
        "handle_post",
        return_value=PipelineStepResult.error("Something went wrong"),
    )
    def test_post_step_error_returns_400(self, mock_handle_post: Any) -> None:
        self._init_pipeline_in_session(DummyPipeline)
        url = self._get_pipeline_url(DummyPipeline.pipeline_name)

        resp = self.client.post(url, data={"thing": "a"}, format="json")
        assert resp.status_code == 400
        assert resp.data["status"] == "error"
        assert resp.data["data"]["detail"] == "Something went wrong"
