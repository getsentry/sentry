from __future__ import absolute_import

import six

from django.core.urlresolvers import reverse
from rest_framework.response import Response
from social_auth.models import UserSocialAuth

from sentry.exceptions import InvalidIdentity, PluginError


class ProviderMixin(object):
    auth_provider = None
    logger = None

    def needs_auth(self, user, **kwargs):
        """
        Return ``True`` if the authenticated user needs to associate an auth
        service before performing actions with this provider.
        """
        if self.auth_provider is None:
            return False

        if not user.is_authenticated():
            return True

        return not UserSocialAuth.objects.filter(
            user=user,
            provider=self.auth_provider,
        ).exists()

    def get_auth(self, user):
        if self.auth_provider is None:
            return None

        if not user.is_authenticated():
            return None

        return UserSocialAuth.objects.filter(
            user=user,
            provider=self.auth_provider,
        ).first()

    def handle_api_error(self, error):
        context = {
            'error_type': 'unknown',
        }
        if isinstance(error, InvalidIdentity):
            context.update({
                'error_type': 'auth',
                'auth_url': reverse('socialauth_associate', args=[self.auth_provider])
            })
            status = 400
        elif isinstance(error, PluginError):
            # TODO(dcramer): we should have a proper validation error
            context.update({
                'error_type': 'validation',
                'errors': {'__all__': error.message},
            })
            status = 400
        else:
            if self.logger:
                self.logger.exception(six.text_type(error))
            status = 500
        return Response(context, status=status)
