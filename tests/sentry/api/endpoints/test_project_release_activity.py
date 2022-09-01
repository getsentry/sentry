from datetime import datetime, timedelta

from django.utils import timezone

from sentry.api.serializers import serialize
from sentry.models import Release, ReleaseActivity
from sentry.testutils import APITestCase, TestCase
from sentry.types.releaseactivity import ReleaseActivityType


class ReleaseActivitySerializerTest(TestCase):
    def test_empty_data(self):
        now = datetime.now()

        acts = [
            ReleaseActivity.objects.create(
                type=ReleaseActivityType.CREATED.value,
                release=self.release,
                date_added=now,
            ),
            ReleaseActivity.objects.create(
                type=ReleaseActivityType.DEPLOYED.value,
                release=self.release,
                data={"environment": str(self.environment.name)},
                date_added=now,
            ),
            ReleaseActivity.objects.create(
                type=ReleaseActivityType.FINISHED.value,
                release=self.release,
                date_added=now,
            ),
        ]

        serialized_acts = serialize(acts, self.user)

        assert serialized_acts == [
            {
                "id": acts[0].id,
                "type": ReleaseActivityType.CREATED.name,
                "data": {},
                "dateAdded": now,
            },
            {
                "id": acts[1].id,
                "type": ReleaseActivityType.DEPLOYED.name,
                "data": {"environment": str(self.environment.name)},
                "dateAdded": now,
            },
            {
                "id": acts[2].id,
                "type": ReleaseActivityType.FINISHED.name,
                "data": {},
                "dateAdded": now,
            },
        ]

    def test_resolve_group_none(self):
        now = datetime.now()
        issue_act = ReleaseActivity.objects.create(
            type=ReleaseActivityType.ISSUE.value,
            release=self.release,
            data={"group_id": 1111},
            date_added=now,
        )

        assert serialize(issue_act, self.user) == {
            "id": issue_act.id,
            "type": ReleaseActivityType(issue_act.type).name,
            "data": {"group_id": 1111, "group": None},
            "dateAdded": now,
        }

    def test_resolve_group_id(self):
        now = datetime.now()

        serialized_group = serialize(self.group, self.user)

        issue_act = ReleaseActivity.objects.create(
            type=ReleaseActivityType.ISSUE.value,
            release=self.release,
            data={"group_id": self.group.id},
            date_added=now,
        )

        assert serialize(issue_act, self.user) == {
            "id": issue_act.id,
            "type": ReleaseActivityType(issue_act.type).name,
            "data": {"group_id": self.group.id, "group": serialized_group},
            "dateAdded": now,
        }


class ReleaseActivityTest(APITestCase):
    endpoint = "sentry-api-0-project-release-activity"

    def test_flag_off_404(self):
        self.login_as(user=self.user)

        response = self.get_response(
            self.project.organization.slug, self.project.slug, "doesnt_matter"
        )
        not_found = self.client.get("/api/0/bad_endpoint")
        assert response.status_code == not_found.status_code == 404

    def test_simple(self):
        with self.feature("organizations:active-release-monitor-alpha"):
            now = timezone.now()

            project = self.create_project(name="foo")
            release = Release.objects.create(
                organization_id=project.organization_id,
                version="1",
                date_added=now - timedelta(hours=5),
            )
            release.add_project(project)

            # ReleaseActivityType.created gets automatically created when a Release is created
            # no need to manually create it here

            ReleaseActivity.objects.create(
                type=ReleaseActivityType.DEPLOYED.value,
                release=release,
                date_added=now - timedelta(hours=1, minutes=1),
            )

            ReleaseActivity.objects.create(
                type=ReleaseActivityType.ISSUE.value,
                data={"group_id": self.group.id},
                release=release,
                date_added=now - timedelta(minutes=33),
            )

            ReleaseActivity.objects.create(
                type=ReleaseActivityType.FINISHED.value,
                release=release,
                date_added=now - timedelta(minutes=1),
            )

            self.login_as(user=self.user)
            response = self.get_response(project.organization.slug, project.slug, release.version)
            assert response.status_code == 200
            assert len(response.data) == 4
            assert response.data[0]["type"] == ReleaseActivityType.CREATED.name
            assert response.data[1]["type"] == ReleaseActivityType.DEPLOYED.name
            assert response.data[2]["type"] == ReleaseActivityType.ISSUE.name
            assert response.data[2]["data"].get("group_id") == self.group.id
            assert response.data[2]["data"]["group"] == serialize(self.group, self.user)
            assert response.data[3]["type"] == ReleaseActivityType.FINISHED.name
