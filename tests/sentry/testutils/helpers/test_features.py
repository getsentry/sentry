from unittest import mock

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


class TestWithFeatureClassDecorator(TestCase):
    """Test that with_feature works correctly when used as a class decorator."""

    def test_with_feature_on_class_works(self):
        """Test that using with_feature as a class decorator enables features for all methods."""

        @with_feature("organizations:global-views")
        class TestClassWithFeature(TestCase):
            def test_method_1(self):
                org = self.create_organization()
                assert features.has("organizations:global-views", org)

            def test_method_2(self):
                org = self.create_organization()
                assert features.has("organizations:global-views", org)

        # Verify the fixture was created
        fixture_found = False
        for attr_name in dir(TestClassWithFeature):
            if (
                attr_name.startswith("_feature_fixture")
                and "organizations:global-views" in attr_name
            ):
                fixture_found = True
                break

        assert fixture_found, "Feature fixture was not created on the class"

        test_instance = TestClassWithFeature()
        test_instance.setUp()
        test_instance.test_method_1()
        test_instance.test_method_2()
