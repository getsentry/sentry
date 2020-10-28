from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import UserPermission
from sentry.testutils import APITestCase


class UserListTest(APITestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-0-user-index")

    def setUp(self):
        super(UserListTest, self).setUp()
        self.superuser = self.create_user("bar@example.com", is_superuser=True)
        self.normal_user = self.create_user("foo@example.com", is_superuser=False)

    def test_superuser_only(self):
        self.login_as(self.normal_user)
        response = self.client.get(self.path)
        assert response.status_code == 403

    def test_simple(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.get(self.path)
        assert response.status_code == 200
        assert len(response.data) == 2

    def test_generic_query(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.get(u"{}?query=@example.com".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 2
        response = self.client.get(u"{}?query=bar".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(self.superuser.id)
        response = self.client.get(u"{}?query=foobar".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_superuser_query(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.get(u"{}?query=is:superuser".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(self.superuser.id)

    def test_email_query(self):
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.get(u"{}?query=email:bar@example.com".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["id"] == six.text_type(self.superuser.id)
        response = self.client.get(u"{}?query=email:foobar".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 0

    def test_basic_query(self):
        UserPermission.objects.create(user=self.superuser, permission="broadcasts.admin")
        self.login_as(user=self.superuser, superuser=True)
        response = self.client.get(u"{}?query=permission:broadcasts.admin".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 1
        response = self.client.get(u"{}?query=permission:foobar".format(self.path))
        assert response.status_code == 200
        assert len(response.data) == 0
