from django.test.client import RequestFactory

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.models.groupshare import GroupShare
from sentry.testutils.helpers.datetime import before_now


class SharedGroupDetailsDocs(APIDocsTestCase):
    def setUp(self) -> None:
        event = self.store_event(
            data={
                "timestamp": before_now(minutes=1).isoformat(),
                "message": "Payment failed",
                "user": {"email": "user@example.com"},
                "tags": {"region": "us"},
                "breadcrumbs": [{"message": "Checkout started"}],
            },
            project_id=self.project.id,
        )
        assert event.group is not None
        share = GroupShare.objects.create(project_id=event.group.project_id, group=event.group)
        self.url = f"/api/0/organizations/{self.organization.slug}/shared/issues/{share.uuid}/"

    def test_get(self) -> None:
        # Shared issues are public, so the request is not authenticated.
        response = self.client.get(self.url)
        assert response.data["latestEvent"]["message"] == "Payment failed"
        assert "user" not in response.data["latestEvent"]
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
