from __future__ import absolute_import

from django.core.urlresolvers import reverse
from django.utils.http import urlencode

from sentry.integrations.pipeline import IntegrationPipeline
from sentry.models import Organization
from sentry.web.frontend.base import BaseView


# TODO(Steve): use IntegrationExtensionConfigurationView
class VstsExtensionConfigurationView(BaseView):
    auth_required = False

    def get(self, request, *args, **kwargs):
        if not request.user.is_authenticated():
            configure_uri = u"{}?{}".format(
                reverse("vsts-extension-configuration"),
                urlencode(
                    {"targetId": request.GET["targetId"], "targetName": request.GET["targetName"]}
                ),
            )

            redirect_uri = u"{}?{}".format(
                reverse("sentry-login"), urlencode({"next": configure_uri})
            )

            return self.redirect(redirect_uri)

        if request.user.get_orgs().count() == 1:
            org = request.user.get_orgs()[0]

            pipeline = self.init_pipeline(
                request, org, request.GET["targetId"], request.GET["targetName"]
            )

            return pipeline.current_step()
        else:
            return self.redirect(
                u"/extensions/vsts/link/?{}".format(
                    urlencode(
                        {
                            "targetId": request.GET["targetId"],
                            "targetName": request.GET["targetName"],
                        }
                    )
                )
            )

    def post(self, request, *args, **kwargs):
        # Update Integration with Organization chosen
        org = Organization.objects.get(slug=request.POST["organization"])

        pipeline = self.init_pipeline(
            request, org, request.POST["vsts_id"], request.POST["vsts_name"]
        )

        return pipeline.current_step()

    def init_pipeline(self, request, organization, id, name):
        pipeline = IntegrationPipeline(
            request=request, organization=organization, provider_key="vsts-extension"
        )

        pipeline.initialize()
        pipeline.bind_state("vsts", {"accountId": id, "accountName": name})

        return pipeline
