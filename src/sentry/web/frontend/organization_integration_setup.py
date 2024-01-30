import logging

import sentry_sdk
from django.http import Http404
from django.http.response import HttpResponseBase
from rest_framework.request import Request

from sentry import features
from sentry.features.exceptions import FeatureNotRegistered
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import ControlSiloOrganizationView, control_silo_view

logger = logging.getLogger("sentry.integrations")


@control_silo_view
class OrganizationIntegrationSetupView(ControlSiloOrganizationView):
    required_scope = "org:integrations"

    csrf_protect = False

    def handle(self, request: Request, organization, provider_id) -> HttpResponseBase:
        try:
            with sentry_sdk.configure_scope() as scope:
                parent_span_id = scope.span.span_id
                trace_id = scope.span.trace_id
        except AttributeError:
            parent_span_id = None
            trace_id = None

        with sentry_sdk.start_transaction(
            op="integration.setup",
            name=f"integration.{provider_id}",
            parent_span_id=parent_span_id,
            trace_id=trace_id,
            sampled=True,
        ):
            pipeline = IntegrationPipeline(
                request=request, organization=organization, provider_key=provider_id
            )

            is_feature_enabled = {}
            for feature in pipeline.provider.features:
                feature_flag_name = "organizations:integrations-%s" % feature.value
                try:
                    features.get(feature_flag_name, None)
                    is_feature_enabled[feature_flag_name] = features.has(
                        feature_flag_name, organization
                    )
                except FeatureNotRegistered:
                    is_feature_enabled[feature_flag_name] = True

            if not any(is_feature_enabled.values()):
                return pipeline.render_warning(
                    "At least one feature from this list has to be enabled in order to setup the integration:\n%s"
                    % "\n".join(is_feature_enabled)
                )

            if not pipeline.provider.can_add:
                raise Http404

            pipeline.initialize()

            response = pipeline.current_step()
        return response
