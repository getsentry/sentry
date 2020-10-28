# -*- coding: utf-8 -*-

from __future__ import absolute_import

import datetime

from django.core.urlresolvers import reverse

from sentry.models import Deploy, Environment, Release, ReleaseProjectEnvironment
from sentry.testutils import APITestCase


class ReleaseDeploysListTest(APITestCase):
    def test_simple(self):
        project = self.create_project(name="foo")
        release = Release.objects.create(
            organization_id=project.organization_id,
            # test unicode
            version="1–0",
        )
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

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
        )

        self.login_as(user=self.user)

        response = self.client.get(url)

        assert response.status_code == 200, response.content
        assert response.data[0]["environment"] == "staging"
        assert response.data[1]["environment"] == "production"


class ReleaseDeploysCreateTest(APITestCase):
    def test_simple(self):
        project = self.create_project(name="foo")
        release = Release.objects.create(
            organization_id=project.organization_id, version="1", total_deploys=0
        )
        release.add_project(project)

        environment = Environment.objects.create(
            organization_id=project.organization_id, name="production"
        )

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
        )

        self.login_as(user=self.user)

        response = self.client.post(
            url, data={"name": "foo", "environment": "production", "url": "https://www.example.com"}
        )
        assert response.status_code == 201, response.content
        assert response.data["name"] == "foo"
        assert response.data["url"] == "https://www.example.com"
        assert response.data["environment"] == "production"

        deploy = Deploy.objects.get(id=response.data["id"])

        assert deploy.name == "foo"
        assert deploy.environment_id == environment.id
        assert deploy.url == "https://www.example.com"
        assert deploy.release == release

        release = Release.objects.get(id=release.id)
        assert release.total_deploys == 1
        assert release.last_deploy_id == deploy.id

        rpe = ReleaseProjectEnvironment.objects.get(
            project=project, release=release, environment=environment
        )
        assert rpe.last_deploy_id == deploy.id

    def test_environment_validation_failure(self):
        project = self.create_project(name="example")
        release = Release.objects.create(
            organization_id=project.organization_id, version="123", total_deploys=0
        )
        release.add_project(project)

        url = reverse(
            "sentry-api-0-organization-release-deploys",
            kwargs={"organization_slug": project.organization.slug, "version": release.version},
        )

        self.login_as(user=self.user)
        response = self.client.post(
            url, data={"name": "foo", "environment": "bad/name", "url": "https://www.example.com"}
        )
        assert response.status_code == 400, response.content
        assert 0 == Deploy.objects.count()
