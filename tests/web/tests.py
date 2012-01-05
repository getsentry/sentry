# -*- coding: utf-8 -*-

from __future__ import absolute_import

import logging

from django.conf import settings as django_settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse

from sentry.models import Group, Project, ProjectMember
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
        resp = self.client.get(reverse('sentry-group', kwargs={'group_id': 2}), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/details.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_event_list(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-events', args=[2]), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/event_list.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)

    def test_group_message_details(self):
        self.client.login(username='admin', password='admin')
        resp = self.client.get(reverse('sentry-group-event', kwargs={'group_id': 2, 'event_id': 4}), follow=True)
        self.assertEquals(resp.status_code, 200, resp.content)
        self.assertTemplateUsed(resp, 'sentry/groups/event.html')
        self.assertTrue('group' in resp.context)
        group = Group.objects.get(pk=2)
        self.assertEquals(resp.context['group'], group)


class SentryFeedsTest(TestCase):
    fixtures = ['tests/fixtures/feeds.json']

    def test_message_feed(self):
        response = self.client.get(reverse('sentry-feed-messages'))
        self.assertEquals(response.status_code, 200)
        self.assertTrue(response.content.startswith('<?xml version="1.0" encoding="utf-8"?>'))
        self.assertTrue('<link>http://testserver/</link>' in response.content)
        self.assertTrue('<title>events</title>' in response.content)
        self.assertTrue('<link>http://testserver/1/group/1</link>' in response.content, response.content)
        self.assertTrue('<title>exceptions must be old-style classes or derived from BaseException, not NoneType</title>' in response.content)

    def test_summary_feed(self):
        response = self.client.get(reverse('sentry-feed-summaries'))
        self.assertEquals(response.status_code, 200)
        self.assertTrue(response.content.startswith('<?xml version="1.0" encoding="utf-8"?>'))
        self.assertTrue('<link>http://testserver/</link>' in response.content)
        self.assertTrue('<title>events (aggregated)</title>' in response.content)
        self.assertTrue('<link>http://testserver/1/group/1</link>' in response.content, response.content)
        self.assertTrue('<title>(1) exceptions must be old-style classes or derived from BaseException, not NoneType</title>' in response.content)


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
        _engine = django_settings.DATABASE_ENGINE

        django_settings.DATABASE_ENGINE = ''
        django_settings.DATABASES['default'] = {'ENGINE': 'blah.sqlite3'}

        self.assertEquals(get_db_engine(), 'sqlite3')

        django_settings.DATABASE_ENGINE = 'mysql'

        self.assertEquals(get_db_engine(), 'sqlite3')

        django_settings.DATABASES['default'] = {'ENGINE': 'blah.mysql'}

        self.assertEquals(get_db_engine(), 'mysql')

        django_settings.DATABASES = _databases
        django_settings.DATABASE_ENGINE = _engine

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
