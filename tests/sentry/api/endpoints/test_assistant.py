from __future__ import absolute_import

from django.utils import timezone

from sentry.assistant import manager
from sentry.assistant.guides import AssistantGuide
from sentry.models import AssistantActivity
from sentry.testutils import APITestCase


class AssistantActivityTest(APITestCase):
    endpoint = "sentry-api-0-assistant"

    def setUp(self):
        super(AssistantActivityTest, self).setUp()
        self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_simple(self):
        resp = self.get_response()
        assert resp.status_code == 200

        assert len(resp.data) == len(manager.all())
        for guide in resp.data:
            assert guide["seen"] is False

    def test_dismissed(self):
        AssistantActivity.objects.create(
            user=self.user, guide_id=AssistantGuide.ISSUE_DETAILS.value, dismissed_ts=timezone.now()
        )
        resp = self.get_response()
        assert resp.status_code == 200
        assert {"guide": "issue_details", "seen": True} in resp.data

    def test_viewed(self):
        AssistantActivity.objects.create(
            user=self.user, guide_id=AssistantGuide.ISSUE_DETAILS.value, viewed_ts=timezone.now()
        )
        resp = self.get_response()
        assert resp.status_code == 200
        assert {"guide": "issue_details", "seen": True} in resp.data


class AssistantActivityUpdateTest(APITestCase):
    endpoint = "sentry-api-0-assistant"
    method = "put"

    def setUp(self):
        super(AssistantActivityUpdateTest, self).setUp()
        self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_invalid_inputs(self):
        resp = self.get_response(guide="guide_does_not_exist")
        assert resp.status_code == 400

        resp = self.get_response(guide_id="issue_details", status="whats_my_name_again")
        assert resp.status_code == 400

    def test_dismissed(self):
        resp = self.get_response(guide="issue_stream", status="dismissed")
        assert resp.status_code == 201

        activity = AssistantActivity.objects.get(
            user=self.user, guide_id=AssistantGuide.ISSUE_STREAM.value
        )
        assert activity.dismissed_ts
        assert not activity.viewed_ts

    def test_viewed(self):
        resp = self.get_response(guide="issue_stream", status="viewed")
        assert resp.status_code == 201

        activity = AssistantActivity.objects.get(
            user=self.user, guide_id=AssistantGuide.ISSUE_STREAM.value
        )
        assert not activity.dismissed_ts
        assert activity.viewed_ts
