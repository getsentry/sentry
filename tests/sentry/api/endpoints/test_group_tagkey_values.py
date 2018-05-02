from __future__ import absolute_import

from sentry import tagstore
from sentry.models import EventUser
from sentry.testutils import APITestCase


class GroupTagKeyValuesTest(APITestCase):
    def test_simple(self):
        key, value = 'foo', 'bar'

        project = self.create_project()
        group = self.create_group(project=project)
        tagstore.create_tag_key(project_id=project.id, environment_id=None, key=key)
        tagstore.create_tag_value(
            project_id=project.id,
            environment_id=None,
            key=key,
            value=value,
        )
        tagstore.create_group_tag_value(
            project_id=project.id,
            group_id=group.id,
            environment_id=None,
            key=key,
            value=value,
        )

        self.login_as(user=self.user)

        url = '/api/0/issues/{}/tags/{}/values/'.format(group.id, key)

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]['value'] == 'bar'

    def test_user_tag(self):
        project = self.create_project()
        group = self.create_group(project=project)
        euser = EventUser.objects.create(
            project_id=project.id,
            ident='1',
            email='foo@example.com',
            username='foo',
            ip_address='127.0.0.1',
        )
        tagstore.create_tag_key(
            project_id=project.id,
            environment_id=None,
            key='sentry:user',
        )
        tagstore.create_tag_value(
            project_id=project.id,
            environment_id=None,
            key='sentry:user',
            value=euser.tag_value,
        )
        tagstore.create_group_tag_value(
            project_id=project.id,
            group_id=group.id,
            environment_id=None,
            key='sentry:user',
            value=euser.tag_value,
        )

        self.login_as(user=self.user)

        url = '/api/0/issues/{}/tags/user/values/'.format(group.id)

        response = self.client.get(url)

        assert response.status_code == 200
        assert len(response.data) == 1

        assert response.data[0]['email'] == 'foo@example.com'
        assert response.data[0]['value'] == euser.tag_value
