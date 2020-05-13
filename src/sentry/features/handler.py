from __future__ import absolute_import

__all__ = ["FeatureHandler", "OrganizationFeatureHandler"]


class FeatureHandler(object):
    features = set()

    def __call__(self, feature, actor):
        if feature.name not in self.features:
            return None

        return self.has(feature, actor)

    def has(self, feature, actor):
        raise NotImplementedError

    def has_for_organization(self, org_batch):
        return {
            obj: self.has(feature, org_batch.actor)
            for (obj, feature) in org_batch.get_feature_objects().items()
        }


class OrganizationFeatureHandler(FeatureHandler):
    def _check_for_organization(self, feature_name, organization, actor):
        raise NotImplementedError

    def has(self, feature, actor):
        organization = getattr(feature, "organization", None) or feature.project.organization
        return self._check_for_organization(feature.name, organization, actor)

    def has_for_organization(self, org_batch):
        if org_batch.feature_name not in self.features:
            return None

        flag = self._check_for_organization(
            org_batch.feature_name, org_batch.organization, org_batch.actor
        )
        return {obj: flag for obj in org_batch.objects}
