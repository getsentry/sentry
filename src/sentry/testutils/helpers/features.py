__all__ = ["Feature", "with_feature", "apply_feature_flag_on_cls"]

import functools
import logging
from collections.abc import Generator, Mapping, Sequence
from contextlib import contextmanager
from unittest.mock import patch

import pytest

import sentry.features
from sentry import features
from sentry.features.base import OrganizationFeature, ProjectFeature
from sentry.features.exceptions import FeatureNotRegistered
from sentry.models.organization import Organization
from sentry.models.project import Project
from sentry.organizations.services.organization import (
    RpcOrganization,
    RpcOrganizationSummary,
    RpcUserOrganizationContext,
)

logger = logging.getLogger(__name__)


@contextmanager
def Feature(names: str | Sequence[str] | dict[str, bool]) -> Generator[None]:
    """
    Control whether a feature is enabled.

    A single feature may be conveniently enabled with

    >>> with Feature('feature-1'):
    >>>   # Executes with feature-1 enabled

    More advanced enabling / disabling can be done using a dict

    >>> with Feature({'feature-1': True, 'feature-2': False}):
    >>>   # Executes with feature-1 enabled and feature-2 disabled

    The following two invocations are equivalent:

    >>> with Feature(['feature-1', 'feature-2']):
    >>>   # execute with both features enabled
    >>> with Feature({'feature-1': True, 'feature-2': True}):
    >>>   # execute with both features enabled

    You can enable features for specific organizations:

    >>> with Feature({'feature-1': ['org-slug', 'albertos-apples']}):
    >>>   # execute with feature-1 enabled for any organizations whose slug matches either "org-slug" or "albertos-apples"
    """
    if isinstance(names, str):
        names = {names: True}

    elif not isinstance(names, Mapping):
        names = {k: True for k in names}

    default_features = sentry.features.has
    default_batch_has = sentry.features.batch_has

    def resolve_feature_name_value_for_org(organization, feature_name_value):
        if isinstance(feature_name_value, list):
            return organization.slug in feature_name_value
        return feature_name_value

    def features_override(name, *args, **kwargs):
        if name in names:
            try:
                feature = features.get(name, None)
            except FeatureNotRegistered:
                raise ValueError("Unregistered feature flag: %s", repr(name))

            if isinstance(feature, OrganizationFeature):
                org = args[0] if len(args) > 0 else kwargs.get("organization", None)
                if not isinstance(
                    org,
                    (
                        Organization,
                        RpcOrganizationSummary,
                        RpcOrganization,
                        RpcUserOrganizationContext,
                    ),
                ):
                    raise ValueError("Must provide organization to check feature")
                return resolve_feature_name_value_for_org(org, names[name])

            if isinstance(feature, ProjectFeature):
                project = args[0] if len(args) > 0 else kwargs.get("project", None)
                if not isinstance(project, Project):
                    raise ValueError("Must provide project to check feature")

            return names[name]
        else:
            try:
                default_value = default_features(name, *args, **kwargs)
            except FeatureNotRegistered:
                logger.info("Unregistered flag defaulting to False: %s", repr(name))
                return False

            if default_value:
                logger.info("Flag defaulting to %s: %s", default_value, repr(name))
            return default_value

    def batch_features_override(
        _feature_names: Sequence[str], projects=None, organization=None, *args, **kwargs
    ):
        feature_results = {name: names[name] for name in _feature_names if name in names}
        default_feature_names = [name for name in _feature_names if name not in names]
        default_feature_results: dict[str, dict[str, bool | None]] = {}
        if default_feature_names:
            defaults = default_batch_has(
                default_feature_names, projects=projects, organization=organization, **kwargs
            )
            if defaults:
                default_feature_results.update(defaults)

        if projects:
            results = {}
            for project in projects:
                result_key = f"project:{project.id}"
                proj_results = {**feature_results, **default_feature_results[result_key]}
                results[result_key] = {
                    name: val for name, val in proj_results.items() if name.startswith("project")
                }
            return results
        elif organization:
            result_key = f"organization:{organization.id}"
            results_for_org = {**feature_results, **default_feature_results[result_key]}
            results_for_org = {
                name: resolve_feature_name_value_for_org(organization, val)
                for name, val in results_for_org.items()
                if name.startswith("organization")
            }
            return {result_key: results_for_org}

    with patch("sentry.features.has") as features_has:
        features_has.side_effect = features_override
        with patch("sentry.features.batch_has") as features_batch_has:
            features_batch_has.side_effect = batch_features_override
            yield


def with_feature(feature):
    def decorator(func):
        def wrapped(self, *args, **kwargs):
            with Feature(feature):
                return func(self, *args, **kwargs)

        functools.update_wrapper(wrapped, func)
        return wrapped

    return decorator


def apply_feature_flag_on_cls(feature_flag):
    def decorate(cls):
        def _feature_fixture(self: object) -> Generator[None]:
            with Feature(feature_flag):
                yield

        name = f"{_feature_fixture.__name__}[{feature_flag}]"
        _feature_fixture.__name__ = name
        fixture = pytest.fixture(scope="class", autouse=True)(_feature_fixture)
        setattr(cls, name, fixture)
        return cls

    return decorate
