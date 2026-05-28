from django.views.generic.base import RedirectView

from sentry.web.frontend.base import control_silo_view


@control_silo_view
class DiscordConfigureRedirectView(RedirectView):
    """OAuth redirect target for Discord App Directory installs.

    Forwards `code` and `guild_id` from Discord's OAuth callback to the
    integration link view, which picks an org and opens the install pipeline.
    """

    url = "/extensions/discord/link/"
    query_string = True
    permanent = False
