from unittest.mock import patch

from sentry.models.group import Group
from sentry.testutils.cases import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba
from sentry.utils.samples import load_data

pytestmark = [requires_snuba]


@region_silo_test
class GroupAIAutofixEndpointTest(APITestCase, SnubaTestCase):
    def test_ai_autofix_get_endpoint_with_autofix(self):
        group = self.create_group()
        metadata = {
            "autofix": {
                "status": "PROCESSING",
            }
        }
        group.data["metadata"] = metadata
        group.save()

        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/ai-autofix/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is not None
        assert response.data["autofix"]["status"] == "PROCESSING"

    def test_ai_autofix_get_endpoint_without_autofix(self):
        group = self.create_group()
        metadata = {
            "autofix": None,
        }
        group.data["metadata"] = metadata
        group.save()

        self.login_as(user=self.user)
        url = f"/api/0/issues/{group.id}/ai-autofix/"
        response = self.client.get(url, format="json")

        assert response.status_code == 200
        assert response.data["autofix"] is None

    def test_ai_autofix_post_endpoint(self):
        release = self.create_release(project=self.project, version="1.0.0")

        repo = self.create_repo(
            project=self.project, name="getsentry/sentry", provider="integrations:github"
        )
        repo.save()

        self.create_commit(project=self.project, release=release, key="1234", repo=repo)

        data = load_data("python", timestamp=before_now(minutes=1))
        event = self.store_event(
            data={
                **data,
                "release": release.version,
            },
            project_id=self.project.id,
        )

        group = event.group

        assert group is not None
        group.save()

        url = f"/api/0/issues/{group.id}/ai-autofix/"
        self.login_as(user=self.user)
        with patch("sentry.api.endpoints.group_ai_autofix.requests.post") as mock_post:
            response = self.client.post(url, data={"additional_context": "Yes"}, format="json")
            mock_post.assert_called_once()
            mock_post.assert_called_with(
                "http://127.0.0.1:9091/v0/automation/autofix",
                json={
                    "additional_context": "Yes",
                    "base_commit_sha": "1234",
                    "issue": {
                        "events": [{"entries": []}],
                        "id": group.id,
                        "title": group.title,
                    },
                },
                headers={"content-type": "application/json;charset=utf-8"},
            )

        group = Group.objects.get(id=group.id)

        assert response.status_code == 202
        assert "autofix" in group.data["metadata"]
        assert group.data["metadata"]["autofix"]["status"] == "PROCESSING"
