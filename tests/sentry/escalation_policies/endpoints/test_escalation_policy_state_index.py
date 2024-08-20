from django.urls import reverse

from sentry.escalation_policies import trigger_escalation_policy
from sentry.testutils.cases import APITestCase


class EscalationPolicyStateIndexTest(APITestCase):
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
        group = self.create_group(project=project)
        state = trigger_escalation_policy(policy, group)

        url = reverse(
            "sentry-api-0-organization-escalation-policy-states",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
            },
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == state.id
