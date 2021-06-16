__all__ = ["FeatureHandler", "BatchFeatureHandler"]

from typing import Any, Mapping, MutableSet, Optional, Sequence, Union

from sentry.features.base import Feature
from sentry.features.manager import FeatureCheckBatch


class FeatureHandler:
    features: MutableSet[str] = set()

    def __call__(self, feature: Feature, actor: Any) -> Optional[bool]:
        if feature.name not in self.features:
            return None

        return self.has(feature, actor)

    def has(self, feature: Feature, actor: Any) -> bool:
        raise NotImplementedError

    def has_for_batch(self, batch: Any) -> Mapping[str, bool]:
        # If not overridden, iterate over objects in the batch individually.
        return {
            obj: self.has(feature, batch.actor)
            for (obj, feature) in batch.get_feature_objects().items()
        }

    def batch_has(
        self,
        feature_names: Sequence[str],
        actor: Any,
        projects: Optional[Sequence[Any]] = None,
        organization: Optional[Any] = None,
        batch: bool = True,
    ) -> Optional[bool]:
        raise NotImplementedError


# It is generally better to extend BatchFeatureHandler if it is possible to do
# the check with no more than the feature name, organization, and actor. If it
# needs to unpack the Feature object and examine the flagged entity, extend
# FeatureHandler directly.


class BatchFeatureHandler(FeatureHandler):
    def _check_for_batch(self, feature_name: str, organization: Any, actor: Any) -> bool:
        raise NotImplementedError

    def has(self, feature: Union[Feature], actor: Any) -> bool:
        organization = getattr(feature, "organization", None) or feature.project.organization  # type: ignore
        return self._check_for_batch(feature.name, organization, actor)

    def has_for_batch(self, batch: FeatureCheckBatch) -> Mapping[str, bool]:
        flag = self._check_for_batch(batch.feature_name, batch.organization, batch.actor)
        return {obj: flag for obj in batch.objects}
