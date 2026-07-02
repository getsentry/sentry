from django.test.client import RequestFactory
from django.urls import reverse

from fixtures.apidocs_test_case import APIDocsTestCase
from sentry.models.eventattachment import EventAttachment
from sentry.testutils.helpers.datetime import before_now


class ProjectEventAttachmentDetailsDocs(APIDocsTestCase):
    def setUp(self) -> None:
        event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": before_now(minutes=1).isoformat()},
            project_id=self.project.id,
        )
        attachment = EventAttachment.objects.create(
            project_id=event.project_id,
            event_id=event.event_id,
            type="event.attachment",
            name="hello.png",
            content_type="image/png",
            size=18,
            sha1="d3f299af02d6abbe92dd8368bab781824a9702ed",
            blob_path=":File contents here",
        )

        self.url = reverse(
            "sentry-api-0-event-attachment-details",
            kwargs={
                "organization_id_or_slug": self.project.organization.slug,
                "project_id_or_slug": self.project.slug,
                "event_id": event.event_id,
                "attachment_id": attachment.id,
            },
        )

        self.login_as(user=self.user)

    def test_get(self) -> None:
        with self.feature("organizations:event-attachments"):
            response = self.client.get(self.url)
        request = RequestFactory().get(self.url)

        self.validate_schema(request, response)
