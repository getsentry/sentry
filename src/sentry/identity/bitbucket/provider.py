from sentry.identity.base import Provider
from sentry.pipeline import PipelineView
from sentry.utils.http import absolute_uri


class BitbucketIdentityProvider(Provider):
    key = "bitbucket"
    name = "Bitbucket"

    def get_pipeline_views(self):
        return [BitbucketLoginView()]


from rest_framework.request import Request
from rest_framework.response import Response


class BitbucketLoginView(PipelineView):
    def dispatch(self, request: Request, pipeline) -> Response:
        jwt = request.GET.get("jwt")
        if jwt is None:
            return self.redirect(
                "https://bitbucket.org/site/addons/authorize?descriptor_uri=%s"
                % (absolute_uri("/extensions/bitbucket/descriptor/"),)
            )
        return pipeline.next_step()
