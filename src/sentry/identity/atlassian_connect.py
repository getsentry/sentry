from __future__ import absolute_import, print_function

from sentry.pipeline import PipelineView
from sentry.web.helpers import render_to_response
from sentry.utils.http import absolute_uri
from .base import Provider

__all__ = ['AtlassianConnectProvider', 'AtlassianConnectLoginView']


class AtlassianConnectProvider(Provider):

    def get_pipeline_views(self):
        return [
            AtlassianConnectLoginView(
                app_name=self.name,
                app_key=self.key,
            )
        ]


class AtlassianConnectLoginView(PipelineView):
    def __init__(self, app_name, app_key, *args, **kwargs):
        super(AtlassianConnectLoginView, self).__init__(*args, **kwargs)
        self.app_name = app_name
        self.app_key = app_key

    def get_descriptor_uri(self):
        return '/extensions/%s/descriptor/' % self.app_key

    def get_redirect_uri(self):
        return '/extensions/%s/' % self.app_key

    def dispatch(self, request, pipeline):
        return render_to_response(
            template='sentry/integrations/atlassianconnect.html',
            context={
                'app_name': self.app_name,
                'app_key': self.app_key,
                'url': 'https://bitbucket.org/site/addons/authorize?descriptor_uri=%s&redirect_uri=%s' % (
                    absolute_uri(self.get_descriptor_uri()),
                    absolute_uri(self.get_redirect_uri()),
                )
            },
            request=request,
        )
