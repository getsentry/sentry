# -*- coding: utf-8 -*-

from __future__ import absolute_import

import mock
from django.core.urlresolvers import reverse
from sentry.models import Project
from sentry.testutils import TestCase, fixture


class CrossDomainXmlTest(TestCase):
    @fixture
    def project(self):
        return Project.objects.create(name='foo', slug='foo')

    @fixture
    def path(self):
        return reverse('sentry-api-crossdomain-xml', kwargs={'project_id': self.project.slug})

    @mock.patch('sentry.web.api.get_origins')
    def test_output_with_global(self, get_origins):
        get_origins.return_value = '*'
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain.xml')
        self.assertIn('<allow-access-from domain="*" secure="true"></allow-access-from>', resp.content)

    @mock.patch('sentry.web.api.get_origins')
    def test_output_with_whitelist(self, get_origins):
        get_origins.return_value = ['disqus.com', 'www.disqus.com']
        resp = self.client.get(self.path)
        get_origins.assert_called_once_with(self.project)
        self.assertEquals(resp.status_code, 200)
        self.assertEquals(resp['Content-Type'], 'application/xml')
        self.assertTemplateUsed(resp, 'sentry/crossdomain.xml')
        self.assertIn('<allow-access-from domain="disqus.com" secure="true"></allow-access-from>', resp.content)
        self.assertIn('<allow-access-from domain="www.disqus.com" secure="true"></allow-access-from>', resp.content)
