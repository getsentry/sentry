# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from django.conf import settings

from sentry.auth import access
from sentry.api.serializers import serialize, DetailedOrganizationSerializer
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
                "invite-members",
                "sso-saml2",
                "sso-basic",
                "symbol-sources",
                "custom-symbol-sources",
                "tweak-grouping-config",
                "grouping-info",
            ]
        )


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
