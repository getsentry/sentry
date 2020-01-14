from __future__ import absolute_import

from sentry.analytics import Analytics
from sentry.analytics.events.issue_created import IssueCreatedEvent
from sentry.testutils import TestCase


class DummyAnalytics(Analytics):
    def __init__(self):
        self.events = []
        super(DummyAnalytics, self).__init__()

    def record_event(self, event):
        self.events.append(event)


class IssueCreatedAnalyticsTest(TestCase):
    def test_record(self):
        organization = self.create_organization()
        project = self.create_project()
        group = self.create_group(project)

        print (group)
        print (group.data)
        print (group.get_event_type())

        provider = DummyAnalytics()
        provider.event_manager.register(IssueCreatedEvent)

        provider.record(
            "issue.created",
            group_id=group.id,
            project_id=project.id,
            organization_id=organization.id,
            event_type=group.get_event_type(),
        )

        assert len(provider.events) == 1

        event = provider.events.pop(0)

        assert event.type == "issue.created"
        assert event.datetime
        assert event.data["group_id"] == group.id
        assert event.data["project_id"] == project.id
        assert event.data["organization_id"] == organization.id
        assert event.data["event_type"] == "default"
