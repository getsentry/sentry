from __future__ import absolute_import

__all__ = ["FeatureHandler", "BatchFeatureHandler"]


class FeatureHandler(object):
    features = set()

    def __call__(self, feature, actor):
        if feature.name not in self.features:
            return None

        return self.has(feature, actor)

    def has(self, feature, actor):
        raise NotImplementedError

    def has_for_batch(self, batch):
        # If not overridden, iterate over objects in the batch individually.
        return {
            obj: self.has(feature, batch.actor)
            for (obj, feature) in batch.get_feature_objects().items()
        }


# It is generally better to extend BatchFeatureHandler if it is possible to do
# the check with no more than the feature name, organization, and actor. If it
# needs to unpack the Feature object and examine the flagged entity, extend
# FeatureHandler directly.


class BatchFeatureHandler(FeatureHandler):
    def _check_for_batch(self, feature_name, organization, actor):
        raise NotImplementedError

    def has(self, feature, actor):
        organization = getattr(feature, "organization", None) or feature.project.organization
        return self._check_for_batch(feature.name, organization, actor)

    def has_for_batch(self, batch):
        flag = self._check_for_batch(batch.feature_name, batch.organization, batch.actor)
        return {obj: flag for obj in batch.objects}
