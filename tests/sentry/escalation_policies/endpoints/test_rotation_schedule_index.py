from django.urls import reverse

from sentry.escalation_policies.models.rotation_schedule import RotationSchedule
from sentry.testutils.cases import APITestCase


class RotationScheduleCreateTest(APITestCase):
    def test_get(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        schedule = RotationSchedule.objects.create(
            name="schedule A",
            organization=project.organization,
        )

        url = reverse(
            "sentry-api-0-organization-rotation-schedules",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
            },
        )
        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(schedule.id)

    def test_new(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        userA = self.create_user()
        userB = self.create_user()

        url = reverse(
            "sentry-api-0-organization-rotation-schedules",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
            },
        )
        response = self.client.put(
            url,
            data={
                "name": "Schedule A",
                "user_id": self.user.id,
                "schedule_layers": [
                    {
                        "rotation_type": "weekly",
                        "handoff_time": "0 4 * * 1",
                        "start_time": "2024-01-01T00:00:00+00:00",
                        "schedule_layer_restrictions": {
                            "Sun": [],
                            "Mon": [["08:00", "17:00"]],
                            "Tue": [["08:00", "17:00"]],
                            "Wed": [["08:00", "17:00"]],
                            "Thu": [["08:00", "17:00"]],
                            "Fri": [["08:00", "17:00"]],
                            "Sat": [],
                        },
                        "user_ids": [userA.id, userB.id],
                    }
                ],
            },
            format="json",
        )

        assert response.status_code == 201, response.content

        policy = RotationSchedule.objects.get(
            organization_id=project.organization.id,
            id=response.data["id"],
        )
        assert policy.organization == project.organization

    def test_update(self):
        self.login_as(user=self.user)

        project = self.create_project(name="foo")
        userA = self.create_user()
        userB = self.create_user()

        schedule = RotationSchedule.objects.create(
            name="schedule A",
            organization=project.organization,
        )

        url = reverse(
            "sentry-api-0-organization-rotation-schedules",
            kwargs={
                "organization_id_or_slug": project.organization.slug,
            },
        )
        response = self.client.put(
            url,
            data={
                "id": schedule.id,
                "name": "Schedule B",
                "user_id": self.user.id,
                "schedule_layers": [
                    {
                        "rotation_type": "weekly",
                        "handoff_time": "0 4 * * 1",
                        "start_time": "2024-01-01T00:00:00+00:00",
                        "schedule_layer_restrictions": {
                            "Sun": [],
                            "Mon": [["08:00", "17:00"]],
                            "Tue": [["08:00", "17:00"]],
                            "Wed": [["08:00", "17:00"]],
                            "Thu": [["08:00", "17:00"]],
                            "Fri": [["08:00", "17:00"]],
                            "Sat": [],
                        },
                        "user_ids": [userA.id, userB.id],
                    }
                ],
            },
            format="json",
        )

        assert response.status_code == 200, response.content

        schedule = RotationSchedule.objects.get(
            id=schedule.id,
        )
        assert len(schedule.layers.all()) == 1
        assert schedule.name == "Schedule B"
