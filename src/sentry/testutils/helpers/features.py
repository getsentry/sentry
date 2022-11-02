__all__ = ["Feature", "with_feature", "apply_feature_flag_on_cls"]

import inspect
import logging
from collections.abc import Mapping
from contextlib import contextmanager
from unittest.mock import patch

import sentry.features
from sentry import features
from sentry.features.base import OrganizationFeature, ProjectFeature
from sentry.features.exceptions import FeatureNotRegistered
from sentry.models.organization import Organization
from sentry.models.project import Project

logger = logging.getLogger(__name__)


@contextmanager
def Feature(names):
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
    """
    if isinstance(names, str):
        names = {names: True}

    elif not isinstance(names, Mapping):
        names = {k: True for k in names}

    default_features = sentry.features.has

    def features_override(name, *args, **kwargs):
        if name in names:
            try:
                feature = features.get(name, None)
            except FeatureNotRegistered:
                raise ValueError("Unregistered feature flag: %s", repr(name))

            if isinstance(feature, OrganizationFeature):
                org = args[0] if len(args) > 0 else kwargs.get("organization", None)
                if not isinstance(org, Organization):
                    raise ValueError("Must provide organization to check feature")

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

    def batch_features_override(_feature_names, projects=None, organization=None, *args, **kwargs):
        if projects:
            feature_names = {name: True for name in names if name.startswith("project")}
            return {f"project:{project.id}": feature_names for project in projects}
        elif organization:
            feature_names = {name: True for name in names if name.startswith("organization")}
            return {f"organization:{organization.id}": feature_names}

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

        return wrapped

    return decorator


def apply_feature_flag_on_cls(feature_flag):
    def decorate(cls):
        for name, fn in inspect.getmembers(cls, inspect.isfunction):
            setattr(cls, name, with_feature(feature_flag)(fn))
        return cls

    return decorate
