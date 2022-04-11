from sentry.testutils import TestCase


class ActivityTest(TestCase):
    def test_get_activities_for_group(self):
        activity = self.create_incident_activity()
        assert activity
