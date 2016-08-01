from __future__ import absolute_import

from django.core.urlresolvers import reverse
from six.moves.urllib.parse import quote
from uuid import uuid4

from sentry.models import UserReport
from sentry.testutils import TestCase


class ErrorPageEmbedTest(TestCase):
    urls = 'sentry.conf.urls'

    def setUp(self):
        super(ErrorPageEmbedTest, self).setUp()
        self.project = self.create_project()
        self.project.update_option('sentry:origins', 'example.com')
        self.key = self.create_project_key(self.project)
        self.event_id = uuid4().hex
        self.path = '%s?eventId=%s&dsn=%s' % (
            reverse('sentry-error-page-embed'),
            quote(self.event_id),
            quote(self.key.dsn_public),
        )

    def test_invalid_referer(self):
        with self.settings(SENTRY_ALLOW_ORIGIN=None):
            resp = self.client.get(self.path, HTTP_REFERER='http://foo.com')
        assert resp.status_code == 403

    def test_renders(self):
        resp = self.client.get(self.path, HTTP_REFERER='http://example.com')
        assert resp.status_code == 200
        self.assertTemplateUsed(resp, 'sentry/error-page-embed.html')

    def test_submission(self):
        resp = self.client.post(self.path, {
            'name': 'Jane Doe',
            'email': 'jane@example.com',
            'comments': 'This is an example!',
        }, HTTP_REFERER='http://example.com')
        assert resp.status_code == 200

        report = UserReport.objects.get()
        assert report.name == 'Jane Doe'
        assert report.email == 'jane@example.com'
        assert report.comments == 'This is an example!'
        assert report.event_id == self.event_id
        assert report.project == self.project
        assert report.group is None

        resp = self.client.post(self.path, {
            'name': 'Joe Shmoe',
            'email': 'joe@example.com',
            'comments': 'haha I updated it!',
        }, HTTP_REFERER='http://example.com')
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
            reverse('sentry-error-page-embed'),
            quote(self.event_id),
            quote(self.key.dsn_public),
        )

        resp = self.client.post(self.path, {
            'name': 'Jane Doe',
            'email': 'jane@example.com',
            'comments': 'This is an example!',
        }, HTTP_REFERER='http://example.com')
        assert resp.status_code == 400
