from django.views.generic.base import RedirectView

from sentry.web.frontend.base import control_silo_view


@control_silo_view
class MsTeamsConfigureRedirectView(RedirectView):
    """Configure URL target for Microsoft Teams installs.

    The Sentry bot in Teams renders an installation card whose link points
    here with `signed_params` in the query string. We forward those params to
    the integration link view, which picks an org and opens the install
    pipeline.
    """

    url = "/extensions/msteams/link/"
    query_string = True
    permanent = False
