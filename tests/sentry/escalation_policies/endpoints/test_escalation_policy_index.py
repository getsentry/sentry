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
            "sentry-api-0-organization-escalation-policies",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
            },
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(policy.id)

    def test_new(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")

        url = reverse(
            "sentry-api-0-organization-escalation-policies",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
            },
        )
        response = self.client.put(
            url,
            data={
                "name": "Escalation 1",
                "description": "i am a happy escalation path",
                "repeat_n_times": 2,
                "user_id": self.user.id,
                "steps": [
                    {
                        "escalate_after_sec": 60,
                        "recipients": [
                            {
                                "user_id": self.user.id,
                            },
                        ],
                    }
                ],
            },
            format="json",
        )

        assert response.status_code == 201, response.content

        policy = EscalationPolicy.objects.get(
            organization_id=project.organization.id,
            id=response.data["id"],
        )
        assert policy.organization == project.organization

    def test_update(self):
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
            "sentry-api-0-organization-escalation-policies",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
            },
        )
        response = self.client.put(
            url,
            data={
                "id": policy.id,
                "name": "Escalation 2",
                "description": "i am an updated escalation path",
                "repeat_n_times": 1,
                "user_id": self.user.id,
                "steps": [
                    {
                        "escalate_after_sec": 60,
                        "recipients": [
                            {
                                "user_id": self.user.id,
                            },
                        ],
                    }
                ],
            },
            format="json",
        )

        assert response.status_code == 200, response.content

        policy = EscalationPolicy.objects.get(
            id=policy.id,
        )
        assert len(policy.steps.all()) == 1
        assert policy.name == "Escalation 2"
        assert policy.description == "i am an updated escalation path"
        assert policy.repeat_n_times == 1
        assert policy.steps.first().recipients.first().user_id == self.user.id
