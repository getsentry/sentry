from __future__ import absolute_import

import six

from django.conf import settings

from sentry import tagstore
from sentry.models import Group
from sentry.testutils import APITestCase, SnubaTestCase


class GroupTagDetailsTest(APITestCase, SnubaTestCase):
    def test_simple(self):

        if settings.SENTRY_TAGSTORE in [
            "sentry.tagstore.snuba.SnubaCompatibilityTagStorage",
            "sentry.tagstore.snuba.SnubaTagStorage",
        ]:
            for i in xrange(3):
                self.store_event(
                    data={"tags": {"foo": "bar"}, "fingerprint": ["group1"]},
                    project_id=self.project.id,
                )

            group = Group.objects.first()

        else:
            group = self.create_group()
            group.data["tags"] = (["foo", "bar"],)
            group.save()

            key, value = group.data["tags"][0]
            tagstore.create_tag_key(
                project_id=group.project_id, environment_id=None, key=key, values_seen=2
            )
            tagstore.create_tag_value(
                project_id=group.project_id, environment_id=None, key=key, value=value, times_seen=4
            )
            tagstore.create_group_tag_key(
                project_id=group.project_id,
                group_id=group.id,
                environment_id=None,
                key=key,
                values_seen=1,
            )
            tagstore.create_group_tag_value(
                project_id=group.project_id,
                group_id=group.id,
                environment_id=None,
                key=key,
                value=value,
                times_seen=3,
            )

        self.login_as(user=self.user)

        url = u"/api/0/issues/{}/tags/{}/".format(group.id, "foo")
        response = self.client.get(url, format="json")
        assert response.status_code == 200, response.content
        assert response.data["key"] == six.text_type("foo")
        assert response.data["totalValues"] == 3
