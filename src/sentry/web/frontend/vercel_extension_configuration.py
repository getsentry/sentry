from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils.http import urlencode

from sentry.integrations.pipeline import IntegrationPipeline
from sentry.models import Organization
from sentry.web.frontend.base import BaseView


class VercelExtensionConfigurationView(BaseView):
    auth_required = False

    def get(self, request, *args, **kwargs):
        # if not request.user.is_authenticated():
        #     configure_uri = u"{}?{}".format(
        #         reverse("vercel-extension-configuration"),
        #         urlencode(
        #             {"targetId": request.GET["targetId"], "targetName": request.GET["targetName"]}
        #         ),
        #     )

        #     redirect_uri = u"{}?{}".format(
        #         reverse("sentry-login"), urlencode({"next": configure_uri})
        #     )

        #     return self.redirect(redirect_uri)

        # TODO: check org
        org = request.user.get_orgs()[0]

        # team_id = request.GET["teamId"]
        # configuration_id = request.GET["configurationId"]
        # code = request.GET["code"]
        # next_page = request.GET["next"]

        pipeline = self.init_pipeline(request, org, request.GET)

        return pipeline.current_step()

    def init_pipeline(self, request, organization, params):
        pipeline = IntegrationPipeline(
            request=request, organization=organization, provider_key="vercel"
        )

        pipeline.initialize()
        pipeline.bind_state("vercel", params)

        return pipeline
