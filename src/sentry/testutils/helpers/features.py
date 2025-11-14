from typing import int
import logging
from collections.abc import Generator, Iterable, Mapping, Sequence
from contextlib import contextmanager
from functools import wraps
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

__all__ = ("Feature", "with_feature")


logger = logging.getLogger(__name__)


@contextmanager
def Feature(names: str | Iterable[str] | dict[str, bool]) -> Generator[None]:
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
    default_batch_has_for_organizations = sentry.features.batch_has_for_organizations

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
                proj_results = {**feature_results, **default_feature_results.get(result_key, {})}
                results[result_key] = {
                    name: val for name, val in proj_results.items() if name.startswith("project")
                }
            return results
        elif organization:
            result_key = f"organization:{organization.id}"
            results_for_org = {**feature_results, **default_feature_results.get(result_key, {})}
            results_for_org = {
                name: resolve_feature_name_value_for_org(organization, val)
                for name, val in results_for_org.items()
                if name.startswith("organization")
            }
            return {result_key: results_for_org}

    def batch_features_override_for_organizations(
        _feature_name: str, organizations: Sequence[Organization], *args, **kwargs
    ):
        if _feature_name in names:
            return {
                f"organization:{organization.id}": resolve_feature_name_value_for_org(
                    organization, names[_feature_name]
                )
                for organization in organizations
            }
        else:
            return default_batch_has_for_organizations(_feature_name, organizations, **kwargs)

    with (
        patch("sentry.features.has") as features_has,
        patch("sentry.features.batch_has") as features_batch_has,
        patch("sentry.features.batch_has_for_organizations") as features_batch_has_for_orgs,
    ):
        features_has.side_effect = features_override
        features_batch_has.side_effect = batch_features_override
        features_batch_has_for_orgs.side_effect = batch_features_override_for_organizations
        yield


class FeatureContextManagerOrDecorator:
    def __init__(self, feature_names):
        self.feature_names = feature_names
        self._context_manager = None

    def __enter__(self):
        self._context_manager = Feature(self.feature_names)
        return self._context_manager.__enter__()

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._context_manager:
            return self._context_manager.__exit__(exc_type, exc_val, exc_tb)

    def __call__(self, func_or_cls):
        # Check if we're decorating a class
        if isinstance(func_or_cls, type):
            # Apply feature flag to the entire class
            # First, create pytest fixture for compatibility with pytest runs
            feature_names = self.feature_names

            def _feature_fixture(self: object) -> Generator[None]:
                with Feature(feature_names):
                    yield

            name = f"{_feature_fixture.__name__}[{feature_names}]"
            _feature_fixture.__name__ = name
            fixture = pytest.fixture(scope="class", autouse=True)(_feature_fixture)
            setattr(func_or_cls, name, fixture)

            # Additionally, wrap each test method directly so it works when called manually
            # Use vars() to only get attributes defined on this class, not inherited ones
            for attr_name in vars(func_or_cls):
                attr = getattr(func_or_cls, attr_name)

                # More precise method detection
                if (
                    callable(attr)
                    and (
                        attr_name.startswith("test_")
                        # Standard unittest lifecycle methods only
                        or attr_name in ("setUp", "tearDown", "setUpClass", "tearDownClass")
                    )
                    # Ensure it's actually a method (has __self__ attribute when bound) or function
                    and (hasattr(attr, "__func__") or not hasattr(attr, "__self__"))
                ):
                    # Check if already wrapped to avoid double-wrapping
                    if not getattr(attr, "_feature_wrapped", False):

                        def create_wrapped_method(method):
                            @wraps(method)
                            def wrapped_method(*args, **kwargs):
                                with Feature(feature_names):
                                    return method(*args, **kwargs)

                            # Mark as wrapped by our feature decorator
                            wrapped_method._feature_wrapped = True  # type: ignore[attr-defined]
                            return wrapped_method

                        wrapped = create_wrapped_method(attr)
                        setattr(func_or_cls, attr_name, wrapped)

            return func_or_cls

        # Decorating a function - wrap it with the feature context
        @wraps(func_or_cls)
        def wrapper(*args, **kwargs):
            with Feature(self.feature_names):
                return func_or_cls(*args, **kwargs)

        return wrapper


def with_feature(names: str | Iterable[str] | dict[str, bool]):
    """
    Control whether a feature is enabled.

    Can be used as:
    - Context manager: with with_feature('feature-name'):
    - Method decorator: @with_feature('feature-name')
    - Class decorator: @with_feature('feature-name')
    """

    return FeatureContextManagerOrDecorator(names)
