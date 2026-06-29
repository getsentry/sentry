from django.views.generic.base import RedirectView

from sentry.web.frontend.base import control_silo_view


@control_silo_view
class JiraConfigureRedirectView(RedirectView):
    """Configure URL target for Jira Cloud installs.

    The Jira UI hook renders an installation link pointing here with
    `signed_params` in the query string. We forward those params to the
    integration link view, which picks an org and opens the install pipeline
    modal.
    """

    url = "/extensions/jira/link/"
    query_string = True
    permanent = False
