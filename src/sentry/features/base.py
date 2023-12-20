from __future__ import annotations

from enum import Enum

__all__ = [
    "Feature",
    "OrganizationFeature",
    "ProjectFeature",
    "ProjectPluginFeature",
    "UserFeature",
    "FeatureHandlerStrategy",
]

import abc
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.models.user import User


class Feature:
    """Feature is not actually an abstract class even though it only has abstract
    methods. This is because we need to be able to instantiate it."""

    def __init__(self, name: str, *args: Any, **kwargs: Any) -> None:
        """
        `FeatureManager.get()` and `FeatureCheckBatch.get_feature_objects()`
        expect to be able to pass a `Feature` arbitrary `args` and `kwargs`.
        """
        self.name = name

    @abc.abstractmethod
    def get_subject(self) -> User | Organization | None:
        raise NotImplementedError


class SystemFeature(Feature):
    """
    System feature flags don't have user/project/organization and are
    based on how the application is configured instead.
    """

    def get_subject(self) -> None:
        return None


class OrganizationFeature(Feature):
    def __init__(self, name: str, organization: Organization) -> None:
        super().__init__(name)
        self.organization = organization

    def get_subject(self) -> Organization:
        return self.organization


class ProjectFeature(Feature):
    def __init__(self, name: str, project: Project) -> None:
        super().__init__(name)
        self.project = project

    def get_subject(self) -> Organization:
        return self.project.organization


class ProjectPluginFeature(Feature):
    def __init__(self, name: str, project: Project, plugin: Any) -> None:
        super().__init__(name)
        self.project = project
        self.plugin = plugin

    def get_subject(self) -> Organization:
        return self.project.organization


class UserFeature(Feature):
    def __init__(self, name: str, user: User) -> None:
        super().__init__(name)
        self.user = user

    def get_subject(self) -> User:
        return self.user


class FeatureHandlerStrategy(Enum):
    """
    This controls whether the feature flag is evaluated statically,
    or if it's managed by a remote feature flag service.
    See https://develop.sentry.dev/feature-flags/
    """

    INTERNAL = 1
    """Handle the feature using a constant or logic within python"""
    REMOTE = 2
    """Handle the feature using a remote flag management service"""
