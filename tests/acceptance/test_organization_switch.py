from __future__ import absolute_import

from django.utils import timezone
from sentry.testutils import AcceptanceTestCase, SnubaTestCase


class OrganizationSwitchTest(AcceptanceTestCase, SnubaTestCase):
    def setUp(self):
        super(OrganizationSwitchTest, self).setUp()

        self.project_1 = self.create_project(
            organization=self.organization, teams=[self.team], name="Bengal"
        )
        self.project_2 = self.create_project(
            organization=self.organization, teams=[self.team], name="Sumatra"
        )
        self.project_3 = self.create_project(
            organization=self.organization, teams=[self.team], name="Siberian"
        )
        self.PRIMARY_PROJECTS_COUNT = 4
        self.secondary_org = self.create_organization(owner=self.user, name="Banana Duck")

        self.secondary_team = self.create_team(
            organization=self.secondary_org, name="Second", members=[self.user]
        )

        self.project_4 = self.create_project(
            organization=self.secondary_org, teams=[self.secondary_team], name="Gone Goose"
        )

        self.project_5 = self.create_project(
            organization=self.secondary_org, teams=[self.secondary_team], name="Peaceful Platypus"
        )

        self.SECONDARY_PROJECTS_COUNT = 2

        self.login_as(self.user)

    def test_organization_switches(self):
        issues_url_creator = lambda org_slug: u"organizations/{org_id}/issues/".format(
            org_id=org_slug
        )
        releases_url_creator = lambda org_slug: u"organizations/{org_id}/releases/".format(
            org_id=org_slug
        )
        discover_url_creator = lambda org_slug: u"organizations/{org_id}/discover/".format(
            org_id=org_slug
        )
        user_feedback_url_creator = lambda org_slug: u"organizations/{org_id}/user-feedback/".format(
            org_id=org_slug
        )

        primary_slug = self.organization.slug
        secondary_slug = self.secondary_org.slug

        origin_url = issues_url_creator(primary_slug)
        destination_url = issues_url_creator(secondary_slug)

        transition_urls = [
            url_creator(primary_slug)
            for url_creator in [
                issues_url_creator,
                releases_url_creator,
                discover_url_creator,
                user_feedback_url_creator,
            ]
        ]

        with self.settings(SENTRY_SINGLE_ORGANIZATION=False), self.feature(
            "organizations:discover"
        ):
            self.project.update(first_event=timezone.now())
            for transition_url in transition_urls:
                self.browser.get(origin_url)
                self.browser.wait_until_not(".loading-indicator")
                self.browser.click_when_visible(
                    selector='[data-test-id="global-header-project-selector"]', timeout=10
                )
                primary_count = len(
                    self.browser.driver.find_elements_by_css_selector(
                        "[data-test-id=badge-display-name]"
                    )
                )
                assert primary_count == self.PRIMARY_PROJECTS_COUNT

                self.browser.get(transition_url)
                self.browser.wait_until_not(".loading-indicator")

                self.browser.get(destination_url)
                self.browser.wait_until_not(".loading-indicator")
                self.browser.click('[data-test-id="global-header-project-selector"]')
                secondary_count = len(
                    self.browser.driver.find_elements_by_css_selector(
                        "[data-test-id=badge-display-name]"
                    )
                )
                assert secondary_count == self.SECONDARY_PROJECTS_COUNT
