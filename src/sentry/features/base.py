__all__ = ["Feature", "OrganizationFeature", "ProjectFeature", "ProjectPluginFeature"]

from typing import Any


class Feature:
    def __init__(self, name: str, *args: Any, **kwargs: Any) -> None:
        self.name = name


class OrganizationFeature(Feature):
    def __init__(self, name: str, organization: Any) -> None:
        Feature.__init__(self, name)
        self.organization = organization


class ProjectFeature(Feature):
    def __init__(self, name: str, project: Any) -> None:
        Feature.__init__(self, name)
        self.project = project


class ProjectPluginFeature(ProjectFeature):
    def __init__(self, name: str, project: Any, plugin: Any) -> None:
        ProjectFeature.__init__(self, name, project)
        self.plugin = plugin
