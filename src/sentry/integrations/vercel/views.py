from django.views.generic.base import RedirectView

from sentry.web.frontend.base import control_silo_view


@control_silo_view
class VercelConfigureRedirectView(RedirectView):
    """Configure URL target for Vercel marketplace installs.

    Vercel's marketplace install links point at `/extensions/vercel/configure/`
    with the OAuth `code` (and `configurationId`/`teamId`) in the query string.
    We forward those params to the integration link view, which picks an org and
    opens the install pipeline modal to finish the install. The configure URL has
    to keep resolving because the Vercel integration has it baked in as the
    redirect URL.
    """

    url = "/extensions/vercel/link/"
    query_string = True
    permanent = False
