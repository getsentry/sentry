# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.constants import DataCategory
from sentry.models import OrganizationOption, ProjectKey
from sentry.quotas.base import Quota, QuotaConfig, QuotaScope
from sentry.testutils import TestCase

import pytest


class QuotaTest(TestCase):
    def setUp(self):
        self.backend = Quota()

    def test_get_project_quota(self):
        org = self.create_organization()
        project = self.create_project(organization=org)

        with self.settings(SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE=0):
            with self.options({"system.rate-limit": 0}):
                assert self.backend.get_project_quota(project) == (None, 60)

            OrganizationOption.objects.set_value(org, "sentry:project-rate-limit", 80)

            with self.options({"system.rate-limit": 100}):
                assert self.backend.get_project_quota(project) == (80, 60)

            with self.options({"system.rate-limit": 0}):
                assert self.backend.get_project_quota(project) == (None, 60)

    def test_get_key_quota(self):
        key = ProjectKey.objects.create(
            project=self.project, rate_limit_window=5, rate_limit_count=60
        )
        assert self.backend.get_key_quota(key) == (60, 5)

    def test_get_key_quota_empty(self):
        key = ProjectKey.objects.create(
            project=self.project, rate_limit_window=None, rate_limit_count=None
        )
        assert self.backend.get_key_quota(key) == (None, 0)

    def test_get_key_quota_multiple_keys(self):
        # This checks for a regression where we'd cache key quotas per project
        # rather than per key.
        key = ProjectKey.objects.create(
            project=self.project, rate_limit_window=None, rate_limit_count=None
        )
        rate_limited_key = ProjectKey.objects.create(
            project=self.project, rate_limit_window=200, rate_limit_count=86400
        )
        assert self.backend.get_key_quota(key) == (None, 0)
        assert self.backend.get_key_quota(rate_limited_key) == (86400, 200)

    def test_get_organization_quota_with_account_limit_and_higher_system_limit(self):
        org = self.create_organization()
        OrganizationOption.objects.set_value(org, "sentry:account-rate-limit", 3600)
        with self.options({"system.rate-limit": 61}):
            assert self.backend.get_organization_quota(org) == (3600, 3600)

    def test_get_organization_quota_with_account_limit_and_lower_system_limit(self):
        org = self.create_organization()
        OrganizationOption.objects.set_value(org, "sentry:account-rate-limit", 3600)
        with self.options({"system.rate-limit": 59}):
            assert self.backend.get_organization_quota(org) == (59, 60)

    def test_get_organization_quota_with_account_limit_and_no_system_limit(self):
        org = self.create_organization()
        OrganizationOption.objects.set_value(org, "sentry:account-rate-limit", 3600)
        with self.options({"system.rate-limit": 0}):
            assert self.backend.get_organization_quota(org) == (3600, 3600)

    def test_get_organization_quota_with_no_account_limit_and_system_limit(self):
        org = self.create_organization()
        with self.settings(
            SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE="50%", SENTRY_SINGLE_ORGANIZATION=False
        ), self.options({"system.rate-limit": 10}):
            assert self.backend.get_organization_quota(org) == (5, 60)

    def test_get_organization_quota_with_no_account_limit_and_relative_system_limit_single_org(
        self,
    ):
        org = self.create_organization()
        with self.settings(
            SENTRY_DEFAULT_MAX_EVENTS_PER_MINUTE="50%", SENTRY_SINGLE_ORGANIZATION=True
        ), self.options({"system.rate-limit": 10}):
            assert self.backend.get_organization_quota(org) == (10, 60)


@pytest.mark.parametrize(
    "obj,json",
    [
        (
            QuotaConfig(id="o", limit=4711, window=42, reason_code="not_so_fast"),
            {"prefix": "o", "limit": 4711, "window": 42, "reasonCode": "not_so_fast"},
        ),
        (
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=1,
                limit=None,
                window=1,
                reason_code="go_away",
            ),
            {"prefix": "p", "subscope": "1", "window": 1, "reasonCode": "go_away"},
        ),
        (QuotaConfig(limit=0, reason_code="go_away"), {"limit": 0, "reasonCode": "go_away"}),
        (
            QuotaConfig(limit=0, categories=[DataCategory.TRANSACTION], reason_code="not_yet"),
            {"limit": 0, "reasonCode": "not_yet"},
        ),
    ],
)
def test_quotas_to_json_legacy(obj, json):
    assert obj.to_json_legacy() == json


@pytest.mark.parametrize(
    "obj,json",
    [
        (
            QuotaConfig(id="o", limit=4711, window=42, reason_code="not_so_fast"),
            {
                "id": "o",
                "scope": "organization",
                "limit": 4711,
                "window": 42,
                "reasonCode": "not_so_fast",
            },
        ),
        (
            QuotaConfig(
                id="p",
                scope=QuotaScope.PROJECT,
                scope_id=1,
                limit=None,
                window=1,
                reason_code="go_away",
            ),
            {"id": "p", "scope": "project", "scopeId": "1", "window": 1, "reasonCode": "go_away"},
        ),
        (
            QuotaConfig(limit=0, reason_code="go_away"),
            {"limit": 0, "scope": "organization", "reasonCode": "go_away"},
        ),
        (
            QuotaConfig(limit=0, categories=[DataCategory.TRANSACTION], reason_code="go_away"),
            {
                "limit": 0,
                "scope": "organization",
                "categories": ["transaction"],
                "reasonCode": "go_away",
            },
        ),
    ],
)
def test_quotas_to_json(obj, json):
    assert obj.to_json() == json
