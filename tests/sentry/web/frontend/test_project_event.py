from __future__ import absolute_import

from django.core.urlresolvers import reverse
from sentry.testutils import TestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class ProjectEventTest(SnubaTestCase, TestCase):
    def setUp(self):
        super(ProjectEventTest, self).setUp()
        self.user = self.create_user()
        self.login_as(self.user)
        self.org = self.create_organization()
        self.team = self.create_team(organization=self.org, name="Mariachi Band")
        self.create_member(user=self.user, organization=self.org, role="owner", teams=[self.team])
        self.project = self.create_project(organization=self.org, teams=[self.team])
        min_ago = iso_format(before_now(minutes=1))
        self.event = self.store_event(
            data={"fingerprint": ["group1"], "timestamp": min_ago}, project_id=self.project.id
        )

    def test_redirect_to_event(self):
        resp = self.client.get(
            reverse(
                "sentry-project-event-redirect",
                args=[self.org.slug, self.project.slug, self.event.event_id],
            )
        )
        self.assertRedirects(
            resp,
            "/organizations/{}/issues/{}/events/{}/".format(
                self.org.slug, self.event.group_id, self.event.event_id
            ),
        )

    def test_event_not_found(self):
        resp = self.client.get(
            reverse(
                "sentry-project-event-redirect", args=[self.org.slug, self.project.slug, "event1"]
            )
        )
        assert resp.status_code == 404

    def test_event_not_found__event_no_group(self):
        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(
            data={
                "type": "transaction",
                "transaction": "api.test",
                "timestamp": min_ago,
                "start_timestamp": min_ago,
                "spans": [],
                "contexts": {"trace": {"op": "foobar", "trace_id": "a" * 32, "span_id": "b" * 16}},
            },
            project_id=self.project.id,
        )

        url = reverse(
            "sentry-project-event-redirect", args=[self.org.slug, self.project.slug, event.event_id]
        )
        resp = self.client.get(url)
        assert resp.status_code == 404
