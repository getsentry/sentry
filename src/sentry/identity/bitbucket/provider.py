from django.http.request import HttpRequest
from django.http.response import HttpResponseBase, HttpResponseRedirect

from sentry.identity.base import Provider
from sentry.pipeline import Pipeline, PipelineView
from sentry.utils.http import absolute_uri


class BitbucketIdentityProvider(Provider):
    key = "bitbucket"
    name = "Bitbucket"

    def get_pipeline_views(self) -> list[PipelineView]:
        return [BitbucketLoginView()]


class BitbucketLoginView(PipelineView):
    def dispatch(self, request: HttpRequest, pipeline: Pipeline) -> HttpResponseBase:
        from sentry.integrations.base import IntegrationDomain
        from sentry.integrations.utils.metrics import (
            IntegrationPipelineViewEvent,
            IntegrationPipelineViewType,
        )

        with IntegrationPipelineViewEvent(
            IntegrationPipelineViewType.IDENTITY_LINK,
            IntegrationDomain.SOURCE_CODE_MANAGEMENT,
            pipeline.provider.key,
        ).capture():
            jwt = request.GET.get("jwt")
            if jwt is None:
                return HttpResponseRedirect(
                    "https://bitbucket.org/site/addons/authorize?descriptor_uri=%s"
                    % (absolute_uri("/extensions/bitbucket/descriptor/"),)
                )
            return pipeline.next_step()
