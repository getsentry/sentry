from __future__ import annotations

from collections.abc import Sequence
from functools import cached_property
from typing import Any, Never
from unittest.mock import patch

import orjson
import responses
from django.http import HttpResponse
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.urls import reverse
from rest_framework.serializers import CharField

from sentry.api.serializers.rest_framework.base import CamelSnakeSerializer
from sentry.integrations.models.organization_integration import OrganizationIntegration
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.pipeline.base import Pipeline
from sentry.pipeline.provider import PipelineProvider
from sentry.pipeline.store import PipelineSessionStore
from sentry.pipeline.types import PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineEndpoint, PipelineView
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import with_feature
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


class InitialDataApiStep:
    """A step that reads initial data from pipeline state."""

    step_name = "check_initial"

    def get_step_data(self, pipeline: InitialDataPipeline, request: HttpRequest) -> dict[str, Any]:
        return {"external_id": pipeline.fetch_state("external_id")}

    def get_serializer_cls(self) -> type | None:
        return None

    def handle_post(
        self, validated_data: Any, pipeline: InitialDataPipeline, request: HttpRequest
    ) -> PipelineStepResult:
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


class InitialDataSerializer(CamelSnakeSerializer):
    external_id = CharField(required=False)


class InitialDataProvider(PipelineProvider["InitialDataPipeline"]):
    key = "initial_data"
    name = "Initial Data"

    def get_pipeline_views(self) -> Sequence[DummyStep]:
        return [DummyStep()]

    def get_pipeline_api_steps(
        self,
    ) -> Sequence[ApiPipelineEndpoint[InitialDataPipeline]]:
        return [InitialDataApiStep()]

    def get_initial_data_serializer_cls(self) -> type:
        return InitialDataSerializer


class InitialDataPipeline(Pipeline[Never, PipelineSessionStore]):
    """A pipeline whose provider accepts initial data via a serializer."""

    pipeline_name = "test_initial_data_pipeline"

    @cached_property
    def provider(self) -> InitialDataProvider:
        ret = InitialDataProvider()
        ret.set_pipeline(self)
        ret.update_config(self.config)
        return ret

    def get_pipeline_views(self) -> Sequence[DummyStep]:
        return self.provider.get_pipeline_views()

    def get_pipeline_api_steps(
        self,
    ) -> Sequence[ApiPipelineEndpoint[InitialDataPipeline]] | None:
        return self.provider.get_pipeline_api_steps()

    def finish_pipeline(self) -> HttpResponseBase:
        return HttpResponse("done")

    def api_finish_pipeline(self) -> PipelineStepResult:
        return PipelineStepResult.complete(data={"external_id": self.fetch_state("external_id")})


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

    @responses.activate
    @patch(
        "sentry.api.endpoints.organization_pipeline.initialize_integration_pipeline",
    )
    def test_initialize_binds_initial_data_via_serializer(self, mock_init: Any) -> None:
        """When the provider defines an initial data serializer, validated
        fields from the request are bound to pipeline state."""
        pipeline = self._init_pipeline_in_session(InitialDataPipeline, provider_key="initial_data")
        assert isinstance(pipeline, InitialDataPipeline)
        pipeline.set_api_mode()
        mock_init.return_value = pipeline

        url = self._get_pipeline_url()

        resp = self.client.post(
            url,
            data={
                "action": "initialize",
                "provider": "initial_data",
                "initialData": {"external_id": "12345"},
            },
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["step"] == "check_initial"
        assert resp.data["data"]["external_id"] == "12345"

    @responses.activate
    @patch(
        "sentry.api.endpoints.organization_pipeline.initialize_integration_pipeline",
    )
    def test_initialize_ignores_extra_fields_not_in_serializer(self, mock_init: Any) -> None:
        """Fields not declared in the serializer are not bound to state."""
        pipeline = self._init_pipeline_in_session(InitialDataPipeline, provider_key="initial_data")
        assert isinstance(pipeline, InitialDataPipeline)
        pipeline.set_api_mode()
        mock_init.return_value = pipeline

        url = self._get_pipeline_url()

        resp = self.client.post(
            url,
            data={
                "action": "initialize",
                "provider": "initial_data",
                "initialData": {
                    "external_id": "12345",
                    "evil_key": "should_be_ignored",
                },
            },
            format="json",
        )
        assert resp.status_code == 200
        assert pipeline.fetch_state("external_id") == "12345"
        assert pipeline.fetch_state("evil_key") is None

    @responses.activate
    @patch(
        "sentry.api.endpoints.organization_pipeline.initialize_integration_pipeline",
    )
    def test_initialize_without_initial_data_still_works(self, mock_init: Any) -> None:
        """Providers with an initial data serializer work even when no extra data is sent."""
        pipeline = self._init_pipeline_in_session(InitialDataPipeline, provider_key="initial_data")
        assert isinstance(pipeline, InitialDataPipeline)
        pipeline.set_api_mode()
        mock_init.return_value = pipeline

        url = self._get_pipeline_url()

        resp = self.client.post(
            url,
            data={"action": "initialize", "provider": "initial_data"},
            format="json",
        )
        assert resp.status_code == 200
        assert pipeline.fetch_state("external_id") is None

    @responses.activate
    @patch(
        "sentry.api.endpoints.organization_pipeline.initialize_integration_pipeline",
    )
    def test_initialize_no_serializer_skips_binding(self, mock_init: Any) -> None:
        """Providers without an initial data serializer ignore extra request fields."""
        pipeline = self._init_pipeline_in_session(DummyPipeline)
        assert isinstance(pipeline, DummyPipeline)
        pipeline.set_api_mode()
        mock_init.return_value = pipeline

        url = self._get_pipeline_url()

        resp = self.client.post(
            url,
            data={
                "action": "initialize",
                "provider": "dummy",
                "initialData": {"external_id": "12345"},
            },
            format="json",
        )
        assert resp.status_code == 200
        assert pipeline.fetch_state("external_id") is None


@control_silo_test
@with_feature("organizations:integrations-aws")
class AwsOrganizationPipelineTest(APITestCase):
    endpoint = "sentry-api-0-organization-pipeline"

    def setUp(self) -> None:
        super().setUp()
        self.login_as(self.user)
        self.url = reverse(self.endpoint, args=[self.organization.slug, "integration_pipeline"])

    @patch("sentry.integrations.aws.client.make_signed_seer_api_request")
    def test_install_requires_server_verified_trust(self, seer_request: Any) -> None:
        with self.options(
            {
                "seer-aws.principal-arn": "arn:aws:iam::111111111111:role/SentrySeerBroker",
                "seer-aws.cloudformation-url": "https://example.com/template.json",
            }
        ):
            response = self.client.post(
                self.url,
                {
                    "action": "initialize",
                    "provider": "aws",
                    "initialData": {"external_id": "customer-selected"},
                },
                format="json",
            )
            assert response.status_code == 200, response.data
            assert response.data["step"] == "aws_setup"
            external_id = response.data["data"]["externalId"]
            assert len(external_id) == 64
            response = self.client.post(
                self.url, {"externalId": "customer-selected"}, format="json"
            )
        assert response.status_code == 200
        assert response.data["step"] == "aws_customer_config"
        role_arn = "arn:aws:iam::123456789012:role/SentrySeerAccess"
        response = self.client.post(
            self.url, {"roleArn": role_arn, "regions": ["us-east-1"]}, format="json"
        )
        assert response.status_code == 200
        assert response.data["step"] == "aws_verification"
        response = self.client.post(
            self.url,
            {
                "action": "finish",
                "verification": {"externalIdRequired": True, "connectionStatus": "connected"},
            },
            format="json",
        )
        assert response.status_code == 400
        assert not OrganizationIntegration.objects.filter(
            organization_id=self.organization.id, integration__provider="aws"
        ).exists()

        seer_request.return_value.status = 200
        result = {
            "connection_status": "connected",
            "external_id_required": False,
            "regions": [{"region": "us-east-1", "connection_status": "connected", "services": []}],
        }
        seer_request.return_value.data = orjson.dumps(result)
        response = self.client.post(self.url, {"action": "verify"}, format="json")
        assert response.status_code == 200
        assert response.data["status"] == "stay"
        response = self.client.post(self.url, {"action": "finish"}, format="json")
        assert response.status_code == 400

        seer_request.return_value.data = orjson.dumps({**result, "external_id_required": True})
        response = self.client.post(
            self.url, {"action": "verify", "externalId": "forged"}, format="json"
        )
        assert response.status_code == 200
        assert orjson.loads(seer_request.call_args.kwargs["body"]) == {
            "organization_id": self.organization.id,
            "role_arn": role_arn,
            "external_id": external_id,
            "regions": ["us-east-1"],
        }
        response = self.client.post(self.url, {"action": "finish"}, format="json")
        assert response.status_code == 200, response.data
        assert response.data["status"] == "complete"
        config = OrganizationIntegration.objects.get(
            organization_id=self.organization.id, integration__provider="aws"
        ).config
        assert config["external_id"] == external_id
        assert config["verification"]["external_id_required"] is True

    @with_feature({"organizations:integrations-aws": False})
    def test_install_requires_feature_flag(self) -> None:
        response = self.client.post(
            self.url, {"action": "initialize", "provider": "aws"}, format="json"
        )
        assert response.status_code == 404

    def test_member_cannot_install(self) -> None:
        member = self.create_user()
        self.create_member(user=member, organization=self.organization, role="member")
        self.login_as(member)
        response = self.client.post(
            self.url, {"action": "initialize", "provider": "aws"}, format="json"
        )
        assert response.status_code == 403
