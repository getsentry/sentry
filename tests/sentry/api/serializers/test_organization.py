# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.testutils import TestCase


class OrganizationSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)

        result = serialize(organization, user)

        assert result['id'] == six.text_type(organization.id)
        assert result['features'] == set([
            'advanced-search',
            'shared-issues',
            'open-membership',
            'integrations-issue-basic',
            'integrations-issue-sync',
            'invite-members',
            'sso-saml2',
            'sso-basic',
            'sentry10',
            'extended-data-retention',
        ])
