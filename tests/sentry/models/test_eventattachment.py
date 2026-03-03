from __future__ import annotations

import os
from unittest import mock
from uuid import uuid4

from sentry.models.eventattachment import EventAttachment
from sentry.testutils.cases import TestCase


class EventAttachmentDeleteTest(TestCase):
    def _create_v2_attachment(self) -> EventAttachment:
        return EventAttachment.objects.create(
            event_id=uuid4().hex,
            project_id=self.project.id,
            type="event.attachment",
            name="test.txt",
            blob_path="v2/some-key",
        )

    @mock.patch("sentry.models.eventattachment.get_attachments_session")
    @mock.patch("sentry.models.eventattachment._get_organization", return_value=1)
    def test_v2_delete_calls_objectstore(
        self,
        mock_get_org: mock.Mock,
        mock_get_session: mock.Mock,
    ) -> None:
        attachment = self._create_v2_attachment()

        attachment.delete()

        mock_get_session.return_value.delete.assert_called_once_with("some-key")

    @mock.patch("sentry.models.eventattachment.get_attachments_session")
    @mock.patch("sentry.models.eventattachment._get_organization", return_value=1)
    def test_v2_delete_skips_objectstore_during_cleanup(
        self,
        mock_get_org: mock.Mock,
        mock_get_session: mock.Mock,
    ) -> None:
        attachment = self._create_v2_attachment()

        os.environ["_SENTRY_CLEANUP"] = "1"
        try:
            attachment.delete()
        finally:
            del os.environ["_SENTRY_CLEANUP"]

        mock_get_session.return_value.delete.assert_not_called()
        assert not EventAttachment.objects.filter(id=attachment.id).exists()
