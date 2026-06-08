from django.views.generic.base import RedirectView

from sentry.web.frontend.base import control_silo_view


@control_silo_view
class VstsExtensionConfigureRedirectView(RedirectView):
    """Configure URL target for Azure DevOps Marketplace installs.

    The Azure DevOps Marketplace links here with `targetId` / `targetName` in
    the query string. We forward those params to the integration link view,
    which picks an org and opens the install pipeline modal.
    """

    url = "/extensions/vsts/link/"
    query_string = True
    permanent = False
