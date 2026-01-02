from functools import cached_property

from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils import json


class GroupEventJsonTest(TestCase):
    @cached_property
    def path(self) -> str:
        return f"/organizations/{self.organization.slug}/issues/{self.event.group_id}/events/{self.event.event_id}/json/"

    def test_does_render(self) -> None:
        self.login_as(self.user)
        min_ago = before_now(minutes=1).isoformat()
        self.event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=self.project.id
        )
        resp = self.client.get(self.path)
        assert resp.status_code == 200
        assert resp["Content-Type"] == "application/json"
        data = json.loads(resp.content.decode("utf-8"))
        assert data["event_id"] == self.event.event_id

    def test_cross_organization_access_denied(self) -> None:
        """Ensures users cannot access event data from other organizations."""
        victim_org = self.create_organization(name="victim-org")
        victim_project = self.create_project(organization=victim_org)
        min_ago = before_now(minutes=1).isoformat()
        victim_event = self.store_event(
            data={"fingerprint": ["victim-group"], "timestamp": min_ago},
            project_id=victim_project.id,
        )

        attacker_org = self.create_organization(name="attacker-org")
        attacker_user = self.create_user()
        self.create_member(user=attacker_user, organization=attacker_org, role="member")

        self.login_as(attacker_user)
        path = f"/organizations/{attacker_org.slug}/issues/{victim_event.group_id}/events/{victim_event.event_id}/json/"
        resp = self.client.get(path)

        assert resp.status_code == 404

    def test_cross_organization_access_denied_latest_event(self) -> None:
        """Ensures cross-org access is denied for 'latest' event specifier."""
        victim_org = self.create_organization(name="victim-org")
        victim_project = self.create_project(organization=victim_org)
        min_ago = before_now(minutes=1).isoformat()
        victim_event = self.store_event(
            data={"fingerprint": ["victim-group"], "timestamp": min_ago},
            project_id=victim_project.id,
        )

        attacker_org = self.create_organization(name="attacker-org")
        attacker_user = self.create_user()
        self.create_member(user=attacker_user, organization=attacker_org, role="member")

        self.login_as(attacker_user)
        path = (
            f"/organizations/{attacker_org.slug}/issues/{victim_event.group_id}/events/latest/json/"
        )
        resp = self.client.get(path)

        assert resp.status_code == 404
