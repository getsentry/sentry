from __future__ import absolute_import

import six
import json

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


class UserCreateTest(APITestCase):
    @fixture
    def path(self):
        return reverse("sentry-api-0-user-index")

    def setUp(self):
        super(UserCreateTest, self).setUp()
        self.superuser = self.create_user("bar@example.com", is_superuser=True)
        self.normal_user = self.create_user("foo@example.com", is_superuser=False)

    def test_superuser_only(self):
        self.login_as(self.normal_user)
        response = self.client.get(self.path)
        assert response.status_code == 403

    def test_usercreate_basic(self):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-user-index")
        resp = self.client.post(
            url,
            data={
                "email": "user@example.com",
                "password": "password",
                "is_superuser": True,
                "force_update": True,
            },
        )
        assert resp.status_code == 201, resp.content
        assert json.loads(resp.content)["email"] == "user@example.com"
        assert json.loads(resp.content)["username"] == "user@example.com"
        assert json.loads(resp.content)["isSuperuser"]
        assert json.loads(resp.content)["isStaff"]

    def test_usercreate_no_password(self):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-user-index")
        resp = self.client.post(
            url,
            data={
                "email": "foo@example.com",
                "password": "",
                "is_superuser": True,
                "force_update": True,
            },
        )
        assert resp.status_code == 400

    def test_usercreate_blank_password(self):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-user-index")
        resp = self.client.post(
            url, data={"email": "foo@example.com", "is_superuser": True, "force_update": True}
        )
        assert resp.status_code == 400

    def test_usercreate_no_email(self):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-user-index")
        resp = self.client.post(
            url,
            data={"email": "", "password": "password", "is_superuser": True, "force_update": True},
        )
        assert resp.status_code == 400

    def test_usercreate_blank_email(self):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-user-index")
        resp = self.client.post(
            url, data={"password": "password", "is_superuser": True, "force_update": True}
        )
        assert resp.status_code == 400

    def test_usercreate_force_update(self):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-user-index")
        resp = self.client.post(
            url,
            data={
                "email": "foo@example.com",
                "password": "password",
                "is_superuser": True,
                "force_update": True,
            },
        )
        assert resp.status_code == 201, resp.content
        assert json.loads(resp.content)["email"] == "foo@example.com"
        assert json.loads(resp.content)["username"] == "foo@example.com"
        assert json.loads(resp.content)["isSuperuser"]
        assert json.loads(resp.content)["isStaff"]

    def test_usercreate_no_force_update(self):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-user-index")
        resp = self.client.post(
            url, data={"email": "foo@example.com", "password": "password", "is_superuser": True}
        )
        assert resp.status_code == 400

    def test_usercreate_no_superuser(self):
        self.login_as(user=self.superuser, superuser=True)
        url = reverse("sentry-api-0-user-index")
        resp = self.client.post(
            url, data={"email": "foo@example.com", "password": "password", "force_update": True}
        )
        assert resp.status_code == 201, resp.content
        assert json.loads(resp.content)["email"] == "foo@example.com"
        assert json.loads(resp.content)["username"] == "foo@example.com"
