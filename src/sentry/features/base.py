__all__ = ["Feature", "OrganizationFeature", "ProjectFeature", "ProjectPluginFeature"]

from abc import ABC
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sentry.models import Organization, Project


class Feature(ABC):
    def __init__(self, name: str, *args: Any, **kwargs: Any) -> None:
        """
        `FeatureManager.get()` and `FeatureCheckBatch.get_feature_objects()`
        expect to be able to pass a `Feature` arbitrary `args` and `kwargs`.
        """
        self.name = name

    def get_organization(self) -> "Organization":
        raise NotImplementedError


class OrganizationFeature(Feature):
    def __init__(self, name: str, organization: "Organization") -> None:
        super().__init__(name)
        self.organization = organization

    def get_organization(self) -> "Organization":
        return self.organization


class ProjectFeature(OrganizationFeature):
    def __init__(self, name: str, project: "Project") -> None:
        super().__init__(name, organization=project.organization)
        self.project = project


class ProjectPluginFeature(ProjectFeature):
    def __init__(self, name: str, project: "Project", plugin: Any) -> None:
        super().__init__(name, project=project)
        self.plugin = plugin
