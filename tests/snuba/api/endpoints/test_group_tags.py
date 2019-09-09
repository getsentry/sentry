from __future__ import absolute_import

from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class GroupTagsTest(APITestCase, SnubaTestCase):
    def test_multi_env(self):
        min_ago = before_now(minutes=1)
        env = self.create_environment(project=self.project, name="prod")
        env2 = self.create_environment(project=self.project, name="staging")
        self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": iso_format(min_ago),
                "environment": env.name,
                "tags": {"foo": "bar"},
            },
            project_id=self.project.id,
        )
        event2 = self.store_event(
            data={
                "fingerprint": ["put-me-in-group1"],
                "timestamp": iso_format(min_ago),
                "environment": env2.name,
                "tags": {"biz": "baz"},
            },
            project_id=self.project.id,
        )

        self.login_as(user=self.user)
        url = u"/api/0/issues/{}/tags/?enable_snuba=1".format(event2.group.id)
        response = self.client.get(
            "%s&environment=%s&environment=%s" % (url, env.name, env2.name), format="json"
        )
        assert response.status_code == 200
        assert set([tag["key"] for tag in response.data]) >= set(["biz", "environment", "foo"])
