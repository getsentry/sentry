from __future__ import annotations

import abc
from typing import TYPE_CHECKING, Any, Mapping, Sequence

if TYPE_CHECKING:
    from sentry.pipeline import Pipeline
    from sentry.pipeline.views.base import PipelineView


class PipelineProvider(abc.ABC):
    """
    A class implementing the PipelineProvider interface provides the pipeline
    views that the Pipeline will traverse through.
    """

    def __init__(self) -> None:
        self.config: dict[str, Any] = {}

    @property
    @abc.abstractmethod
    def key(self) -> str:
        """
        A unique identifier (e.g. 'slack'). Used to lookup sibling classes and
        the `key` used when creating Integration objects.
        """
        pass

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """A human readable name (e.g. 'Slack')."""
        pass

    @abc.abstractmethod
    def get_pipeline_views(self) -> Sequence[PipelineView]:
        """
        Returns a list of instantiated views which implement the PipelineView
        interface. Each view will be dispatched in order.
        >>> return [OAuthInitView(), OAuthCallbackView()]
        """
        pass

    def update_config(self, config: Mapping[str, Any]) -> None:
        """
        Use update_config to allow additional provider configuration be assigned to
        the provider instance. This is useful for example when nesting
        pipelines and the provider needs to be configured differently.
        """
        self.config.update(config)

    def set_pipeline(self, pipeline: Pipeline) -> None:
        """
        Used by the pipeline to give the provider access to the executing pipeline.
        """
        self.pipeline = pipeline
