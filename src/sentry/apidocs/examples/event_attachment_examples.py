from datetime import datetime

from drf_spectacular.utils import OpenApiExample

from sentry.api.serializers.models.eventattachment import EventAttachmentSerializerResponse

SCREENSHOT_ATTACHMENT: EventAttachmentSerializerResponse = {
    "id": "1234",
    "event_id": "9b29bbe17e9d4ee3a6d0fe9b2e8a3b1c",
    "type": "event.attachment",
    "name": "screenshot.png",
    "mimetype": "image/png",
    "dateCreated": datetime.fromisoformat("2026-04-15T18:22:31.000000Z"),
    "size": 248137,
    "headers": {"Content-Type": "image/png"},
    "sha1": "d3f299af02d6abbe92dd8368bab781824a9702ed",
}

VIEW_HIERARCHY_ATTACHMENT: EventAttachmentSerializerResponse = {
    "id": "1235",
    "event_id": "9b29bbe17e9d4ee3a6d0fe9b2e8a3b1c",
    "type": "event.view_hierarchy",
    "name": "view-hierarchy.json",
    "mimetype": "application/json",
    "dateCreated": datetime.fromisoformat("2026-04-15T18:22:31.000000Z"),
    "size": 8421,
    "headers": {"Content-Type": "application/json"},
    "sha1": "fa0a5fad9e64129f6b5f60cca3a5b8c9b8a1a3a0",
}


class EventAttachmentExamples:
    LIST_EVENT_ATTACHMENTS = [
        OpenApiExample(
            "Return a list of attachments for an event",
            value=[SCREENSHOT_ATTACHMENT, VIEW_HIERARCHY_ATTACHMENT],
            response_only=True,
            status_codes=["200"],
        )
    ]
    EVENT_ATTACHMENT_DETAILS = [
        OpenApiExample(
            "Return a single event attachment",
            value=SCREENSHOT_ATTACHMENT,
            response_only=True,
            status_codes=["200"],
        )
    ]
