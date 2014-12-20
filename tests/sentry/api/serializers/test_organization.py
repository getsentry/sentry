# -*- coding: utf-8 -*-

from __future__ import absolute_import

from sentry.api.serializers import serialize
from sentry.testutils import TestCase


class OrganizationSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user()
        organization = self.create_organization(owner=user)

        result = serialize(organization, user)
        assert result['id'] == str(organization.id)
