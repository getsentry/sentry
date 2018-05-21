from __future__ import absolute_import

from sentry.pipeline import PipelineView
from sentry.utils.http import absolute_uri
from sentry.identity.base import Provider


class BitbucketIdentityProvider(Provider):
    key = 'bitbucket'
    name = 'Bitbucket'

    def get_pipeline_views(self):
        return [BitbucketLoginView()]


class BitbucketLoginView(PipelineView):

    def dispatch(self, request, pipeline):
        client_key = request.GET.get('clientKey')
        if client_key is None:
            return self.redirect(
                'https://bitbucket.org/site/addons/authorize?descriptor_uri=%s&redirect_uri=%s' % (
                    absolute_uri('/extensions/bitbucket/descriptor/'),
                    absolute_uri('/extensions/bitbucket/setup/'),
                ))
        pipeline.bind_state('bitbucket_client_key', client_key)
        return pipeline.next_step()
