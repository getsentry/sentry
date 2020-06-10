# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from datetime import timedelta
from django.conf import settings
from django.utils import timezone

from sentry.auth import access
from sentry.api.serializers import (
    serialize,
    DetailedOrganizationSerializer,
    OnboardingTasksSerializer,
)
from sentry.models import OnboardingTask, OnboardingTaskStatus, OrganizationOnboardingTask
from sentry.testutils import TestCase


class OrganizationSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)

        result = serialize(organization, user)

        assert result["id"] == six.text_type(organization.id)
        assert result["features"] == set(
            [
                "advanced-search",
                "shared-issues",
                "open-membership",
                "integrations-issue-basic",
                "integrations-issue-sync",
                "data-forwarding",
                "invite-members",
                "sso-saml2",
                "sso-basic",
                "symbol-sources",
                "custom-symbol-sources",
                "tweak-grouping-config",
                "grouping-info",
                "releases-v2",
                "discover-basic",
                "discover-query",
            ]
        )


class OnboardingTasksSerializerTest(TestCase):
    def test_serializer(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        now = timezone.now()

        want = OrganizationOnboardingTask(
            organization_id=organization.id,
            task=OnboardingTask.FIRST_PROJECT,
            completion_seen=now,
            date_completed=now - timedelta(minutes=5),
            user=user,
            status=OnboardingTaskStatus.COMPLETE,
            project_id=100,
        )

        result = serialize(want, user, OnboardingTasksSerializer())

        assert result["task"] == "create_project"
        assert result["status"] == "complete"
        assert result["user"]["id"] == six.text_type(user.id)
        assert result["completionSeen"] == want.completion_seen
        assert result["dateCompleted"] == want.date_completed
        assert result["data"] == want.data
        assert result["project"] == want.project_id


class DetailedOrganizationSerializerTest(TestCase):
    def test_detailed(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)
        acc = access.from_user(user, organization)

        serializer = DetailedOrganizationSerializer()
        result = serialize(organization, user, serializer, access=acc)

        assert result["id"] == six.text_type(organization.id)
        assert result["role"] == "owner"
        assert result["access"] == settings.SENTRY_SCOPES
        assert result["relayPiiConfig"] is None
