from __future__ import absolute_import

from datetime import datetime

from sentry.testutils import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now, iso_format


class GroupTagExportTest(TestCase, SnubaTestCase):
    def test_simple(self):
        key, value = "foo", u"b\xe4r"
        project = self.create_project()

        event_timestamp = iso_format(before_now(seconds=1))

        event = self.store_event(
            data={
                "tags": {key: value},
                "timestamp": event_timestamp,
                "environment": self.environment.name,
            },
            project_id=project.id,
            assert_no_errors=False,
        )

        group = event.group

        first_seen = datetime.strptime(event_timestamp, "%Y-%m-%dT%H:%M:%S").strftime(
            "%Y-%m-%dT%H:%M:%S.%fZ"
        )
        last_seen = first_seen

        self.login_as(user=self.user)

        url = u"/{}/{}/issues/{}/tags/{}/export/?environment={}".format(
            project.organization.slug, project.slug, group.id, key, self.environment.name
        )

        response = self.client.get(url)

        assert response.status_code == 200
        assert response.streaming
        assert response["Content-Type"] == "text/csv"
        rows = list(response.streaming_content)
        for idx, row in enumerate(rows):
            row = row.decode("utf-8")
            assert row.endswith(u"\r\n")
            bits = row[:-2].split(",")
            if idx == 0:
                assert bits == ["value", "times_seen", "last_seen", "first_seen"]
            else:
                assert bits[0] == value
                assert bits[1] == "1"
                assert bits[2] == last_seen
                assert bits[3] == first_seen
