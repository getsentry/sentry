from unittest import mock

import pytest

from sentry import features
from sentry.organizations.services.organization import RpcOrganization, organization_service
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature


class TestTestUtilsFeatureHelper(TestCase):
    def setUp(self) -> None:
        self.org = self.create_organization()

    def test_without_feature(self) -> None:
        assert not features.has("organizations:global-views", self.org)

    @with_feature("organizations:global-views")
    def test_with_feature(self) -> None:
        assert features.has("organizations:global-views", self.org)

    def test_batch_has(self) -> None:
        # Test that overrides work, and if no overrides are made that we still fall back to the
        # defaults
        with mock.patch("sentry.features.default_manager._entity_handler", new=None):
            with self.feature("system:multi-region"):
                # Make sure this check returns True for features that are defaulted to True and aren't
                # mocked
                ret = features.batch_has(
                    [
                        "organizations:advanced-search",
                        "organizations:codecov-integration",
                    ],
                    organization=self.org,
                )
                assert ret is not None
                results = list(ret.values())[0]
                assert results["organizations:advanced-search"]
                assert not results["organizations:codecov-integration"]

    def test_feature_with_rpc_organization(self) -> None:
        with self.feature({"system:multi-region": False}):
            org_context = organization_service.get_organization_by_slug(
                slug=self.org.slug, only_visible=False, user_id=None
            )
            assert org_context
            assert org_context.organization
            assert isinstance(org_context.organization, RpcOrganization)

            assert features.has("system:multi-region") is False

        with self.feature({"system:multi-region": True}):
            org_context = organization_service.get_organization_by_slug(
                slug=self.org.slug, only_visible=False, user_id=None
            )
            assert org_context
            assert org_context.organization
            assert isinstance(org_context.organization, RpcOrganization)

            assert features.has("system:multi-region")

            assert features.has("system:multi-region")


class TestWithFeatureClassDecoratorError(TestCase):
    """Test that with_feature raises an error when used as a class decorator."""

    def test_with_feature_on_class_raises_error(self):
        """Test that using with_feature as a class decorator raises ValueError."""

        with pytest.raises(ValueError) as exc_info:

            @with_feature("organizations:test-feature")
            class TestClass:
                pass

        error_message = str(exc_info.value)
        assert "with_feature cannot be used as a class decorator" in error_message
        assert "Use apply_feature_flag_on_cls instead" in error_message
        assert "organizations:test-feature" in error_message
        assert "TestClass" in error_message
