# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.testutils import TestCase
from sentry.models import Authenticator
from sentry.models.authenticator import available_authenticators


class UserSerializerTest(TestCase):
    def test_simple(self):
        user = self.create_user()

        result = serialize(user)
        assert result['id'] == six.text_type(user.id)
        assert result['has2fa'] is False

        Authenticator.objects.create(
            user=user,
            type=available_authenticators(ignore_backup=True)[0].type,
        )

        result = serialize(user)
        assert result['id'] == six.text_type(user.id)
        assert result['has2fa'] is True
