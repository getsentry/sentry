import logging

from django.conf import settings
from django.core.signing import SignatureExpired
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils.http import urlencode
from rest_framework.request import Request
from rest_framework.response import Response

from sentry import features, integrations
from sentry.integrations.pipeline import IntegrationPipeline
from sentry.models import Organization, OrganizationMember
from sentry.web.frontend.base import BaseView

logger = logging.getLogger(__name__)


class ExternalIntegrationPipeline(IntegrationPipeline):
    def _dialog_success(self, _org_integration):
        org_slug = self.organization.slug
        provider = self.provider.integration_key
        integration_id = self.integration.id
        # add in param string if we have a next page
        param_string = ""
        if "next" in self.request.GET:
            param_string = "?%s" % urlencode({"next": self.request.GET["next"]})

        redirect_uri = self.organization.absolute_url(
            f"/settings/{org_slug}/integrations/{provider}/{integration_id}/",
            query=param_string,
        )
        return HttpResponseRedirect(redirect_uri)


class IntegrationExtensionConfigurationView(BaseView):
    auth_required = False

    def get(self, request: Request, *args, **kwargs) -> Response:
        if not request.user.is_authenticated:
            configure_uri = "/extensions/{}/configure/?{}".format(
                self.provider,
                urlencode(request.GET.dict()),
            )

            redirect_uri = "{}?{}".format(
                reverse("sentry-login"), urlencode({"next": configure_uri})
            )

            return self.redirect(redirect_uri)

        # check if we have one org
        organization = None
        organizations = request.user.get_orgs()
        if organizations.count() == 1:
            organization = organizations[0]
        # if we have an org slug in the query param, use that org
        elif "orgSlug" in request.GET:
            organization = Organization.objects.get(slug=request.GET["orgSlug"])

        org_id = organization.id if organization else None
        log_params = {"organization_id": org_id, "provider": self.provider}
        if organization:
            logger.info(
                "integration-extension-config.view",
                extra=log_params,
            )
            # if org does not have the feature flag to show the integration, redirect
            if not self.is_enabled_for_org(organization, request.user):
                return self.redirect("/")

            # only continue in the pipeline if there is at least one feature we can get
            if self.has_one_required_feature(organization, request.user):
                # check that the user has the org:integrations permission
                org_member = OrganizationMember.objects.get(
                    organization=organization, user_id=request.user.id
                )
                if "org:integrations" in org_member.get_scopes():
                    try:
                        pipeline = self.init_pipeline(request, organization, request.GET.dict())
                        return pipeline.current_step()
                    except SignatureExpired:
                        return self.respond(
                            "sentry/pipeline-error.html",
                            {"error": "Installation link expired"},
                        )
                else:
                    logger.info(
                        "integration-extension-config.no-permission",
                        extra=log_params,
                    )
            else:
                logger.info(
                    "integration-extension-config.no-features",
                    extra=log_params,
                )

        logger.info("integration-extension-config.redirect", extra=log_params)
        # if anything before fails, we give up and send them to the link page where we can display errors
        return self.redirect(f"/extensions/{self.provider}/link/?{urlencode(request.GET.dict())}")

    def init_pipeline(self, request: Request, organization, params):
        pipeline = ExternalIntegrationPipeline(
            request=request, organization=organization, provider_key=self.external_provider_key
        )

        pipeline.initialize()
        pipeline.bind_state(self.provider, self.map_params_to_state(params))
        pipeline.bind_state("user_id", request.user.id)
        return pipeline

    def map_params_to_state(self, params):
        return params

    def is_enabled_for_org(self, _org, _user):
        return True

    def has_one_required_feature(self, org, user):
        provider = integrations.get(self.provider)
        integration_features = [f"organizations:integrations-{f.value}" for f in provider.features]
        for flag_name in integration_features:
            log_params = {
                "flag_name": flag_name,
                "organization_id": org.id,
                "provider": self.provider,
            }
            # we have some integration features that are not actually
            # registered. Those features are unrestricted.
            if flag_name not in settings.SENTRY_FEATURES:
                logger.info(
                    "integration-extension-config.missing-feature",
                    extra=log_params,
                )
                return True
            result = features.has(flag_name, org, actor=user)
            logger.info(
                "integration-extension-config.feature-result",
                extra={"result": result, **log_params},
            )
            if result:
                return True
        # no features enabled for this provider
        return False
