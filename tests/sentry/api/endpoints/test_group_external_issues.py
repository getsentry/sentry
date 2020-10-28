from __future__ import absolute_import, print_function

import six

from sentry.models import PlatformExternalIssue
from sentry.testutils import APITestCase


class GroupExternalIssuesEndpointTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        group = self.create_group()

        PlatformExternalIssue.objects.create(
            group_id=group.id,
            service_type="sentry-app",
            display_name="App#issue-1",
            web_url="https://example.com/app/issues/1",
        )

        url = u"/api/0/issues/{}/external-issues/".format(group.id)
        response = self.client.get(url, format="json")
        external_issue = PlatformExternalIssue.objects.first()
        assert response.status_code == 200, response.content
        assert len(response.data) == 1
        assert response.data == [
            {
                "id": six.text_type(external_issue.id),
                "groupId": six.text_type(group.id),
                "serviceType": "sentry-app",
                "displayName": "App#issue-1",
                "webUrl": "https://example.com/app/issues/1",
            }
        ]
