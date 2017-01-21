from __future__ import absolute_import

from django.http import HttpRequest
from django.test.utils import override_settings

from sentry.models import User
from sentry.auth.utils import is_active_superuser


def test_is_active_superuser():
    request = HttpRequest()
    request.META['REMOTE_ADDR'] = '10.0.0.1'

    with override_settings(INTERNAL_IPS=()):
        assert is_active_superuser(request) is False
        request.user = User()
        assert is_active_superuser(request) is False
        request.user.is_superuser = True
        assert is_active_superuser(request) is True

    with override_settings(INTERNAL_IPS=('127.0.0.1',)):
        assert is_active_superuser(request) is False

    with override_settings(INTERNAL_IPS=('10.0.0.1',)):
        assert is_active_superuser(request) is True
