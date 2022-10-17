from sentry.models import EventAttachment, File
from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test


@region_silo_test
class EventAttachmentsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        min_ago = iso_format(before_now(minutes=1))
        event1 = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=self.project.id
        )
        event2 = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=self.project.id
        )

        attachment1 = EventAttachment.objects.create(
            event_id=event1.event_id,
            project_id=event1.project_id,
            file_id=File.objects.create(name="hello.png", type="image/png").id,
            name="hello.png",
        )
        file = File.objects.create(name="hello.png", type="image/png")
        EventAttachment.objects.create(
            event_id=event2.event_id,
            project_id=event2.project_id,
            file_id=file.id,
            type=file.type,
            name="hello.png",
        )

        path = f"/api/0/projects/{event1.project.organization.slug}/{event1.project.slug}/events/{event1.event_id}/attachments/"

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(attachment1.id)
        assert response.data[0]["mimetype"] == attachment1.mimetype
        assert response.data[0]["event_id"] == attachment1.event_id

    def test_is_screenshot(self):
        self.login_as(user=self.user)

        min_ago = iso_format(before_now(minutes=1))
        event1 = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=self.project.id
        )

        attachment1 = EventAttachment.objects.create(
            event_id=event1.event_id,
            project_id=event1.project_id,
            file_id=File.objects.create(name="screenshot.png", type="image/png").id,
            name="screenshot.png",
        )
        file = File.objects.create(name="screenshot-not.png", type="image/png")
        EventAttachment.objects.create(
            event_id=event1.event_id,
            project_id=event1.project_id,
            file_id=file.id,
            type=file.type,
            name="screenshot-not.png",
        )

        path = f"/api/0/projects/{event1.project.organization.slug}/{event1.project.slug}/events/{event1.event_id}/attachments/"

        with self.feature("organizations:event-attachments"):
            response = self.client.get(f"{path}?query=is:screenshot")

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(attachment1.id)
        assert response.data[0]["mimetype"] == attachment1.mimetype
        assert response.data[0]["event_id"] == attachment1.event_id
