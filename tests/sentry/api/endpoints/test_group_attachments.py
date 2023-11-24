from io import BytesIO
from urllib.parse import urlencode

from sentry.models.eventattachment import EventAttachment
from sentry.models.files.file import File
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import region_silo_test
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@region_silo_test
class GroupEventAttachmentsTest(APITestCase):
    def create_attachment(self, type=None, event_id=None, file_name="hello.png"):
        if type is None:
            type = "event.attachment"

        self.file = File.objects.create(name=file_name, type=type)
        self.file.putfile(BytesIO(b"File contents here"))

        self.attachment = EventAttachment.objects.create(
            event_id=event_id or self.event.event_id,
            project_id=self.event.project_id,
            group_id=self.group.id,
            file_id=self.file.id,
            type=self.file.type,
            name=file_name,
        )

        return self.attachment

    def path(self, types=None, event_ids=None, screenshot=False):
        path = f"/api/0/issues/{self.group.id}/attachments/"

        query = [("types", t) for t in types or ()]
        query.extend([("event_id", id) for id in event_ids or ()])
        if screenshot:
            query.append(("screenshot", 1))
        if query:
            path += "?" + urlencode(query)

        return path

    def test_basic(self):
        self.login_as(user=self.user)

        attachment = self.create_attachment()

        with self.feature("organizations:event-attachments"):
            response = self.client.get(self.path())

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(attachment.id)

    def test_filter(self):
        self.login_as(user=self.user)

        self.create_attachment(type="event.attachment")
        attachment2 = self.create_attachment(type="event.minidump")

        with self.feature("organizations:event-attachments"):
            response = self.client.get(self.path(types=["event.minidump"]))

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(attachment2.id)

    def test_screenshot_filter(self):
        self.login_as(user=self.user)

        attachment1 = self.create_attachment(type="event.attachment", file_name="screenshot.png")
        self.create_attachment(type="event.attachment", file_name="screenshot-not.png")

        with self.feature("organizations:event-attachments"):
            response = self.client.get(self.path(screenshot=True))

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(attachment1.id)

    def test_second_screenshot_filter(self):
        self.login_as(user=self.user)

        attachment1 = self.create_attachment(type="event.attachment", file_name="screenshot.png")
        self.create_attachment(type="event.attachment", file_name="screenshot-not.png")

        with self.feature("organizations:event-attachments"):
            response = self.client.get(self.path(screenshot=True))

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["id"] == str(attachment1.id)

    def test_without_feature(self):
        self.login_as(user=self.user)
        self.create_attachment()

        with self.feature({"organizations:event-attachments": False}):
            response = self.client.get(self.path())

        assert response.status_code == 404, response.content

    def test_event_id_filter(self):
        self.login_as(user=self.user)
        attachment = self.create_attachment()
        self.create_attachment(event_id="b" * 32)

        with self.feature("organizations:event-attachments"):
            response = self.client.get(self.path(event_ids=[attachment.event_id]))

        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data[0]["event_id"] == attachment.event_id

    def test_multi_event_id_filter(self):
        self.login_as(user=self.user)
        attachment = self.create_attachment()
        attachment2 = self.create_attachment(event_id="b" * 32)
        self.create_attachment(event_id="c" * 32)

        with self.feature("organizations:event-attachments"):
            response = self.client.get(
                self.path(event_ids=[attachment.event_id, attachment2.event_id])
            )

        assert response.status_code == 200, response.content
        assert len(response.data) == 2
        assert response.data[0]["event_id"] == attachment2.event_id
        assert response.data[1]["event_id"] == attachment.event_id
