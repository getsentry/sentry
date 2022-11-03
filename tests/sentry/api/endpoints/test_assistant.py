from django.utils import timezone
from exam import fixture

from sentry.assistant import manager
from sentry.models import AssistantActivity
from sentry.testutils import APITestCase


class AssistantActivityTest(APITestCase):
    endpoint = "sentry-api-0-assistant"

    @fixture
    def guides(self):
        return manager.all()

    def setUp(self):
        super().setUp()
        self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_simple(self):
        resp = self.get_response()
        assert resp.status_code == 200

        assert len(resp.data) == len(manager.all())
        for guide in resp.data:
            assert guide["seen"] is False

    def test_dismissed(self):
        guide = "issue_stream"
        AssistantActivity.objects.create(
            user=self.user, guide_id=self.guides[guide], dismissed_ts=timezone.now()
        )
        resp = self.get_response()
        assert resp.status_code == 200
        assert {"guide": guide, "seen": True} in resp.data

    def test_viewed(self):
        guide = "issue_stream"
        AssistantActivity.objects.create(
            user=self.user, guide_id=self.guides[guide], viewed_ts=timezone.now()
        )
        resp = self.get_response()
        assert resp.status_code == 200
        assert {"guide": guide, "seen": True} in resp.data


class AssistantActivityUpdateTest(APITestCase):
    endpoint = "sentry-api-0-assistant"
    method = "put"

    @fixture
    def guides(self):
        return manager.all()

    def setUp(self):
        super().setUp()
        self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_invalid_inputs(self):
        resp = self.get_response(guide="guide_does_not_exist")
        assert resp.status_code == 400

        resp = self.get_response(guide="guide_does_not_exist", status="dismissed")
        assert resp.status_code == 400

        resp = self.get_response(status="dismissed")
        assert resp.status_code == 400

        resp = self.get_response(guide="issue", status="whats_my_name_again")
        assert resp.status_code == 400

    def test_dismissed(self):
        guide = "issue_stream"
        resp = self.get_response(guide=guide, status="dismissed")
        assert resp.status_code == 201

        activity = AssistantActivity.objects.get(user=self.user, guide_id=self.guides[guide])
        assert activity.dismissed_ts
        assert not activity.viewed_ts

    def test_viewed(self):
        guide = "issue_stream"
        resp = self.get_response(guide=guide, status="viewed")
        assert resp.status_code == 201

        activity = AssistantActivity.objects.get(user=self.user, guide_id=self.guides[guide])
        assert activity.viewed_ts
        assert not activity.dismissed_ts

    def test_restart(self):
        guide = "issue_stream"
        resp = self.get_response(guide=guide, status="viewed")
        assert resp.status_code == 201

        self.get_response(guide=guide, status="restart")
        assert not AssistantActivity.objects.filter(
            user=self.user, guide_id=self.guides[guide]
        ).exists()
