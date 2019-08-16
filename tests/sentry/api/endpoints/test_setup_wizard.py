# -*- coding: utf-8 -*-

from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.testutils import APITestCase


class SetupWizardTest(APITestCase):
    def test_simple(self):
        self.create_project(name="foo")

        url = reverse("sentry-api-0-project-wizard-new")

        self.login_as(user=self.user)

        response = self.client.get(url)
        assert response.status_code == 200, response.content
        assert response.data["hash"]

    def test_anonymous(self):
        self.create_project(name="foo")

        url = reverse("sentry-api-0-project-wizard-new")

        response = self.client.get(url)
        assert response.status_code == 200, response.content

    def test_fill_and_read(self):
        self.create_project(name="foo")

        url = reverse("sentry-api-0-project-wizard-new")

        self.login_as(user=self.user)

        response = self.client.get(url)
        wizard_hash = response.data["hash"]
        assert response.status_code == 200, response.content
        assert wizard_hash

        url2 = reverse("sentry-api-0-project-wizard", kwargs={"wizard_hash": wizard_hash})

        response2 = self.client.get(url2)
        assert response2.status_code == 400, response2.content

        # Delete content of cache
        self.client.delete(url2)

        response5 = self.client.get(url2)
        assert response5.status_code == 404, response5.content
