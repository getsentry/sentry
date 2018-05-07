from __future__ import absolute_import, print_function

from sentry.pipeline import PipelineView
from sentry.web.helpers import render_to_response
from .base import Provider
# from django import forms


class JSONWebTokenProvider(Provider):
    """
    The JSONWebTokenProvider is a way to implement an identity provider
    that uses JSON Web Tokens (JWT) https://jwt.io/ to authenticate apps.
    """
    pass


class JWTLoginView(PipelineView):

    def __init__(self, *args, **kwargs):
        super(JWTLoginView, self).__init__(*args, **kwargs)


class AtlassianConnectProvider(Provider):
    pass


class AtlassianConnectLoginView(PipelineView):
    def __init__(self, app_name, app_key, *args, **kwargs):
        super(AtlassianConnectLoginView, self).__init__(*args, **kwargs)
        self.app_name = app_name
        self.app_key = app_key

    def get_descriptor_uri(self):
        raise NotImplementedError

    def get_redirect_uri(self):
        raise NotImplementedError

    def dispatch(self, request, pipeline):
        return render_to_response(
            template='sentry/integrations/atlassianconnect.html',
            context={
                'app_name': self.app_name,
                'app_key': self.app_key,
                'url': 'https://bitbucket.org/site/addons/authorize?descriptor_uri=%s&redirect_uri=%s' % (
                    self.get_descriptor_uri(),
                    self.get_redirect_uri(),
                )
            },
            request=request,
        )
