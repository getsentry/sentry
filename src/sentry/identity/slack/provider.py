from __future__ import absolute_import

from sentry import options
from sentry.identity.oauth2 import OAuth2Provider, OAuth2LoginView, OAuth2CallbackView


class SlackIdentityProvider(OAuth2Provider):
    key = "slack"
    name = "Slack"

    # This identity provider is used for authorizing the Slack application
    # through their Bot token (or legacy Workspace Token if enabled) flow.

    oauth_scopes = ("identity.basic", "identity.email")

    # Only used during installation for Bot apps in order to request "links:read"
    # user_scope, needed for unfurling.
    user_scopes = ()

    def get_oauth_authorize_url(self):
        return "https://slack.com/oauth/v2/authorize"

    # XXX(epurkhiser): While workspace tokens _do_ support the oauth.access
    # endpoint, it will no include the authorizing_user, so we continue to use
    # the deprecated oauth.token endpoint until we are able to migrate to a bot
    # app which uses oauth.access.
    def get_oauth_access_token_url(self):
        return "https://slack.com/api/oauth.v2.access"

    def get_oauth_client_id(self):
        return options.get("slack-v2.client-id") or options.get("slack.client-id")

    def get_oauth_client_secret(self):
        return options.get("slack-v2.client-secret") or options.get("slack.client-secret")

    def get_user_scopes(self):
        return self.config.get("user_scopes", self.user_scopes)

    def get_pipeline_views(self):
        return [
            SlackOAuth2LoginView(
                authorize_url=self.get_oauth_authorize_url(),
                client_id=self.get_oauth_client_id(),
                scope=" ".join(self.get_oauth_scopes()),
                user_scope=" ".join(self.get_user_scopes()),
            ),
            OAuth2CallbackView(
                access_token_url=self.get_oauth_access_token_url(),
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]

    def get_oauth_data(self, payload):
        # TODO(epurkhiser): This flow isn't actually used right now in sentry.
        # In slack-bot world we would need to make an API call to the 'me'
        # endpoint to get their user ID here.
        return super(SlackIdentityProvider, self).get_oauth_data(self, payload)

    def build_identity(self, data):
        data = data["data"]

        return {
            "type": "slack",
            # TODO(epurkhiser): See note above
            "id": data["user"]["id"],
            "email": data["user"]["email"],
            "scopes": sorted(data["scope"].split(",")),
            "data": self.get_oauth_data(data),
        }


class SlackOAuth2LoginView(OAuth2LoginView):
    """
    We need to customize the OAuth2LoginView in order to support passing through
    the `user_scope` param in the request.

    The `user_scope` param would not be used when requesting identity scopes.
    """

    user_scope = ""

    def __init__(
        self, authorize_url=None, client_id=None, scope=None, user_scope=None, *args, **kwargs
    ):
        super(SlackOAuth2LoginView, self).__init__(
            authorize_url=authorize_url, client_id=client_id, scope=scope, *args, **kwargs
        )
        if user_scope is not None:
            self.user_scope = user_scope

    def get_authorize_params(self, state, redirect_uri):
        data = super(SlackOAuth2LoginView, self).get_authorize_params(state, redirect_uri)

        # XXX(meredith): Bot apps must be added manually to channels, and link unfurling
        # only works for channels the bot is a part of, so in order to expand the usage
        # of unfurling to work in channels the bot is not a part of we must request the
        # `links:read` scope for the user. This way channels that the authorizing user
        # are in will support link unfurling
        #
        # The way we can request scopes for users is by using the `user_scope` param. This
        # will give us the user token...which I don't think we use, but requesting the scope
        # seems to be enough to get the unfurling to work.
        #
        # Resources: https://api.slack.com/authentication/oauth-v2#asking
        if self.user_scope:
            data["user_scope"] = self.user_scope

        return data
