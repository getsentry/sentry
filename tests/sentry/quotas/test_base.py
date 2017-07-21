# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.models import OrganizationOption, ProjectKey
from sentry.quotas.base import BasicQuota, Quota
from sentry.testutils import TestCase


class QuotaTest(TestCase):
    def setUp(self):
        super(QuotaTest, self).setUp()
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

    def test_get_key_quota(self):
        key = ProjectKey.objects.create(
            project=self.project, rate_limit_window=5, rate_limit_count=60)
        assert self.backend.get_key_quota(key) == (60, 5)

        key = ProjectKey.objects.create(
            project=self.project, rate_limit_window=None, rate_limit_count=None)
        assert self.backend.get_key_quota(key) == (0, 0)

    def test_account_limit(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        OrganizationOption.objects.set_value(
            org, 'sentry:account-rate-limit', 80,
        )

        with self.options({'system.rate-limit': 0}):
            quotas = self.backend.get_quotas(project)
            assert BasicQuota(
                key='o:{}'.format(org.id),
                limit=80,
                window=3600,
                reason_code='org_quota',
            ) in quotas

    def test_ignores_disabled_quotas(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        with self.options({'system.rate-limit': 0}):
            quotas = self.backend.get_actionable_quotas(project)
            assert len(quotas) == 0
