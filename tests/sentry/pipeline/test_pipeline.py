from collections.abc import Sequence
from functools import cached_property
from typing import Any, Never
from unittest.mock import MagicMock, patch

import pytest
from django.contrib.sessions.backends.base import SessionBase
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from rest_framework import serializers

from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.pipeline.base import ERR_MISMATCHED_USER, Pipeline
from sentry.pipeline.provider import PipelineProvider
from sentry.pipeline.store import PipelineSessionStore
from sentry.pipeline.types import PipelineStepAction, PipelineStepResult
from sentry.pipeline.views.base import ApiPipelineEndpoint, ApiPipelineSteps, PipelineView
from sentry.silo.base import SiloMode
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test


class PipelineStep:
    def dispatch(self, request, pipeline):
        pipeline.dispatch_count += 1
        pipeline.bind_state("some_state", "value")


class DummyProvider(PipelineProvider["DummyPipeline"]):
    key = "dummy"
    name = "dummy"
    pipeline_views: list[PipelineStep] = [PipelineStep(), PipelineStep()]

    def get_pipeline_views(self) -> Sequence[PipelineStep]:
        return self.pipeline_views


class DummyPipeline(Pipeline[Never, PipelineSessionStore]):
    """A minimal pipeline that does NOT support API mode."""

    pipeline_name = "test_pipeline"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.finished = False
        self.dispatch_count = 0

    @cached_property
    def provider(self) -> DummyProvider:
        ret = {"dummy": DummyProvider()}[self._provider_key]
        ret.set_pipeline(self)
        ret.update_config(self.config)
        return ret

    def get_pipeline_views(self) -> Sequence[PipelineStep]:
        return self.provider.get_pipeline_views()

    def finish_pipeline(self):
        self.finished = True


class ChooseThingView:
    """Step 1 (dispatch): user picks a thing."""

    def dispatch(self, request: HttpRequest, pipeline: Any) -> HttpResponseBase:
        if "thing" in request.POST:
            pipeline.bind_state("thing", request.POST["thing"])
            return pipeline.next_step()
        return HttpResponse('<form method="POST"><input name="thing" /></form>')


class ConfirmView:
    """Step 2 (dispatch): user confirms their choice."""

    def dispatch(self, request: HttpRequest, pipeline: Any) -> HttpResponseBase:
        if request.method == "POST":
            pipeline.bind_state("confirmed", True)
            return pipeline.next_step()
        thing = pipeline.fetch_state("thing")
        return HttpResponse(
            f"<p>Confirm {thing}?</p><form method='POST'><button>OK</button></form>"
        )


class ChooseThingApiStep[P: Pipeline[Any, Any]]:
    step_name = "choose_thing"

    def get_step_data(self, pipeline: P, request: HttpRequest) -> dict[str, Any]:
        return {"available_things": ["thing_a", "thing_b", "thing_c"]}

    def get_serializer_cls(self) -> type | None:
        return None

    def handle_post(
        self, validated_data: Any, pipeline: P, request: HttpRequest
    ) -> PipelineStepResult:
        thing = validated_data.get("thing", "thing_a")
        pipeline.bind_state("thing", thing)
        return PipelineStepResult.advance()


class ConfirmApiStep[P: Pipeline[Any, Any]]:
    step_name = "confirm"

    def get_step_data(self, pipeline: P, request: HttpRequest) -> dict[str, Any]:
        return {"thing": pipeline.fetch_state("thing")}

    def get_serializer_cls(self) -> type | None:
        return None

    def handle_post(
        self, validated_data: Any, pipeline: P, request: HttpRequest
    ) -> PipelineStepResult:
        pipeline.bind_state("confirmed", True)
        return PipelineStepResult.advance()


class ApiDummyProvider(PipelineProvider["ApiDummyPipeline"]):
    key = "dummy"
    name = "Dummy"

    def __init__(self) -> None:
        super().__init__()
        self._pipeline_views: list[PipelineView[ApiDummyPipeline]] = [
            ChooseThingView(),
            ConfirmView(),
        ]
        self._api_steps: list[ApiPipelineEndpoint[ApiDummyPipeline]] = [
            ChooseThingApiStep(),
            ConfirmApiStep(),
        ]

    def get_pipeline_views(self) -> Sequence[PipelineView["ApiDummyPipeline"]]:
        return self._pipeline_views

    def get_pipeline_api_steps(self) -> ApiPipelineSteps["ApiDummyPipeline"]:
        return self._api_steps


class ApiDummyPipeline(Pipeline[Never, PipelineSessionStore]):
    """A pipeline that supports both dispatch-based views and API mode."""

    pipeline_name = "test_api_pipeline"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.finished = False
        self.finish_data: dict[str, Any] | None = None

    @cached_property
    def provider(self) -> ApiDummyProvider:
        ret = {"dummy": ApiDummyProvider()}[self._provider_key]
        ret.set_pipeline(self)
        ret.update_config(self.config)
        return ret

    def get_pipeline_views(self) -> Sequence[PipelineView["ApiDummyPipeline"]]:
        return self.provider.get_pipeline_views()

    def get_pipeline_api_steps(self) -> ApiPipelineSteps["ApiDummyPipeline"]:
        return self.provider.get_pipeline_api_steps()

    def finish_pipeline(self) -> HttpResponseBase:
        self.finished = True
        return HttpResponse("done")

    def api_finish_pipeline(self) -> PipelineStepResult:
        self.finished = True
        self.finish_data = self.state.data
        return PipelineStepResult.complete(data={"thing": self.fetch_state("thing")})


class LateBoundApiStep:
    """A step that is constructed at resolution time and reads earlier pipeline state."""

    step_name = "late_bound"

    def __init__(self, config_from_state: str) -> None:
        self.config_from_state = config_from_state

    def get_step_data(self, pipeline: Any, request: HttpRequest) -> dict[str, Any]:
        return {"config": self.config_from_state}

    def get_serializer_cls(self) -> type | None:
        return None

    def handle_post(
        self, validated_data: Any, pipeline: Any, request: HttpRequest
    ) -> PipelineStepResult:
        pipeline.bind_state("late_result", f"processed:{self.config_from_state}")
        return PipelineStepResult.advance()


class LateBoundProvider(PipelineProvider["LateBoundPipeline"]):
    key = "late_bound"
    name = "Late Bound"

    def get_pipeline_views(self) -> Sequence[PipelineView["LateBoundPipeline"]]:
        return [ChooseThingView()]

    def get_pipeline_api_steps(self) -> ApiPipelineSteps["LateBoundPipeline"]:
        return [
            ChooseThingApiStep(),
            lambda: self._make_late_step(),
        ]

    def _make_late_step(self) -> LateBoundApiStep:
        thing = self.pipeline.fetch_state("thing")
        return LateBoundApiStep(config_from_state=thing or "missing")


class LateBoundPipeline(Pipeline[Never, PipelineSessionStore]):
    pipeline_name = "test_late_bound_pipeline"

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.finished = False

    @cached_property
    def provider(self) -> LateBoundProvider:
        ret = LateBoundProvider()
        ret.set_pipeline(self)
        ret.update_config(self.config)
        return ret

    def get_pipeline_views(self) -> Sequence[PipelineView["LateBoundPipeline"]]:
        return self.provider.get_pipeline_views()

    def get_pipeline_api_steps(self) -> ApiPipelineSteps["LateBoundPipeline"]:
        return self.provider.get_pipeline_api_steps()

    def finish_pipeline(self) -> HttpResponseBase:
        self.finished = True
        return HttpResponse("done")

    def api_finish_pipeline(self) -> PipelineStepResult:
        self.finished = True
        return PipelineStepResult.complete(data={"late_result": self.fetch_state("late_result")})


@control_silo_test
class PipelineTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.CELL):
            self.org = serialize_rpc_organization(self.create_organization())
        self.request = HttpRequest()
        self.request.session = SessionBase()
        self.request.user = self.user

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_simple_pipeline(self, mock_bind_org_context: MagicMock) -> None:
        pipeline = DummyPipeline(self.request, "dummy", self.org, config={"some_config": True})
        pipeline.initialize()

        assert pipeline.is_valid()
        assert "some_config" in pipeline.provider.config
        mock_bind_org_context.assert_called_with(self.org)

        # Pipeline has two steps, ensure both steps compete. Usually the
        # dispatch itself would be the one calling the current_step and
        # next_step methods after it determines if it can move forward a step.
        pipeline.current_step()
        assert pipeline.dispatch_count == 1
        assert pipeline.fetch_state("some_state") == "value"

        pipeline.next_step()
        assert pipeline.dispatch_count == 2

        pipeline.next_step()
        assert pipeline.dispatch_count == 2
        assert pipeline.finished

        pipeline.clear_session()
        assert not pipeline.state.is_valid()

    def test_invalidated_pipeline(self) -> None:
        pipeline = DummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        assert pipeline.is_valid()

        # Mutate the provider, Remove an item from the pipeline, thus
        # invalidating the pipeline.
        with patch.object(DummyProvider, "pipeline_views", [PipelineStep()]):
            new_pipeline = DummyPipeline.get_for_request(self.request)
            assert new_pipeline is not None

            assert not new_pipeline.is_valid()

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_pipeline_intercept_fails(self, mock_bind_org_context: MagicMock) -> None:
        pipeline = DummyPipeline(self.request, "dummy", self.org, config={"some_config": True})
        pipeline.initialize()

        assert pipeline.is_valid()
        assert "some_config" in pipeline.provider.config
        mock_bind_org_context.assert_called_with(self.org)

        pipeline.current_step()
        assert pipeline.dispatch_count == 1

        # Pipeline advancer uses pipeline_cls.get_for_request() to fetch pipeline from new incoming request
        request = HttpRequest()
        request.session = self.request.session  # duplicate session
        request.user = self.create_user()

        intercepted_pipeline = DummyPipeline.get_for_request(request)
        assert intercepted_pipeline is not None

        # The pipeline errors because the user is different from the one that initialized it
        resp = intercepted_pipeline.next_step()
        assert isinstance(resp, HttpResponse)  # TODO(cathy): fix typing on
        assert ERR_MISMATCHED_USER.encode() in resp.content


@control_silo_test
class PipelineApiModeTestCase(TestCase):
    def setUp(self) -> None:
        super().setUp()
        with assume_test_silo_mode(SiloMode.CELL):
            self.org = serialize_rpc_organization(self.create_organization())
        self.request = HttpRequest()
        self.request.session = SessionBase()
        self.request.user = self.user

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_non_api_pipeline_is_not_api_ready(self, mock_bind_org_context: MagicMock) -> None:
        """A pipeline that doesn't override get_pipeline_api_steps is not API ready."""
        pipeline = DummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        assert pipeline.get_pipeline_api_steps() is None
        assert not pipeline.is_api_ready()

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_api_pipeline_is_api_ready(self, mock_bind_org_context: MagicMock) -> None:
        """A pipeline with matching API steps and pipeline views is API ready."""
        pipeline = ApiDummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        assert pipeline.get_pipeline_api_steps() is not None
        assert pipeline.is_api_ready()

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_get_current_step_info(self, mock_bind_org_context: MagicMock) -> None:
        pipeline = ApiDummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        info = pipeline.get_current_step_info()
        assert info["step"] == "choose_thing"
        assert info["stepIndex"] == 0
        assert info["totalSteps"] == 2
        assert info["provider"] == "dummy"
        assert info["data"] == {"available_things": ["thing_a", "thing_b", "thing_c"]}

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_get_current_step_info_after_advance(self, mock_bind_org_context: MagicMock) -> None:
        pipeline = ApiDummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        pipeline.api_advance(self.request, {"thing": "thing_b"})

        info = pipeline.get_current_step_info()
        assert info["step"] == "confirm"
        assert info["stepIndex"] == 1
        assert info["data"] == {"thing": "thing_b"}

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_api_advance_binds_state(self, mock_bind_org_context: MagicMock) -> None:
        pipeline = ApiDummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        result = pipeline.api_advance(self.request, {"thing": "thing_c"})

        assert result.action == PipelineStepAction.ADVANCE
        assert pipeline.fetch_state("thing") == "thing_c"
        assert pipeline.step_index == 1

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_api_full_flow_completes_pipeline(self, mock_bind_org_context: MagicMock) -> None:
        """Walk through every step and verify the pipeline completes."""
        pipeline = ApiDummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        # Step 1: choose a thing
        result = pipeline.api_advance(self.request, {"thing": "thing_b"})
        assert result.action == PipelineStepAction.ADVANCE
        assert pipeline.step_index == 1

        # Step 2: confirm — this is the last step, so pipeline finishes
        result = pipeline.api_advance(self.request, {})
        assert result.action == PipelineStepAction.COMPLETE
        assert result.data == {"thing": "thing_b"}
        assert pipeline.finished
        assert pipeline.fetch_state("confirmed") is True

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_api_advance_raises_on_validation_error(self, mock_bind_org_context: MagicMock) -> None:
        """When a serializer is provided and validation fails, a ValidationError is raised."""
        from rest_framework.exceptions import ValidationError

        class StrictSerializer(serializers.Serializer):
            thing = serializers.CharField(required=True)

        pipeline = ApiDummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        # Attach a serializer to the first step
        api_steps = pipeline.get_pipeline_api_steps()
        assert api_steps is not None
        step = pipeline._resolve_api_step(api_steps[0])
        step.get_serializer_cls = lambda: StrictSerializer  # type: ignore[method-assign]

        with pytest.raises(ValidationError) as exc_info:
            pipeline.api_advance(self.request, {})

        assert "thing" in exc_info.value.detail
        assert pipeline.step_index == 0

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_api_advance_with_valid_serializer_data(self, mock_bind_org_context: MagicMock) -> None:
        class StrictSerializer(serializers.Serializer):
            thing = serializers.CharField(required=True)

        pipeline = ApiDummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        api_steps = pipeline.get_pipeline_api_steps()
        assert api_steps is not None
        step = pipeline._resolve_api_step(api_steps[0])
        step.get_serializer_cls = lambda: StrictSerializer  # type: ignore[method-assign]

        result = pipeline.api_advance(self.request, {"thing": "thing_a"})

        assert result.action == PipelineStepAction.ADVANCE
        assert pipeline.step_index == 1

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_api_advance_respects_non_advance_result(
        self, mock_bind_org_context: MagicMock
    ) -> None:
        """When handle_post returns a non-ADVANCE result, the step index should not change."""
        pipeline = ApiDummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        # Make step return a stay with redirect data instead of advance
        api_steps = pipeline.get_pipeline_api_steps()
        assert api_steps is not None
        step = pipeline._resolve_api_step(api_steps[0])
        step.handle_post = lambda *_a, **_kw: PipelineStepResult.stay(  # type: ignore[method-assign]
            data={"redirectUrl": "https://github.com/login/oauth"}
        )

        result = pipeline.api_advance(self.request, {})

        assert result.action == PipelineStepAction.STAY
        assert result.data == {"redirectUrl": "https://github.com/login/oauth"}
        assert pipeline.step_index == 0

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_api_finish_pipeline_not_implemented_on_base(
        self, mock_bind_org_context: MagicMock
    ) -> None:
        """The base Pipeline.api_finish_pipeline raises NotImplementedError."""
        pipeline = DummyPipeline(self.request, "dummy", self.org)
        pipeline.initialize()

        with pytest.raises(NotImplementedError):
            pipeline.api_finish_pipeline()

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_late_bound_step_reads_state_from_earlier_step(
        self, mock_bind_org_context: MagicMock
    ) -> None:
        """A callable step is resolved at access time and can use state bound by previous steps."""
        pipeline = LateBoundPipeline(self.request, "late_bound", self.org)
        pipeline.initialize()

        assert pipeline.is_api_ready()

        # Step 1: choose a thing — binds "thing" to state
        result = pipeline.api_advance(self.request, {"thing": "thing_b"})
        assert result.action == PipelineStepAction.ADVANCE
        assert pipeline.fetch_state("thing") == "thing_b"

        # Step 2 is late-bound: it reads "thing" from state at construction time
        info = pipeline.get_current_step_info()
        assert info["step"] == "late_bound"
        assert info["data"]["config"] == "thing_b"

        # Advance through the late-bound step
        result = pipeline.api_advance(self.request, {})
        assert result.action == PipelineStepAction.COMPLETE
        assert result.data["late_result"] == "processed:thing_b"
        assert pipeline.finished

    @patch("sentry.pipeline.base.bind_organization_context")
    def test_late_bound_step_counts_in_total_steps(self, mock_bind_org_context: MagicMock) -> None:
        """Late-bound callables are counted in totalSteps even before resolution."""
        pipeline = LateBoundPipeline(self.request, "late_bound", self.org)
        pipeline.initialize()

        info = pipeline.get_current_step_info()
        assert info["totalSteps"] == 2
