from __future__ import absolute_import, print_function

from django.contrib import messages
from django.utils.translation import ugettext_lazy as _

from sentry.identity.pipeline import IdentityProviderPipeline
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import BaseView


# The request doesn't contain the pipeline type (pipeline information is stored
# in redis keyed by the pipeline name), so we try to construct multiple pipelines
# and use whichever one works.
PIPELINE_CLASSES = [IntegrationPipeline, IdentityProviderPipeline]


class PipelineAdvancerView(BaseView):
    """Gets the current pipeline from the request and executes the current step."""
    auth_required = False

    csrf_protect = False

    def handle(self, request, provider_id):
        pipeline = None
        for pipeline_cls in PIPELINE_CLASSES:
            pipeline = pipeline_cls.get_for_request(request=request)
            if pipeline:
                break

        if pipeline is None or not pipeline.is_valid():
            messages.add_message(request, messages.ERROR, _("Invalid request."))
            return self.redirect('/')

        return pipeline.current_step()
