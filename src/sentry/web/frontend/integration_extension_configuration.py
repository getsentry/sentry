from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils.http import urlencode
from django.http import HttpResponseRedirect

from sentry.integrations.pipeline import IntegrationPipeline
from sentry.web.frontend.base import BaseView
from sentry.models import Organization


class ExternalIntegrationPipeline(IntegrationPipeline):
    def _dialog_success(self, _org_integration):
        org_slug = self.organization.slug
        provider = self.provider.integration_key
        integration_id = self.integration.id
        # add in param string if we have a next page
        param_string = ""
        if "next" in self.request.GET:
            param_string = u"?%s" % urlencode({"next": self.request.GET["next"]})

        redirect_uri = u"/settings/%s/integrations/%s/%s/%s" % (
            org_slug,
            provider,
            integration_id,
            param_string,
        )
        return HttpResponseRedirect(redirect_uri)


class IntegrationExtensionConfigurationView(BaseView):
    auth_required = False

    def get(self, request, *args, **kwargs):
        if not request.user.is_authenticated():
            configure_uri = u"/extensions/{}/configure/?{}".format(
                self.provider, urlencode(request.GET.dict()),
            )

            redirect_uri = u"{}?{}".format(
                reverse("sentry-login"), urlencode({"next": configure_uri})
            )

            return self.redirect(redirect_uri)

        # check if we have one org
        organization = None
        if request.user.get_orgs().count() == 1:
            organization = request.user.get_orgs()[0]
        # if we have an org slug in the query param, use that org
        elif "orgSlug" in request.GET:
            organization = Organization.objects.get(slug=request.GET["orgSlug"])

        if organization:
            # if org does not have the feature, redirect
            if not self.is_enabled_for_org(organization, request.user):
                return self.redirect("/")

            # TODO(steve): we probably should check the user has permissions and show an error page if not
            pipeline = self.init_pipeline(request, organization, request.GET.dict())
            return pipeline.current_step()

        return self.redirect(
            u"/extensions/{}/link/?{}".format(self.provider, urlencode(request.GET.dict()))
        )

    def init_pipeline(self, request, organization, params):
        pipeline = ExternalIntegrationPipeline(
            request=request, organization=organization, provider_key=self.external_provider_key
        )

        pipeline.initialize()
        pipeline.bind_state(self.provider, self.map_params_to_state(params))

        return pipeline

    def map_params_to_state(self, params):
        return params

    def is_enabled_for_org(self, _org, _user):
        return True
