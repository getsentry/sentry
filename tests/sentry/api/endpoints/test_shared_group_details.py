from __future__ import absolute_import, print_function

import six

from sentry.testutils import APITestCase
from sentry.testutils.helpers.datetime import iso_format, before_now
from sentry.models import GroupShare


class SharedGroupDetailsTest(APITestCase):
    def test_simple(self):
        self.login_as(user=self.user)

        min_ago = iso_format(before_now(minutes=1))
        event = self.store_event(data={"timestamp": min_ago}, project_id=self.project.id)
        group = event.group

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        url = u"/api/0/shared/issues/{}/".format(share_id)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["id"] == six.text_type(group.id)
        assert response.data["latestEvent"]["id"] == six.text_type(event.event_id)
        assert response.data["project"]["slug"] == group.project.slug
        assert response.data["project"]["organization"]["slug"] == group.organization.slug

    def test_feature_disabled(self):
        self.login_as(user=self.user)

        group = self.create_group()
        org = group.organization
        org.flags.disable_shared_issues = True
        org.save()

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        url = u"/api/0/shared/issues/{}/".format(share_id)
        response = self.client.get(url, format="json")

        assert response.status_code == 404

    def test_permalink(self):
        group = self.create_group()

        share_id = group.get_share_id()
        assert share_id is None

        GroupShare.objects.create(project_id=group.project_id, group=group)

        share_id = group.get_share_id()
        assert share_id is not None

        url = u"/api/0/shared/issues/{}/".format(share_id)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert not response.data["permalink"]  # not show permalink when not logged in

        self.login_as(user=self.user)
        response = self.client.get(url, format="json")

        assert response.status_code == 200, response.content
        assert response.data["permalink"]  # show permalink when logged in
