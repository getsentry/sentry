from __future__ import annotations

__all__ = ["FeatureHandler", "BatchFeatureHandler"]

import abc
from collections.abc import Mapping, MutableSet, Sequence
from typing import TYPE_CHECKING

from sentry.users.services.user import RpcUser

if TYPE_CHECKING:
    from sentry.features.base import Feature
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.models.user import User


class FeatureHandler:
    features: MutableSet[str] = set()

    def __call__(self, feature: Feature, actor: User) -> bool | None:
        if feature.name not in self.features:
            return None

        return self.has(feature, actor)

    @abc.abstractmethod
    def has(
        self, feature: Feature, actor: User | RpcUser, skip_entity: bool | None = False
    ) -> bool | None:
        raise NotImplementedError

    @abc.abstractmethod
    def batch_has(
        self,
        feature_names: Sequence[str],
        actor: User,
        projects: Sequence[Project] | None = None,
        organization: Organization | None = None,
        batch: bool = True,
    ) -> Mapping[str, Mapping[str, bool | None]] | None:
        raise NotImplementedError


# It is generally better to extend BatchFeatureHandler if it is possible to do
# the check with no more than the feature name, organization, and actor. If it
# needs to unpack the Feature object and examine the flagged entity, extend
# FeatureHandler directly.


class BatchFeatureHandler(FeatureHandler):
    @abc.abstractmethod
    def _check_for_batch(
        self, feature_name: str, entity: Organization | User, actor: User
    ) -> bool | None:
        raise NotImplementedError

    def has(self, feature: Feature, actor: User, skip_entity: bool | None = False) -> bool | None:
        return self._check_for_batch(feature.name, feature.get_subject(), actor)
