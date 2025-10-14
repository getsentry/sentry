from __future__ import annotations

import abc
from collections.abc import Sequence
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from django.contrib.auth.models import AnonymousUser

    from sentry.features.base import Feature
    from sentry.features.manager import FeatureCheckBatch
    from sentry.models.organization import Organization
    from sentry.models.project import Project
    from sentry.users.models.user import User
    from sentry.users.services.user import RpcUser


__all__ = ["FeatureHandler", "BatchFeatureHandler"]


class FeatureHandler:
    """
    Base class for defining custom logic for feature decisions.

    Subclasses should implement `has` and contain the logic
    necessary for the feature check.

    Generally FeatureHandlers are only implemented in `getsentry.features`
    as we don't programatically release features in self-hosted.
    """

    features: set[str] = set()

    def __call__(self, feature: Feature, actor: User) -> bool | None:
        if feature.name not in self.features:
            return None

        return self.has(feature, actor)

    @abc.abstractmethod
    def has(
        self,
        feature: Feature,
        actor: User | RpcUser | AnonymousUser | None,
        skip_entity: bool | None = False,
    ) -> bool | None:
        raise NotImplementedError

    def has_for_batch(self, batch: FeatureCheckBatch) -> dict[Project, bool | None]:
        # If not overridden, iterate over objects in the batch individually.
        return {
            obj: self.has(feature, batch.actor)
            for (obj, feature) in batch.get_feature_objects().items()
        }

    @abc.abstractmethod
    def batch_has(
        self,
        feature_names: Sequence[str],
        actor: User | RpcUser | AnonymousUser | None,
        projects: Sequence[Project] | None = None,
        organization: Organization | None = None,
        batch: bool = True,
    ) -> dict[str, dict[str, bool | None]] | None:
        raise NotImplementedError

    def has_batch_for_organizations(
        self,
        feature_names: Sequence[str],
        actor: User | RpcUser | AnonymousUser | None,
        organizations: Sequence[Organization],
    ) -> dict[str, dict[str, bool | None]] | None:
        """
        Check the same set of feature flags for multiple organizations at once.

        Default implementation iterates through organizations individually.
        Subclasses in getsentry can override this for optimized batch checking.

        Args:
            feature_names: List of feature names to check
            actor: Optional actor for feature checks
            organizations: List of organizations to check the features for

        Returns:
            Mapping from organization keys (format: "organization:{id}") to
            feature name to result mapping
        """
        from sentry.features.base import OrganizationFeature

        results: dict[str, dict[str, bool | None]] = {}
        for organization in organizations:
            org_key = f"organization:{organization.id}"
            org_results = results[org_key] = {}
            for feature_name in feature_names:
                feature = OrganizationFeature(feature_name, organization)
                org_results[feature_name] = self.has(feature, actor)
        return results


class BatchFeatureHandler(FeatureHandler):
    """
    Base class for feature handlers that apply to an organization
    and an optional collection of `objects` (e.g. projects).

    Subclasses are expected to implement `_check_for_batch` and perform a feature check
    using only the organization.

    It is generally better to extend BatchFeatureHandler if it is possible to do
    the check with no more than the feature name, organization, and actor. If it
    needs to unpack the Feature object and examine the flagged entity, extend
    FeatureHandler instead.
    """

    @abc.abstractmethod
    def _check_for_batch(
        self,
        feature_name: str,
        entity: Organization | User | RpcUser | AnonymousUser | None,
        actor: User | RpcUser | AnonymousUser | None,
    ) -> bool | None:
        raise NotImplementedError

    def has(
        self,
        feature: Feature,
        actor: User | RpcUser | AnonymousUser | None,
        skip_entity: bool | None = False,
    ) -> bool | None:
        return self._check_for_batch(feature.name, feature.get_subject(), actor)

    def has_for_batch(self, batch: FeatureCheckBatch) -> dict[Project, bool | None]:
        flag = self._check_for_batch(batch.feature_name, batch.subject, batch.actor)
        return {obj: flag for obj in batch.objects}
