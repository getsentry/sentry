# -*- coding: utf-8 -*-

from __future__ import absolute_import

import six

from sentry.api.serializers import serialize
from sentry.testutils import TestCase
from sentry.models import Authenticator, UserEmail
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
        assert len(result['emails']) == 1
        assert result['emails'][0]['email'] == user.email
        assert result['emails'][0]['is_verified'] is False

    def test_no_useremail(self):
        user = self.create_user()

        UserEmail.objects.all().delete()
        assert UserEmail.objects.all().count() == 0

        result = serialize(user)
        assert len(result['emails']) == 0
