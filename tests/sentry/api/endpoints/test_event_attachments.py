from io import BytesIO

from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers.datetime import before_now, iso_format
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


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

        file1 = File.objects.create(name="hello.png", type="event.attachment")
        file1.putfile(BytesIO(b"File contents here"))
        attachment1 = EventAttachment.objects.create(
            project_id=event1.project_id,
            event_id=event1.event_id,
            type="event.attachment",
            name=file1.name,
            file_id=file1.id,
        )

        attachment2 = EventAttachment.objects.create(
            project_id=event2.project_id,
            event_id=event2.event_id,
            type="event.attachment",
            name="hello.png",
            content_type="image/png",
            size=1234,
            sha1="1234",
            # NOTE: we are not actually attaching the `file_id` here
        )

        path = f"/api/0/projects/{event1.project.organization.slug}/{event1.project.slug}/events/{event1.event_id}/attachments/"

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(attachment1.id)
        assert response.data[0]["event_id"] == attachment1.event_id
        assert response.data[0]["type"] == "event.attachment"
        assert response.data[0]["name"] == "hello.png"
        assert response.data[0]["mimetype"] == "image/png"
        assert response.data[0]["size"] == 18
        assert response.data[0]["sha1"] == "d3f299af02d6abbe92dd8368bab781824a9702ed"
        assert response.data[0]["headers"] == {"Content-Type": "image/png"}

        path = f"/api/0/projects/{event2.project.organization.slug}/{event2.project.slug}/events/{event2.event_id}/attachments/"

        with self.feature("organizations:event-attachments"):
            response = self.client.get(path)

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(attachment2.id)
        assert response.data[0]["event_id"] == attachment2.event_id
        assert response.data[0]["type"] == "event.attachment"
        assert response.data[0]["name"] == "hello.png"
        assert response.data[0]["mimetype"] == "image/png"
        assert response.data[0]["size"] == 1234
        assert response.data[0]["sha1"] == "1234"
        assert response.data[0]["headers"] == {"Content-Type": "image/png"}

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
        assert response.data[0]["mimetype"] == "image/png"
        assert response.data[0]["event_id"] == attachment1.event_id
