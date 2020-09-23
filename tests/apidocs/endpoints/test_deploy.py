# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime

from django.core.urlresolvers import reverse
from django.test.client import RequestFactory

from sentry.models import Deploy, Environment, Release
from tests.apidocs.util import APIDocsTestCase


class ReleaseDeploysDocs(APIDocsTestCase):
    def setUp(self):
        project = self.create_project(name="foo")
        release = Release.objects.create(organization_id=project.organization_id, version="1")
        release.add_project(project)
        Deploy.objects.create(
            environment_id=Environment.objects.create(
                organization_id=project.organization_id, name="production"
            ).id,
            organization_id=project.organization_id,
            release=release,
            date_finished=datetime.datetime.utcnow() - datetime.timedelta(days=1),
        )
        Deploy.objects.create(
            environment_id=Environment.objects.create(
                organization_id=project.organization_id, name="staging"
            ).id,
            organization_id=project.organization_id,
            release=release,
        )

        self.url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
        )

        self.login_as(user=self.user)

    def test_post(self):
        data = {
            "name": "foo",
            "environment": "production",
            "url": "https://www.example.com",
        }
        response = self.client.post(self.url, data)
        request = RequestFactory().post(self.url, data)

        self.validate_schema(request, response)
