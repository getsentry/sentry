from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import OrganizationOnboardingTask, OnboardingTask, OnboardingTaskStatus
from sentry.testutils import APITestCase


class SkipOnboardingTaskTest(APITestCase):
    def test_update_onboarding_task(self):
        self.login_as(user=self.user)

        organization = self.create_organization(name="foo", owner=self.user)
        url = reverse(
            "sentry-api-0-organization-onboardingtasks",
            kwargs={"organization_slug": organization.slug},
        )

        resp = self.client.post(
            url, data={"task": "setup_issue_tracker", "status": "skipped"}, format="json"
        )
        assert resp.status_code == 204

        oot = OrganizationOnboardingTask.objects.get(
            organization=organization,
            task=OnboardingTask.ISSUE_TRACKER,
            status=OnboardingTaskStatus.SKIPPED,
        )

        assert oot
