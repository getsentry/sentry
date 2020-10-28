from __future__ import absolute_import

from copy import deepcopy
from exam import fixture

from django.core.urlresolvers import reverse
from django.utils import timezone

from sentry.assistant import manager
from sentry.models import AssistantActivity
from sentry.testutils import APITestCase


class AssistantActivityTest(APITestCase):
    def setUp(self):
        super(AssistantActivityTest, self).setUp()
        self.login_as(user=self.user)
        self.path = reverse("sentry-api-0-assistant")
        self.guides = manager.all()

    def test_invalid_inputs(self):
        # Missing status
        resp = self.client.put(self.path, {"guide_id": 1})
        assert resp.status_code == 400

        # Invalid guide id
        resp = self.client.put(self.path, {"guide_id": 1938, "status": "dismissed"})
        assert resp.status_code == 400

        # Invalid status
        resp = self.client.put(self.path, {"guide_id": 1, "status": "whats_my_name_again"})
        assert resp.status_code == 400

    def test_activity(self):
        guides_with_seen = deepcopy(manager.all())
        for g in guides_with_seen:
            guides_with_seen[g]["seen"] = False

        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp.data == guides_with_seen

        # Dismiss the guide and make sure it is not returned again.
        resp = self.client.put(self.path, {"guide_id": 3, "status": "dismissed"})
        assert resp.status_code == 201
        resp = self.client.get(self.path)
        guides_with_seen["issue_stream"]["seen"] = True
        assert resp.status_code == 200
        assert resp.data == guides_with_seen


class AssistantActivityV2Test(APITestCase):
    endpoint = "sentry-api-0-assistant"

    @fixture
    def guides(self):
        return manager.all()

    def setUp(self):
        super(AssistantActivityV2Test, self).setUp()
        self.create_organization(owner=self.user)
        self.login_as(user=self.user)

    def test_simple(self):
        resp = self.get_response(qs_params={"v2": 1})
        assert resp.status_code == 200

        assert len(resp.data) == len(manager.all())
        for guide in resp.data:
            assert guide["seen"] is False

    def test_dismissed(self):
        guide = "issue_stream"
        AssistantActivity.objects.create(
            user=self.user, guide_id=self.guides[guide]["id"], dismissed_ts=timezone.now()
        )
        resp = self.get_response(qs_params={"v2": 1})
        assert resp.status_code == 200
        assert {"guide": guide, "seen": True} in resp.data

    def test_viewed(self):
        guide = "issue_stream"
        AssistantActivity.objects.create(
            user=self.user, guide_id=self.guides[guide]["id"], viewed_ts=timezone.now()
        )
        resp = self.get_response(qs_params={"v2": 1})
        assert resp.status_code == 200
        assert {"guide": guide, "seen": True} in resp.data


class AssistantActivityV2UpdateTest(APITestCase):
    endpoint = "sentry-api-0-assistant"
    method = "put"

    @fixture
    def guides(self):
        return manager.all()

    def setUp(self):
        super(AssistantActivityV2UpdateTest, self).setUp()
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

        activity = AssistantActivity.objects.get(user=self.user, guide_id=self.guides[guide]["id"])
        assert activity.dismissed_ts
        assert not activity.viewed_ts

    def test_viewed(self):
        guide = "issue_stream"
        resp = self.get_response(guide=guide, status="viewed")
        assert resp.status_code == 201

        activity = AssistantActivity.objects.get(user=self.user, guide_id=self.guides[guide]["id"])
        assert activity.viewed_ts
        assert not activity.dismissed_ts
