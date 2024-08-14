from django.urls import reverse

from sentry.escalation_policies.models.escalation_policy import EscalationPolicy
from sentry.testutils.cases import APITestCase


class EscalationPolicyCreateTest(APITestCase):
    def test_get(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        policy = self.create_escalation_policy(
            organization=project.organization,
            name="Escalation 1",
            description="i am a happy escalation path",
            repeat_n_times=2,
            user_id=self.user.id,
        )

        url = reverse(
            "sentry-api-0-organization-escalation-policy-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "escalation_policy_id": policy.id,
            },
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(policy.id)

    def test_delete(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        policy = self.create_escalation_policy(
            organization=project.organization,
            name="Escalation 1",
            description="i am a happy escalation path",
            repeat_n_times=2,
            user_id=self.user.id,
        )

        url = reverse(
            "sentry-api-0-organization-escalation-policy-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "escalation_policy_id": policy.id,
            },
        )
        response = self.client.delete(url)
        assert response.status_code == 204, response.content

        assert not EscalationPolicy.objects.filter(id=policy.id).exists()
