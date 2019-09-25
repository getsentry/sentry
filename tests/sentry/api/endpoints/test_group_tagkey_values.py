from __future__ import absolute_import

from django.conf import settings

from sentry import tagstore
from sentry.models import EventUser
from sentry.testutils import APITestCase, SnubaTestCase
from sentry.testutils.helpers.datetime import iso_format, before_now


class GroupTagKeyValuesTest(APITestCase, SnubaTestCase):
    def test_simple(self):
        key, value = "foo", "bar"

        project = self.create_project()

        if settings.SENTRY_TAGSTORE in [
            "sentry.tagstore.snuba.SnubaCompatibilityTagStorage",
            "sentry.tagstore.snuba.SnubaTagStorage",
        ]:
            event = self.store_event(
                data={"tags": {key: value}, "timestamp": iso_format(before_now(seconds=1))},
                project_id=project.id,
            )
            group = event.group
        else:

            group = self.create_group(project=project)
            tagstore.create_tag_key(project_id=project.id, environment_id=None, key=key)
            tagstore.create_tag_value(
                project_id=project.id, environment_id=None, key=key, value=value
            )
            tagstore.create_group_tag_value(
                project_id=project.id, group_id=group.id, environment_id=None, key=key, value=value
            )

        self.login_as(user=self.user)

        url = u"/api/0/issues/{}/tags/{}/values/".format(group.id, key)

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]["value"] == "bar"

    def test_user_tag(self):
        if settings.SENTRY_TAGSTORE in [
            "sentry.tagstore.snuba.SnubaCompatibilityTagStorage",
            "sentry.tagstore.snuba.SnubaTagStorage",
        ]:
            project = self.create_project()
            event = self.store_event(
                data={
                    "user": {
                        "id": 1,
                        "email": "foo@example.com",
                        "username": "foo",
                        "ip_address": "127.0.0.1",
                    },
                    "timestamp": iso_format(before_now(seconds=1)),
                },
                project_id=project.id,
            )
            group = event.group

        else:
            project = self.create_project()
            group = self.create_group(project=project)
            euser = EventUser.objects.create(
                project_id=project.id,
                ident="1",
                email="foo@example.com",
                username="foo",
                ip_address="127.0.0.1",
            )
            tagstore.create_tag_key(project_id=project.id, environment_id=None, key="sentry:user")
            tagstore.create_tag_value(
                project_id=project.id, environment_id=None, key="sentry:user", value=euser.tag_value
            )
            tagstore.create_group_tag_value(
                project_id=project.id,
                group_id=group.id,
                environment_id=None,
                key="sentry:user",
                value=euser.tag_value,
            )

        self.login_as(user=self.user)

        url = u"/api/0/issues/{}/tags/user/values/".format(group.id)

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]["email"] == "foo@example.com"
        assert response.data[0]["value"] == "id:1"
