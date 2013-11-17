"""
Google App Engine support using User API

This backend is for use of django-social-auth on top
of Google's App Engine PaaS.

This backend directly uses Google's User API that
is available on the App Engine platform.
"""
from __future__ import absolute_import

from google.appengine.api import users

from django.contrib.auth import authenticate
from django.core.urlresolvers import reverse

from social_auth.backends import SocialAuthBackend, BaseAuth
from social_auth.exceptions import AuthException


class GAEBackend(SocialAuthBackend):
    """GoogleAppengine authentication backend"""
    name = 'google-appengine'

    def get_user_id(self, details, response):
        """Return current user id."""
        user = users.get_current_user()
        if user:
            return user.user_id()

    def get_user_details(self, response):
        """Return user basic information (id and email only)."""
        user = users.get_current_user()
        return {'username': user.user_id(),
                'email': user.email(),
                'fullname': '',
                'first_name': '',
                'last_name': ''}


# Auth classes
class GAEAuth(BaseAuth):
    """GoogleAppengine authentication"""
    AUTH_BACKEND = GAEBackend

    def auth_url(self):
        """Build and return complete URL."""
        return users.create_login_url(reverse('socialauth_complete',
                                              args=(self.AUTH_BACKEND.name,)))

    def auth_complete(self, *args, **kwargs):
        """Completes login process, must return user instance."""
        if not users.get_current_user():
            raise AuthException('Authentication error')

        # Setting these two are necessary for BaseAuth.authenticate to work
        kwargs.update({
            'response': '',
            self.AUTH_BACKEND.name: True
        })
        return authenticate(*args, **kwargs)


# Backend definition
BACKENDS = {
    'google-appengine': GAEAuth,
}
