import logging

import sentry_sdk
from django.http import Http404, HttpRequest
from django.http.response import HttpResponseBase
from sentry_sdk.tracing import TRANSACTION_SOURCE_VIEW

from sentry import features
from sentry.features.exceptions import FeatureNotRegistered
from sentry.integrations.base import IntegrationProvider
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import ControlSiloOrganizationView, control_silo_view

logger = logging.getLogger("sentry.integrations")


@control_silo_view
class OrganizationIntegrationSetupView(ControlSiloOrganizationView):
    required_scope = "org:integrations"

    csrf_protect = False

    def handle(self, request: HttpRequest, organization, provider_id) -> HttpResponseBase:
        scope = sentry_sdk.Scope.get_current_scope()
        scope.set_transaction_name(f"integration.{provider_id}", source=TRANSACTION_SOURCE_VIEW)

        pipeline = IntegrationPipeline(
            request=request, organization=organization, provider_key=provider_id
        )

        is_feature_enabled = {}
        assert isinstance(
            pipeline.provider, IntegrationProvider
        ), "Pipeline must be an integration provider to get features"
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

        return pipeline.current_step()
