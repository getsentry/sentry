from sentry import features
from sentry.services.hybrid_cloud.organization import RpcOrganization, organization_service
from sentry.testutils import TestCase
from sentry.testutils.helpers import with_feature
from sentry.testutils.silo import region_silo_test


@region_silo_test(stable=True)
class TestTestUtilsFeatureHelper(TestCase):
    def setUp(self):
        self.org = self.create_organization()

    def test_without_feature(self):
        assert not features.has("organizations:global-views", self.org)

    @with_feature("organizations:global-views")
    def test_with_feature(self):
        assert features.has("organizations:global-views", self.org)

    def test_feature_with_rpc_organization(self):

        with self.feature({"organizations:customer-domains": False}):
            org_context = organization_service.get_organization_by_slug(
                slug=self.org.slug, only_visible=False, user_id=None
            )
            assert org_context
            assert org_context.organization
            assert isinstance(org_context.organization, RpcOrganization)

            assert features.has("organizations:customer-domains", org_context.organization) is False

        with self.feature({"organizations:customer-domains": True}):
            org_context = organization_service.get_organization_by_slug(
                slug=self.org.slug, only_visible=False, user_id=None
            )
            assert org_context
            assert org_context.organization
            assert isinstance(org_context.organization, RpcOrganization)

            assert features.has("organizations:customer-domains", org_context.organization)

        other_org = self.create_organization()
        with self.feature({"organizations:customer-domains": [other_org.slug]}):
            # Feature not enabled for self.org
            org_context = organization_service.get_organization_by_slug(
                slug=self.org.slug, only_visible=False, user_id=None
            )
            assert org_context
            assert org_context.organization
            assert isinstance(org_context.organization, RpcOrganization)

            assert features.has("organizations:customer-domains", org_context.organization) is False

            # Feature enabled for other_org
            org_context = organization_service.get_organization_by_slug(
                slug=other_org.slug, only_visible=False, user_id=None
            )
            assert org_context
            assert org_context.organization
            assert isinstance(org_context.organization, RpcOrganization)

            assert features.has("organizations:customer-domains", org_context.organization)
