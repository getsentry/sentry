from __future__ import absolute_import

from datetime import timedelta

from django.conf import settings
from django.core.urlresolvers import reverse
from exam import fixture

from sentry.models import User
from sentry.testutils import TestCase


class HomeTest(TestCase):
    @fixture
    def path(self):
        return reverse('sentry')

    def test_redirects_to_login(self):
        resp = self.client.get(self.path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-login')

    def test_redirects_to_create_org(self):
        self.login_as(self.user)

        with self.feature('organizations:create'):
            resp = self.client.get(self.path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-create-organization')

    def test_shows_no_access(self):
        self.login_as(self.user)

        with self.feature('organizations:create', False):
            resp = self.client.get(self.path)

        assert resp.status_code == 403
        self.assertTemplateUsed('sentry/no-organization-access.html')

    def test_redirects_to_org_home(self):
        self.login_as(self.user)
        org = self.create_organization(owner=self.user)

        with self.feature('organizations:create'):
            resp = self.client.get(self.path)

        assert resp.status_code == 302
        assert resp['Location'] == 'http://testserver' + reverse('sentry-organization-home', args=[org.slug])

    def test_updates_user_last_login(self):
        self.login_as(self.user)
        self.create_organization(owner=self.user)

        seconds = settings.USER_LAST_LOGIN_UPDATE_INTERVAL
        last_login = self.user.last_login - timedelta(seconds=seconds)
        last_login = last_login.replace(microsecond=0)
        self.user.last_login = last_login
        self.user.save()
        self.client.get(self.path)
        self.user = User.objects.get(id=self.user.id)

        assert last_login != self.user.last_login

    def test_does_not_update_user_last_login(self):
        self.login_as(self.user)
        self.create_organization(owner=self.user)

        seconds = settings.USER_LAST_LOGIN_UPDATE_INTERVAL / 2
        last_login = self.user.last_login - timedelta(seconds=seconds)
        last_login = last_login.replace(microsecond=0)
        self.user.last_login = last_login
        self.user.save()
        self.client.get(self.path)
        self.user = User.objects.get(id=self.user.id)

        assert last_login == self.user.last_login
