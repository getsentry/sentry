from __future__ import absolute_import

from sentry.pipeline import PipelineView
from sentry.web.helpers import render_to_response
from sentry.utils.http import absolute_uri
from sentry.identity.base import Provider


class BitbucketIdentityProvider(Provider):
    key = 'bitbucket'
    name = 'Bitbucket'

    def get_pipeline_views(self):
        return [
            BitbucketLoginView(),
        ]


class BitbucketLoginView(PipelineView):
    def dispatch(self, request, pipeline):
        # TODO(LB): verify that user has access to this client key
        client_id = request.GET.get('clientKey')

        if client_id is None:
            return render_to_response(
                template='sentry/integrations/bitbucket.html',
                context={
                    'url': 'https://bitbucket.org/site/addons/authorize?descriptor_uri=%s&redirect_uri=%s' % (
                        absolute_uri('/extensions/bitbucket/descriptor/'),
                        absolute_uri('/extensions/bitbucket/setup/'),
                    )
                },
                request=request,
            )

        pipeline.bind_state('bitbucket_client_id', client_id)
        return pipeline.next_step()
