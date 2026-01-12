from __future__ import annotations

import abc
import logging
import re
from collections.abc import Callable, Mapping, Sequence
from typing import Any, Protocol, Self

from django.http.request import HttpRequest
from django.http.response import HttpResponseBase

from sentry import analytics
from sentry.db.models.base import Model
from sentry.organizations.services.organization import RpcOrganization, organization_service
from sentry.organizations.services.organization.serial import serialize_rpc_organization
from sentry.utils.hashlib import md5_text
from sentry.utils.sdk import bind_organization_context
from sentry.web.helpers import render_to_response

from ..models import Organization
from .constants import PIPELINE_STATE_TTL
from .store import PipelineSessionStore
from .types import PipelineRequestState
from .views.base import PipelineView
from .views.nested import NestedPipelineView

ERR_MISMATCHED_USER = "Current user does not match user that started the pipeline."

# Maximum length for error messages to prevent log injection
MAX_ERROR_LENGTH = 500


def sanitize_log_message(message: str) -> str:
    """
    Sanitize error messages before logging to prevent log injection attacks.
    
    This function:
    - Truncates overly long messages
    - Removes control characters that could be used for log injection
    - Preserves readability while ensuring security
    """
    if not message:
        return ""
    
    # Remove control characters except for newlines and tabs (which are safe in logs)
    # Remove characters that could be used for ANSI escape sequences
    sanitized = re.sub(r'[\x00-\x08\x0b-\x0c\x0e-\x1f\x7f-\x9f]', '', message)
    
    # Truncate to maximum length
    if len(sanitized) > MAX_ERROR_LENGTH:
        sanitized = sanitized[:MAX_ERROR_LENGTH] + "..."
    
    return sanitized


class _HasKey(Protocol):
    @property
    def key(self) -> str: ...


class Pipeline[M: Model, S: PipelineSessionStore](abc.ABC):
    """
    Pipeline provides a mechanism to guide the user through a request
    'pipeline', where each view may be completed by calling the ``next_step``
    pipeline method to traverse through the pipe.

    The pipeline works with a PipelineProvider object which provides the
    pipeline views and is made available to the views through the passed in
    pipeline.

    :provider_model_cls:
    The Provider model object represents the instance of an object implementing
    the PipelineProvider interface. This is used to look up the instance
    when constructing an in progress pipeline (get_for_request).

    :config:
    A object that specifies additional pipeline and provider runtime
    configurations. An example of usage is for OAuth Identity providers, for
    overriding the scopes. The config object will be passed into the provider
    using the ``update_config`` method.
    """

    pipeline_name: str
    provider_model_cls: type[M] | None = None
    session_store_cls: type[S] = PipelineSessionStore  # type: ignore[assignment]  # python/mypy#18812

    @classmethod
    def get_for_request(cls, request: HttpRequest) -> Self | None:
        req_state = cls.unpack_state(request)
        if not req_state:
            return None

        config = req_state.state.config
        return cls(
            request,
            organization=req_state.organization,
            provider_key=req_state.provider_key,
            provider_model=req_state.provider_model,
            config=config,
        )

    @classmethod
    def unpack_state(cls, request: HttpRequest) -> PipelineRequestState[M, S] | None:
        state = cls.session_store_cls(request, cls.pipeline_name, ttl=PIPELINE_STATE_TTL)
        if not state.is_valid():
            return None

        provider_model = None
        if state.provider_model_id:
            assert cls.provider_model_cls is not None
            provider_model = cls.provider_model_cls.objects.get(id=state.provider_model_id)

        organization: RpcOrganization | None = None
        if state.org_id:
            org_context = organization_service.get_organization_by_id(
                id=state.org_id, include_teams=False
            )
            if org_context:
                organization = org_context.organization

        provider_key = state.provider_key

        return PipelineRequestState(state, provider_model, organization, provider_key)

    def __init__(
        self,
        request: HttpRequest,
        provider_key: str,
        organization: Organization | RpcOrganization | None = None,
        provider_model: M | None = None,
        config: Mapping[str, Any] | None = None,
    ) -> None:
        if organization:
            bind_organization_context(organization)

        self.request = request
        self.organization = (
            serialize_rpc_organization(organization)
            if isinstance(organization, Organization)
            else organization
        )
        self.state = self.session_store_cls(request, self.pipeline_name, ttl=PIPELINE_STATE_TTL)
        self.provider_model = provider_model
        self._provider_key = provider_key

        self.config = config or {}

        self.pipeline_views = self.get_pipeline_views()

        # we serialize the pipeline to be ['fqn.PipelineView', ...] which
        # allows us to determine if the pipeline has changed during the auth
        # flow or if the user is somehow circumventing a chunk of it
        pipe_ids = [f"{type(v).__module__}.{type(v).__name__}" for v in self.pipeline_views]
        self.signature = md5_text(*pipe_ids).hexdigest()

    @property
    @abc.abstractmethod
    def provider(self) -> _HasKey:
        """implement me with @cached_property please!"""
        raise NotImplementedError

    @abc.abstractmethod
    def get_pipeline_views(self) -> Sequence[PipelineView[Self] | Callable[[], PipelineView[Self]]]:
        """
        Retrieve the pipeline views from the provider.

        You may wish to override this method to provide views that all
        providers should inherit, or customize the provider method called to
        retrieve the views.
        """
        raise NotImplementedError

    def is_valid(self) -> bool:
        return (
            self.state.is_valid()
            and self.state.signature == self.signature
            and self.state.step_index is not None
        )

    def initialize(self) -> None:
        self.state.regenerate(self.get_initial_state())

    def get_initial_state(self) -> Mapping[str, Any]:
        return {
            "uid": self.request.user.id if self.request.user.is_authenticated else None,
            "provider_model_id": self.provider_model.id if self.provider_model else None,
            "provider_key": self.provider.key,
            "org_id": self.organization.id if self.organization else None,
            "step_index": 0,
            "signature": self.signature,
            "config": self.config,
            "data": {},
        }

    def clear_session(self) -> None:
        self.state.clear()

    def current_step(self) -> HttpResponseBase:
        """
        Render the current step.
        """
        if self.state.uid is not None and self.state.uid != self.request.user.id:
            return self.error(ERR_MISMATCHED_USER)

        step_index = self.step_index

        if step_index == len(self.pipeline_views):
            return self.finish_pipeline()

        step = self.pipeline_views[step_index]

        # support late binding steps
        if callable(step):
            step = step()

        return step.dispatch(self.request, pipeline=self)

    def error(self, message: str) -> HttpResponseBase:
        # Sanitize the message before logging to prevent log injection
        sanitized_message = sanitize_log_message(message)
        
        self.get_logger().error(
            f"PipelineError: {sanitized_message}",
            extra={
                "organization_id": self.organization.id if self.organization else None,
                "provider": self.provider.key,
                "error": sanitized_message,
            },
        )

        return render_to_response(
            template="sentry/pipeline-error.html",
            context={"error": sanitized_message},
            request=self.request,
        )

    def render_warning(self, message: str) -> HttpResponseBase:
        """For situations when we want to display an error without triggering an issue."""
        context = {"error": message}
        return render_to_response("sentry/pipeline-provider-error.html", context, self.request)

    def next_step(self, step_size: int = 1) -> HttpResponseBase:
        """Render the next step."""
        self.state.step_index = self.step_index + step_size

        if self.organization and (event := self.get_analytics_event()):
            analytics.record(event)

        return self.current_step()

    def get_analytics_event(self) -> analytics.Event | None:
        return None

    @abc.abstractmethod
    def finish_pipeline(self) -> HttpResponseBase:
        """Called when the pipeline completes the final step."""

    def bind_state(self, key: str, value: Any) -> None:
        data = self.state.data or {}
        data[key] = value

        self.state.data = data

    @property
    def step_index(self) -> int:
        return self.state.step_index or 0

    def _fetch_state(self, key: str | None = None) -> Any | None:
        data = self.state.data
        if not data:
            return None
        return data if key is None else data.get(key)

    def fetch_state(self, key: str | None = None) -> Any | None:
        step_index = self.step_index
        if step_index >= len(self.pipeline_views):
            return self._fetch_state(key)
        view = self.pipeline_views[step_index]
        if isinstance(view, NestedPipelineView):
            # Attempt to surface state from a nested pipeline
            nested_pipeline = view.pipeline_cls(
                organization=self.organization,
                request=self.request,
                provider_key=view.provider_key,
                config=view.config,
            )
            return nested_pipeline.fetch_state(key)
        return self._fetch_state(key)

    def get_logger(self) -> logging.Logger:
        return logging.getLogger(f"sentry.integration.{self.provider.key}")
