from __future__ import absolute_import

from django.core.urlresolvers import reverse
from six.moves.urllib.parse import quote
from uuid import uuid4
import logging

from sentry.models import Environment, UserReport
from sentry.testutils import TestCase
from sentry.event_manager import EventManager


class ErrorPageEmbedTest(TestCase):
    urls = 'sentry.conf.urls'

    def setUp(self):
        super(ErrorPageEmbedTest, self).setUp()
        self.project = self.create_project()
        self.project.update_option('sentry:origins', ['example.com'])
        self.key = self.create_project_key(self.project)
        self.event_id = uuid4().hex
        self.path = '%s?eventId=%s&dsn=%s' % (
            reverse('sentry-error-page-embed'), quote(self.event_id), quote(self.key.dsn_public),
        )

    def test_invalid_referer(self):
        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            resp = self.client.get(self.path, HTTP_REFERER='http://foo.com')
        assert resp.status_code == 403

    def test_renders(self):
        resp = self.client.get(self.path, HTTP_REFERER='http://example.com')
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/error-page-embed.html')

    def test_uses_locale_from_header(self):
        resp = self.client.get(
            self.path, HTTP_REFERER='http://example.com', HTTP_ACCEPT_LANGUAGE='fr'
        )
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/error-page-embed.html')
        assert 'Fermer' in resp.content  # Close

    def test_submission(self):
        resp = self.client.post(
            self.path, {
                'name': 'Jane Doe',
                'email': 'jane@example.com',
                'comments': 'This is an example!',
            },
            HTTP_REFERER='http://example.com'
        )
        assert resp.status_code == 200

        report = UserReport.objects.get()
        assert report.name == 'Jane Doe'
        assert report.email == 'jane@example.com'
        assert report.comments == 'This is an example!'
        assert report.event_id == self.event_id
        assert report.project == self.project
        assert report.group is None

        resp = self.client.post(
            self.path, {
                'name': 'Joe Shmoe',
                'email': 'joe@example.com',
                'comments': 'haha I updated it!',
            },
            HTTP_REFERER='http://example.com'
        )
        assert resp.status_code == 200

        report = UserReport.objects.get()
        assert report.name == 'Joe Shmoe'
        assert report.email == 'joe@example.com'
        assert report.comments == 'haha I updated it!'
        assert report.event_id == self.event_id
        assert report.project == self.project
        assert report.group is None

    def test_submission_invalid_event_id(self):
        self.event_id = 'x' * 100
        self.path = '%s?eventId=%s&dsn=%s' % (
            reverse('sentry-error-page-embed'), quote(self.event_id), quote(self.key.dsn_public),
        )

        resp = self.client.post(
            self.path, {
                'name': 'Jane Doe',
                'email': 'jane@example.com',
                'comments': 'This is an example!',
            },
            HTTP_REFERER='http://example.com'
        )
        assert resp.status_code == 400


class ErrorPageEmbedEnvironmentTest(TestCase):

    urls = 'sentry.conf.urls'

    def setUp(self):
        self.project = self.create_project()
        self.project.update_option('sentry:origins', ['example.com'])
        self.key = self.create_project_key(self.project)
        self.event_id = uuid4().hex
        self.path = '%s?eventId=%s&dsn=%s' % (
            reverse('sentry-error-page-embed'), quote(self.event_id), quote(self.key.dsn_public),
        )
        self.environment = Environment.objects.create(
            project_id=self.project.id,
            organization_id=self.project.organization_id,
            name='production',
        )
        self.environment.add_project(self.project)

    def make_event(self, **kwargs):
        result = {
            'event_id': 'a' * 32,
            'message': 'foo',
            'timestamp': 1403007314.570599,
            'level': logging.ERROR,
            'logger': 'default',
            'tags': [],
        }
        result.update(kwargs)
        manager = EventManager(result)
        manager.normalize()
        manager.save(self.project.id)

    def test_environment_gets_user_report(self):
        self.make_event(
            environment=self.environment.name,
            event_id=self.event_id,
            group=self.group,
        )
        self.login_as(user=self.user)
        response = self.client.post(
            self.path, {
                'name': 'Jane Doe',
                'email': 'jane@example.com',
                'comments': 'This is an example!',
            },
            HTTP_REFERER='http://example.com'
        )

        assert response.status_code == 200, response.content
        assert UserReport.objects.get(event_id=self.event_id).environment == self.environment

    def test_user_report_gets_environment(self):
        self.login_as(user=self.user)
        response = self.client.post(
            self.path, {
                'name': 'Jane Doe',
                'email': 'jane@example.com',
                'comments': 'This is an example!',
            },
            HTTP_REFERER='http://example.com'
        )
        self.make_event(
            environment=self.environment.name,
            event_id=self.event_id,
            group=self.group,
        )
        assert response.status_code == 200, response.content
        assert UserReport.objects.get(event_id=self.event_id).environment == self.environment
