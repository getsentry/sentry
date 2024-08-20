from django.urls import reverse

from sentry.escalation_policies import trigger_escalation_policy
from sentry.escalation_policies.models.escalation_policy_state import (
    EscalationPolicyState,
    EscalationPolicyStateType,
)
from sentry.testutils.cases import APITestCase


class EscalationPolicyStateDetailsTest(APITestCase):
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
            "sentry-api-0-organization-escalation-policy-state-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "escalation_policy_state_id": state.id,
            },
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data["id"] == str(policy.id)

    def test_put(self):
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
            "sentry-api-0-organization-escalation-policy-state-details",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
                "escalation_policy_state_id": state.id,
            },
        )
        response = self.client.put(url, data={"state": "acknowledged"})
        assert response.status_code == 200, response.content

        state = EscalationPolicyState.objects.filter(id=state.id).get()
        assert state.state == EscalationPolicyStateType.ACKNOWLEDGED
