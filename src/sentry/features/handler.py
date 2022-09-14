from __future__ import annotations

__all__ = ["FeatureHandler", "BatchFeatureHandler"]

import abc
from time import time
from typing import TYPE_CHECKING, Mapping, MutableSet, Optional, Sequence

from sentry import options

if TYPE_CHECKING:
    from sentry.features.base import Feature
    from sentry.features.manager import FeatureCheckBatch
    from sentry.models import Organization, Project, User


class FeatureHandler:
    features: MutableSet[str] = set()
    rollout_options: MutableSet[str] = set()
    option_ttl = 60  # cache the options for 60s

    def __init__(self):
        super().__init__()

        self.last_updated = None
        self.cached_rollouts = {}

    def update_cache_options(self):
        now = time()
        if (
            self.last_updated is None
            or now - self.option_ttl < self.last_updated  # refetch if the cache is old
        ):

            self.last_updated = now
            for rolloutOption in self.rollout_options:
                self.cached_rollouts[rolloutOption] = options.get(rolloutOption)

    def __call__(self, feature: Feature, actor: User) -> Optional[bool]:
        if feature.name not in self.features:
            return None

        return self.has(feature, actor)

    @abc.abstractmethod
    def has(self, feature: Feature, actor: User, skip_entity: Optional[bool] = False) -> bool:
        raise NotImplementedError

    def has_for_batch(self, batch: FeatureCheckBatch) -> Mapping[Project, bool]:
        self.update_cache_options()
        # If not overridden, iterate over objects in the batch individually.
        return {
            obj: self.has(feature, batch.actor)
            for (obj, feature) in batch.get_feature_objects().items()
        }

    @abc.abstractmethod
    def batch_has(
        self,
        feature_names: Sequence[str],
        actor: User,
        projects: Optional[Sequence[Project]] = None,
        organization: Optional[Organization] = None,
        batch: bool = True,
    ) -> Optional[Mapping[str, Mapping[str, bool]]]:
        raise NotImplementedError


# It is generally better to extend BatchFeatureHandler if it is possible to do
# the check with no more than the feature name, organization, and actor. If it
# needs to unpack the Feature object and examine the flagged entity, extend
# FeatureHandler directly.


class BatchFeatureHandler(FeatureHandler):
    @abc.abstractmethod
    def _check_for_batch(self, feature_name: str, entity: Organization | User, actor: User) -> bool:
        raise NotImplementedError

    def has(self, feature: Feature, actor: User, skip_entity: Optional[bool] = False) -> bool:
        self.update_cache_options()
        return self._check_for_batch(feature.name, feature.get_subject(), actor)

    def has_for_batch(self, batch: FeatureCheckBatch) -> Mapping[Project, bool]:
        self.update_cache_options()
        flag = self._check_for_batch(batch.feature_name, batch.subject, batch.actor)
        return {obj: flag for obj in batch.objects}
