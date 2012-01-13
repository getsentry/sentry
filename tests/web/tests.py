# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging

from django.conf import settings as django_settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from sentry.models import Group, Project, ProjectMember, \
  MEMBER_OWNER, MEMBER_USER
from sentry.web.helpers import get_login_url

from tests.base import TestCase

logger = logging.getLogger(__name__)


class SentryViewsTest(TestCase):
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        self.user.set_password('admin')
        self.user.save()

    def test_auth(self):
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/login.html')

        resp = self.client.post(reverse('sentry-login'), {
            'username': 'admin',
            'password': 'admin',
        }, follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateNotUsed(resp, 'sentry/login.html')

    def test_dashboard(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateNotUsed(resp, 'sentry/dashboard.html')

        # requires two projects to show dashboard
        p = Project.objects.create(name='foo')
        ProjectMember.objects.create(project=p, user=self.user)
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/dashboard.html')

        # no projects and unauthenticated
        self.client.logout()
        Project.objects.all().delete()
        resp = self.client.get(reverse('sentry'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/login.html')

    def test_index(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry', kwargs={'project_id': 1}) + '?sort=freq', follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/groups/group_list.html')
        self.assertEquals(len(resp.context['event_list']), 4)
        group = resp.context['event_list'][0]
        self.assertEquals(group.times_seen, 7)
        self.assertEquals(group.message, "'tuple' object has no attribute 'args'")

    def test_group_details(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group', kwargs={'project_id': 1, 'group_id': 2}), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/details.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_event_list(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-events', kwargs={'project_id': 1, 'group_id': 2}), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/event_list.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_message_details(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-event', kwargs={'project_id': 1, 'group_id': 2, 'event_id': 4}), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/event.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    # TODO: improve upon these tests
    def test_group_json(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-json', kwargs={'project_id': 1, 'group_id': 2}))
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/json')

    def test_status(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-status'), follow=True)
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/status.html')

    def test_event_list(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-events', kwargs={'project_id': 1}))
        self.assertEquals(resp.status_code, 200)
        self.assertTemplateUsed(resp, 'sentry/events/event_list.html')

    def test_replay_event(self):
        # bad event_id
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-replay', kwargs={'project_id': 1, 'event_id': 1}))
        self.assertEquals(resp.status_code, 302)

        # valid params
        # self.client.login(username='admin', password='admin')
        # resp = self.client.get(reverse('sentry-replay', kwargs={'project_id': 1, 'event_id': 4}))
        # self.assertEquals(resp.status_code, 200)
        # self.assertTemplateUsed(resp, 'sentry/events/replay.html')

    def test_new_project(self):
        self.client.login(username='admin', password='admin')

        # missing name
        path = reverse('sentry-new-project')
        resp = self.client.post(path, {})
        self.assertEquals(resp.status_code, 200)

        # valid params
        path = reverse('sentry-new-project')
        resp = self.client.post(path, {
            'name': 'Test Project',
        })
        self.assertNotEquals(resp.status_code, 200)

        project = Project.objects.filter(name='Test Project')
        self.assertTrue(project.exists())
        project = project.get()

        self.assertEquals(project.owner, self.user)

        member_set = list(project.member_set.all())

        self.assertEquals(len(member_set), 1)
        member = member_set[0]
        self.assertEquals(member.user, self.user)
        self.assertEquals(member.type, MEMBER_OWNER)


class ViewPermissionTest(TestCase):
    """
    These tests simply ensure permission requirements for various views.
    """
    fixtures = ['tests/fixtures/views.json']

    def setUp(self):
        self.user = User(username="admin", email="admin@localhost", is_staff=True, is_superuser=True)
        self.user.set_password('admin')
        self.user.save()
        self.user2 = User(username="member", email="member@localhost")
        self.user2.set_password('member')
        self.user2.save()
        self.user3 = User(username="nobody", email="nobody@localhost")
        self.user3.set_password('nobody')
        self.user3.save()
        self.user4 = User(username="owner", email="owner@localhost")
        self.user4.set_password('owner')
        self.user4.save()
        self.pm = ProjectMember.objects.create(
            user_id=2,
            project_id=1,
            type=MEMBER_USER,
        )
        self.pm = ProjectMember.objects.create(
            user_id=4,
            project_id=1,
            type=MEMBER_OWNER,
        )
        self.project = Project.objects.get(id=1)
        self.project.update(public=False)

    def _assertPerm(self, path, template, account=None, want=True):
        """
        Requests ``path`` and asserts that ``template`` is
        rendered for ``account`` (Anonymous if None) given ``want``
        is Trueish.
        """
        if account:
            self.assertTrue(self.client.login(username=account, password=account))
        else:
            self.client.logout()
        resp = self.client.get(path)
        if want:
            self.assertEquals(resp.status_code, 200)
            self.assertTemplateUsed(resp, template)
        else:
            self.assertEquals(resp.status_code, 302)
            self.assertTemplateNotUsed(resp, template)

    def test_project_list(self):
        path = reverse('sentry-project-list')
        template = 'sentry/projects/list.html'

        self._assertPerm(path, template, 'admin')
        self._assertPerm(path, template, 'nobody')
        self._assertPerm(path, template, None, False)

    def test_new_project(self):
        path = reverse('sentry-new-project')
        template = 'sentry/projects/new.html'

        self._assertPerm(path, template, 'admin')
        self._assertPerm(path, template, 'nobody', False)
        self._assertPerm(path, template, None, False)

        with self.Settings(SENTRY_ALLOW_PROJECT_CREATION=True):
            self._assertPerm(path, template, 'admin')
            self._assertPerm(path, template, 'nobody')
            self._assertPerm(path, template, None, False)

    def test_manage_project(self):
        path = reverse('sentry-manage-project', kwargs={'project_id': 1})
        template = 'sentry/projects/manage.html'

        self._assertPerm(path, template, 'admin')
        self._assertPerm(path, template, 'owner')
        self._assertPerm(path, template, None, False)
        self._assertPerm(path, template, 'nobody', False)
        self._assertPerm(path, template, 'member', False)

    def test_remove_project(self):
        # We cant delete the default project
        with self.Settings(SENTRY_PROJECT=2):
            path = reverse('sentry-remove-project', kwargs={'project_id': 1})
            template = 'sentry/projects/remove.html'

            self._assertPerm(path, template, 'admin')
            self._assertPerm(path, template, 'owner')
            self._assertPerm(path, template, None, False)
            self._assertPerm(path, template, 'nobody', False)
            self._assertPerm(path, template, 'member', False)

    def test_new_project_member(self):
        path = reverse('sentry-new-project-member', kwargs={'project_id': 1})
        template = 'sentry/projects/members/new.html'

        self._assertPerm(path, template, 'admin')
        self._assertPerm(path, template, 'owner')
        self._assertPerm(path, template, None, False)
        self._assertPerm(path, template, 'nobody', False)
        self._assertPerm(path, template, 'member', False)

    def test_edit_project_member(self):
        path = reverse('sentry-edit-project-member', kwargs={'project_id': 1, 'member_id': 1})
        template = 'sentry/projects/members/edit.html'

        self._assertPerm(path, template, 'admin')
        self._assertPerm(path, template, 'owner')
        self._assertPerm(path, template, None, False)
        self._assertPerm(path, template, 'nobody', False)
        self._assertPerm(path, template, 'member', False)

    def test_remove_project_member(self):
        path = reverse('sentry-remove-project-member', kwargs={'project_id': 1, 'member_id': 1})
        template = 'sentry/projects/members/remove.html'

        self._assertPerm(path, template, 'admin')
        self._assertPerm(path, template, 'owner')
        self._assertPerm(path, template, None, False)
        self._assertPerm(path, template, 'nobody', False)
        self._assertPerm(path, template, 'member', False)


class SentrySearchTest(TestCase):
    def test_checksum_query(self):
        checksum = 'a' * 32
        g = Group.objects.create(
            project_id=1,
            logger='root',
            culprit='a',
            checksum=checksum,
            message='hi',
        )

        with self.Settings(SENTRY_PUBLIC=True):
            response = self.client.get(reverse('sentry-search', kwargs={'project_id': 1}), {'q': '%s$%s' % (checksum, checksum)})
            self.assertEquals(response.status_code, 302)
            self.assertEquals(response['Location'], 'http://testserver%s' % (g.get_absolute_url(),))

    def test_dupe_checksum(self):
        checksum = 'a' * 32
        g1 = Group.objects.create(
            project_id=1,
            logger='root',
            culprit='a',
            checksum=checksum,
            message='hi',
        )
        g2 = Group.objects.create(
            project_id=1,
            logger='root',
            culprit='b',
            checksum=checksum,
            message='hi',
        )

        with self.Settings(SENTRY_PUBLIC=True):
            response = self.client.get(reverse('sentry-search', kwargs={'project_id': 1}), {'q': '%s$%s' % (checksum, checksum)})
            self.assertEquals(response.status_code, 200)
            self.assertTemplateUsed(response, 'sentry/search.html')
            context = response.context
            self.assertTrue('event_list' in context)
            self.assertEquals(len(context['event_list']), 2)
            self.assertTrue(g1 in context['event_list'])
            self.assertTrue(g2 in context['event_list'])


class SentryHelpersTest(TestCase):
    def test_get_db_engine(self):
        from sentry.utils import get_db_engine
        _databases = getattr(django_settings, 'DATABASES', {}).copy()

        django_settings.DATABASES['default'] = {'ENGINE': 'blah.sqlite3'}

        self.assertEquals(get_db_engine(), 'sqlite3')

        django_settings.DATABASES['default'] = {'ENGINE': 'blah.mysql'}

        self.assertEquals(get_db_engine(), 'mysql')

        django_settings.DATABASES = _databases

    def test_get_login_url(self):
        with self.Settings(LOGIN_URL='/really-a-404'):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))

        with self.Settings(LOGIN_URL=reverse('sentry-fake-login')):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-fake-login'))

        # should still be cached
        with self.Settings(LOGIN_URL='/really-a-404'):
            url = get_login_url(False)
            self.assertEquals(url, reverse('sentry-fake-login'))

        with self.Settings(SENTRY_LOGIN_URL=None):
            url = get_login_url(True)
            self.assertEquals(url, reverse('sentry-login'))
