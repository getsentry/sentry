from sentry import options
from sentry.auth.provider import MigratingIdentityId
from sentry.auth.providers.oauth2 import OAuth2Callback, OAuth2Login, OAuth2Provider

from .constants import ACCESS_TOKEN_URL, AUTHORIZE_URL, DATA_VERSION, SCOPE
from .views import FetchUser, GoogleConfigureView


class GoogleOAuth2Login(OAuth2Login):
    authorize_url = AUTHORIZE_URL
    scope = SCOPE

    def __init__(self, client_id, domains=None):
        self.domains = domains
        super().__init__(client_id=client_id)

    def get_authorize_params(self, state, redirect_uri):
        params = super().get_authorize_params(state, redirect_uri)
        # TODO(dcramer): ideally we could look at the current resulting state
        # when an existing auth happens, and if they're missing a refresh_token
        # we should re-prompt them a second time with ``approval_prompt=force``
        params["approval_prompt"] = "force"
        params["access_type"] = "offline"
        return params


class GoogleOAuth2Provider(OAuth2Provider):
    name = "Google"

    def __init__(self, domain=None, domains=None, version=None, **config):
        if domain:
            if domains:
                domains.append(domain)
            else:
                domains = [domain]
        self.domains = domains
        # if a domain is not configured this is part of the setup pipeline
        # this is a bit complex in Sentry's SSO implementation as we don't
        # provide a great way to get initial state for new setup pipelines
        # vs missing state in case of migrations.
        if domains is None:
            version = DATA_VERSION
        else:
            version = None
        self.version = version
        super().__init__(**config)

    def get_client_id(self):
        return options.get("auth-google.client-id")

    def get_client_secret(self):
        return options.get("auth-google.client-secret")

    def get_configure_view(self):
        return GoogleConfigureView.as_view()

    def get_auth_pipeline(self):
        return [
            GoogleOAuth2Login(domains=self.domains, client_id=self.get_client_id()),
            OAuth2Callback(
                access_token_url=ACCESS_TOKEN_URL,
                client_id=self.get_client_id(),
                client_secret=self.get_client_secret(),
            ),
            FetchUser(domains=self.domains, version=self.version),
        ]

    def get_refresh_token_url(self):
        return ACCESS_TOKEN_URL

    def build_config(self, state):
        return {"domains": [state["domain"]], "version": DATA_VERSION}

    def build_identity(self, state):
        # https://developers.google.com/identity/protocols/OpenIDConnect#server-flow
        # data.user => {
        #      "iss":"accounts.google.com",
        #      "at_hash":"HK6E_P6Dh8Y93mRNtsDB1Q",
        #      "email_verified":"true",
        #      "sub":"10769150350006150715113082367",
        #      "azp":"1234987819200.apps.googleusercontent.com",
        #      "email":"jsmith@example.com",
        #      "aud":"1234987819200.apps.googleusercontent.com",
        #      "iat":1353601026,
        #      "exp":1353604926,
        #      "hd":"example.com"
        # }
        data = state["data"]
        user_data = state["user"]

        # XXX(epurkhiser): We initially were using the email as the id key.
        # This caused account dupes on domain changes. Migrate to the
        # account-unique sub key.
        user_id = MigratingIdentityId(id=user_data["sub"], legacy_id=user_data["email"])

        return {
            "id": user_id,
            "email": user_data["email"],
            "name": user_data["email"],
            "data": self.get_oauth_data(data),
            "email_verified": user_data["email_verified"],
        }
