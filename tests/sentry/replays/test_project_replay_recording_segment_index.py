from django.urls import reverse

from sentry.models import File
from sentry.replays.models import ReplayRecordingSegment
from sentry.testutils import APITestCase


class ProjectReplayRecordingSegmentTestCase(APITestCase):
    endpoint = "sentry-api-0-project-replay-recording-segment-index"

    def setUp(self):
        super().setUp()

        self.replay_id = "977771b2-ddd0-4cec-81bf-4c9283"
        self.url = reverse(
            self.endpoint,
            args=(self.organization.slug, self.project.slug, self.replay_id),
        )

    def test_index(self):
        self.login_as(user=self.user)

        recording_segment = ReplayRecordingSegment.objects.create(
            replay_id=self.replay_id,
            project_id=self.project.id,
            sequence_id=0,
            file_id=File.objects.create(name="hello.png", type="image/png").id,
        )
        ReplayRecordingSegment.objects.create(
            replay_id=self.replay_id,
            project_id=self.project.id,
            sequence_id=1,
            file_id=File.objects.create(name="hello.png", type="image/png").id,
        )
        ReplayRecordingSegment.objects.create(
            replay_id=self.replay_id,
            project_id=self.project.id,
            sequence_id=2,
            file_id=File.objects.create(name="hello.png", type="image/png").id,
        )

        with self.feature("organizations:session-replay"):
            response = self.client.get(self.url)

        assert response.status_code == 200, response.content
        assert len(response.data) == 3
        assert response.data[0]["id"] == str(recording_segment.id)
        assert response.data[0]["replay_id"] == recording_segment.replay_id
        assert response.data[0]["sequence_id"] == recording_segment.sequence_id
        assert response.data[0]["project_id"] == recording_segment.project_id
        assert response.data[0]["date_added"] == recording_segment.date_added

        assert response.data[0]["sequence_id"] == 0
        assert response.data[1]["sequence_id"] == 1
        assert response.data[2]["sequence_id"] == 2
