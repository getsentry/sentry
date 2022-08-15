import uuid

from django.urls import reverse

from sentry.models import File
from sentry.replays.models import ReplayRecordingSegment
from sentry.testutils import APITestCase


class ProjectReplayRecordingSegmentTestCase(APITestCase):
    endpoint = "sentry-api-0-project-replay-recording-segment-index"

    def setUp(self):
        super().setUp()

        self.replay_id = uuid.uuid4().hex
        self.url = reverse(
            self.endpoint,
            args=(self.organization.slug, self.project.slug, self.replay_id),
        )

    def test_index(self):
        self.login_as(user=self.user)

        recording_segment = ReplayRecordingSegment.objects.create(
            replay_id=self.replay_id,
            project_id=self.project.id,
            segment_id=0,
            file_id=File.objects.create(name="hello.png", type="image/png").id,
        )
        ReplayRecordingSegment.objects.create(
            replay_id=self.replay_id,
            project_id=self.project.id,
            segment_id=1,
            file_id=File.objects.create(name="hello.png", type="image/png").id,
        )
        ReplayRecordingSegment.objects.create(
            replay_id=self.replay_id,
            project_id=self.project.id,
            segment_id=2,
            file_id=File.objects.create(name="hello.png", type="image/png").id,
        )

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert len(response.data["data"]) == 3
        assert response.data["data"][0]["replayId"] == recording_segment.replay_id
        assert response.data["data"][0]["segmentId"] == recording_segment.segment_id
        assert response.data["data"][0]["projectId"] == str(recording_segment.project_id)
        assert response.data["data"][0]["dateAdded"] == recording_segment.date_added

        assert response.data["data"][0]["segmentId"] == 0
        assert response.data["data"][1]["segmentId"] == 1
        assert response.data["data"][2]["segmentId"] == 2
