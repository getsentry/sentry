from typing import int
from unittest import mock

from sentry import features
from sentry.organizations.services.organization import RpcOrganization, organization_service
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers import with_feature


class TestTestUtilsFeatureHelper(TestCase):
    def setUp(self) -> None:
        self.org = self.create_organization()

    def test_without_feature(self) -> None:
        assert not features.has("organizations:session-replay", self.org)

    @with_feature("organizations:session-replay")
    def test_with_feature(self) -> None:
        assert features.has("organizations:session-replay", self.org)

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


class TestWithFeatureClassDecorator(TestCase):
    """Test that with_feature works correctly when used as a class decorator."""

    def test_with_feature_on_class_works(self) -> None:
        """Test that using with_feature as a class decorator enables features for all methods."""

        @with_feature("organizations:session-replay")
        class TestClassWithFeature(TestCase):
            def test_method_1(self) -> None:
                org = self.create_organization()
                assert features.has("organizations:session-replay", org)

            def test_method_2(self) -> None:
                org = self.create_organization()
                assert features.has("organizations:session-replay", org)

        # Verify the fixture was created
        fixture_found = False
        for attr_name in dir(TestClassWithFeature):
            if (
                attr_name.startswith("_feature_fixture")
                and "organizations:session-replay" in attr_name
            ):
                fixture_found = True
                break

        assert fixture_found, "Feature fixture was not created on the class"

        test_instance = TestClassWithFeature()
        test_instance.setUp()
        test_instance.test_method_1()
        test_instance.test_method_2()


class TestNestedFeatureOverrides(TestCase):
    """Test that nested with_feature contexts work correctly with proper precedence."""

    def setUp(self) -> None:
        self.org = self.create_organization()

    def test_nested_context_managers_override(self) -> None:
        """Test that nested context managers properly override outer contexts."""
        # Initially disabled
        assert not features.has("organizations:session-replay", self.org)
        assert not features.has("organizations:codecov-integration", self.org)

        # Enable feature in outer context
        with self.feature("organizations:session-replay"):
            assert features.has("organizations:session-replay", self.org)

            # Override to disable in inner context
            with self.feature({"organizations:session-replay": False}):
                assert not features.has("organizations:session-replay", self.org)

                # Enable different feature in inner context
                with self.feature("organizations:codecov-integration"):
                    assert not features.has(
                        "organizations:session-replay", self.org
                    )  # Still disabled
                    assert features.has("organizations:codecov-integration", self.org)  # Enabled

            # Back to outer context - should be enabled again
            assert features.has("organizations:session-replay", self.org)

    def test_multiple_features_nested_contexts(self) -> None:
        """Test multiple features being enabled/disabled in nested contexts."""
        with self.feature(
            {"organizations:session-replay": True, "organizations:codecov-integration": False}
        ):
            assert features.has("organizations:session-replay", self.org)
            assert not features.has("organizations:codecov-integration", self.org)

            # Override both in nested context
            with self.feature(
                {"organizations:session-replay": False, "organizations:codecov-integration": True}
            ):
                assert not features.has("organizations:session-replay", self.org)
                assert features.has("organizations:codecov-integration", self.org)

            # Back to original state
            assert features.has("organizations:session-replay", self.org)
            assert not features.has("organizations:codecov-integration", self.org)

    @with_feature("organizations:session-replay")
    def test_method_decorator_with_context_override(self) -> None:
        """Test that context managers can override method-level decorators."""
        # Method decorator enables the feature
        assert features.has("organizations:session-replay", self.org)

        # Context manager overrides to disable
        with self.feature({"organizations:session-replay": False}):
            assert not features.has("organizations:session-replay", self.org)

        # Back to method decorator state
        assert features.has("organizations:session-replay", self.org)

    @with_feature(
        {"organizations:session-replay": True, "organizations:codecov-integration": False}
    )
    def test_method_decorator_multiple_features_with_context_override(self) -> None:
        """Test context manager overriding specific features from method decorator."""
        # Method decorator state
        assert features.has("organizations:session-replay", self.org)
        assert not features.has("organizations:codecov-integration", self.org)

        # Override only one feature in context
        with self.feature({"organizations:codecov-integration": True}):
            assert features.has("organizations:session-replay", self.org)  # Still from decorator
            assert features.has("organizations:codecov-integration", self.org)  # Overridden

        # Back to decorator state
        assert features.has("organizations:session-replay", self.org)
        assert not features.has("organizations:codecov-integration", self.org)


@with_feature("organizations:session-replay")
class TestClassDecoratorWithNestedOverrides(TestCase):
    """Test nested overrides when the class itself has a feature decorator."""

    def setUp(self) -> None:
        self.org = self.create_organization()

    def test_class_decorator_baseline(self) -> None:
        """Verify the class decorator is working."""
        assert features.has("organizations:session-replay", self.org)

    def test_context_manager_override_class_decorator(self) -> None:
        """Test that context managers can override class-level decorators."""
        # Class decorator enables the feature
        assert features.has("organizations:session-replay", self.org)

        # Context manager overrides to disable
        with self.feature({"organizations:session-replay": False}):
            assert not features.has("organizations:session-replay", self.org)

            # Nested context enables it again
            with self.feature("organizations:session-replay"):
                assert features.has("organizations:session-replay", self.org)

            # Back to first override
            assert not features.has("organizations:session-replay", self.org)

        # Back to class decorator state
        assert features.has("organizations:session-replay", self.org)

    @with_feature("organizations:codecov-integration")
    def test_method_and_class_decorators_with_context_override(self) -> None:
        """Test interaction of class decorator + method decorator + context manager."""
        # Both class and method decorators should be active
        assert features.has("organizations:session-replay", self.org)  # From class
        assert features.has("organizations:codecov-integration", self.org)  # From method

        # Override both with context manager
        with self.feature(
            {"organizations:session-replay": False, "organizations:codecov-integration": False}
        ):
            assert not features.has("organizations:session-replay", self.org)
            assert not features.has("organizations:codecov-integration", self.org)

        # Back to decorator states
        assert features.has("organizations:session-replay", self.org)
        assert features.has("organizations:codecov-integration", self.org)

    def test_deeply_nested_context_managers(self) -> None:
        """Test deeply nested context managers with alternating states."""
        # Start with class decorator enabled
        assert features.has("organizations:session-replay", self.org)

        with self.feature({"organizations:session-replay": False}):  # Level 1: Disabled
            assert not features.has("organizations:session-replay", self.org)

            with self.feature("organizations:session-replay"):  # Level 2: Enabled
                assert features.has("organizations:session-replay", self.org)

                with self.feature({"organizations:session-replay": False}):  # Level 3: Disabled
                    assert not features.has("organizations:session-replay", self.org)

                    with self.feature("organizations:session-replay"):  # Level 4: Enabled
                        assert features.has("organizations:session-replay", self.org)

                    # Back to level 3
                    assert not features.has("organizations:session-replay", self.org)

                # Back to level 2
                assert features.has("organizations:session-replay", self.org)

            # Back to level 1
            assert not features.has("organizations:session-replay", self.org)

        # Back to class decorator
        assert features.has("organizations:session-replay", self.org)
