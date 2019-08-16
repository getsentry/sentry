from __future__ import absolute_import

from sentry.pipeline import PipelineView
from sentry.utils.http import absolute_uri
from sentry.identity.base import Provider


class BitbucketIdentityProvider(Provider):
    key = "bitbucket"
    name = "Bitbucket"

    def get_pipeline_views(self):
        return [BitbucketLoginView()]


class BitbucketLoginView(PipelineView):
    def dispatch(self, request, pipeline):
        jwt = request.GET.get("jwt")
        if jwt is None:
            return self.redirect(
                "https://bitbucket.org/site/addons/authorize?descriptor_uri=%s"
                % (absolute_uri("/extensions/bitbucket/descriptor/"),)
            )
        return pipeline.next_step()
