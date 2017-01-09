# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import OrganizationOption
from sentry.quotas.base import Quota
from sentry.testutils import TestCase


class QuotaTest(TestCase):
    def setUp(self):
        self.backend = Quota()

    def test_get_project_quota(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        with self.settings(SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE=0):
            with self.options({'system.rate-limit': 0}):
                assert self.backend.get_project_quota(project) == (0, 60)

            OrganizationOption.objects.set_value(
                org, 'sentry:project-rate-limit', 80,
            )

            with self.options({'system.rate-limit': 100}):
                assert self.backend.get_project_quota(project) == (80, 60)

            with self.options({'system.rate-limit': 0}):
                assert self.backend.get_project_quota(project) == (0, 60)
