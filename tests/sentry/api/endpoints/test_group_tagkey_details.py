from __future__ import absolute_import

import six

from sentry.models import Group
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class GroupTagDetailsTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        for i in range(3):
            self.store_event(
                data={
                    "tags": {"foo": "bar"},
                    "fingerprint": ["group1"],
                    "timestamp": iso_format(before_now(seconds=1)),
                },
                project_id=self.project.id,
            )

        group = Group.objects.first()

        self.login_as(user=self.user)

        url = u"/api/0/issues/{}/tags/{}/".format(group.id, "foo")
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["key"] == six.text_type("foo")
        assert response.data["totalValues"] == 3
