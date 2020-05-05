from __future__ import absolute_import

from sentry.testutils.helpers import override_options, with_feature
from sentry.testutils import TestCase
from sentry.status_checks.slack_integration_version import SlackIntegrationVersion
from sentry.models import Integration, OrganizationMember


class SlackIntegrationVersionBaseTest(TestCase):
    def setUp(self):
        self.request = self.make_request(user=self.user)
        self.status_check = SlackIntegrationVersion()


class CheckOptionsTest(SlackIntegrationVersionBaseTest):
    def test_banner_off_by_default(self):
        with override_options({"slack-migration.banner-sample-rate": 1.0}):
            assert not self.status_check.should_run_queries()

    def test_banner_off_with_sampling(self):
        with override_options(
            {"slack-migration.banner-sample-rate": 0.0, "slack-migration.enable-banner-check": True}
        ):
            assert not self.status_check.should_run_queries()

    def test_banner_on_with_simpling(self):
        with override_options(
            {"slack-migration.banner-sample-rate": 1.0, "slack-migration.enable-banner-check": True}
        ):
            assert self.status_check.should_run_queries()


class SlackIntegrationVersionTest(SlackIntegrationVersionBaseTest):
    def setUp(self):
        super(SlackIntegrationVersionTest, self).setUp()
        self.org = self.create_organization(name="Org 1")
        OrganizationMember.objects.create(organization=self.org, user=self.user, role="owner")
        self.integration = Integration.objects.create(
            provider="slack", external_id="1", metadata={}
        )
        self.integration.add_organization(self.org)

        # throw in an org we aren't part of that has a matching integration
        user2 = self.create_user("bar@example.com")
        org2 = self.create_organization(name="Org 2")
        OrganizationMember.objects.create(organization=org2, user=user2, role="owner")
        integration = Integration.objects.create(provider="slack", external_id="2", metadata={})
        integration.add_organization(org2)

    @with_feature("organizations:slack-migration")
    def test_show_alert(self):
        with override_options(
            {"slack-migration.banner-sample-rate": 1.0, "slack-migration.enable-banner-check": True}
        ):
            problems = self.status_check.check(self.request)
            assert len(problems) == 1
            assert problems[0].message == u"Click here to upgrade your Slack integration"
            assert problems[0].severity == "warning"
            assert problems[0].url == "/settings/%s/integrations/slack/?tab=configurations" % (
                self.org.slug
            )

    def test_no_alert_no_feature_flag(self):
        with override_options(
            {"slack-migration.banner-sample-rate": 1.0, "slack-migration.enable-banner-check": True}
        ):
            assert not self.status_check.check(self.request)

    @with_feature("organizations:slack-migration")
    def test_no_alert_if_member(self):
        org_member = OrganizationMember.objects.get(organization=self.org, user=self.user)
        org_member.role = "member"
        org_member.save()
        with override_options(
            {"slack-migration.banner-sample-rate": 1.0, "slack-migration.enable-banner-check": True}
        ):
            assert not self.status_check.check(self.request)

    @with_feature("organizations:slack-migration")
    def test_no_alert_different_integration(self):
        self.integration.provider = "github"
        self.integration.save()
        with override_options(
            {"slack-migration.banner-sample-rate": 1.0, "slack-migration.enable-banner-check": True}
        ):
            assert not self.status_check.check(self.request)

    @with_feature("organizations:slack-migration")
    def test_no_alert_has_installation_type(self):
        self.integration.metadata = {"installation_type": "born_as_bot"}
        self.integration.save()
        with override_options(
            {"slack-migration.banner-sample-rate": 1.0, "slack-migration.enable-banner-check": True}
        ):
            assert not self.status_check.check(self.request)
