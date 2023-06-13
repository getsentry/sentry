from sentry import options
from sentry.auth.provider import MigratingIdentityId
from sentry.auth.providers.oauth2 import OAuth2Callback, OAuth2Login, OAuth2Provider

from .constants import ACCESS_TOKEN_URL, AUTHORIZE_URL, DATA_VERSION, SCOPE
from .views import FetchUser, FlyConfigureView


class FlyOAuth2Login(OAuth2Login):
    # GET https://api.fly.io/oauth/authorize?
    #   client_id=123&
    #   response_type=code&
    #   redirect_uri=https://logjam.io/flyio/callback&
    #   scope=read
    authorize_url = AUTHORIZE_URL
    scope = SCOPE

    def __init__(self, client_id, domains=None):
        self.domains = domains
        super().__init__(client_id=client_id)


class FlyOAuth2Provider(OAuth2Provider):
    name = "Fly"
    access_token_url = ACCESS_TOKEN_URL
    authorize_url = AUTHORIZE_URL

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
        return options.get("auth-fly.client-id")

    def get_client_secret(self):
        return options.get("auth-fly.client-secret")

    def get_configure_view(self):
        # Utilized from organization_auth_settings.py when configuring the app
        # Injected into the configuration form
        return FlyConfigureView.as_view()

    def get_auth_pipeline(self):
        return [
            FlyOAuth2Login(domains=self.domains, client_id=self.get_client_id()),
            OAuth2Callback(
                access_token_url=ACCESS_TOKEN_URL,
                client_id=self.get_client_id(),
                client_secret=self.get_client_secret(),
            ),
            FetchUser(domains=self.domains, version=self.version),
            # ConfirmEmail(),
        ]

    def get_refresh_token_url(self):
        return ACCESS_TOKEN_URL

    def build_config(self, state):
        return {"domains": [state["domain"]], "version": DATA_VERSION}

    def build_identity(self, state):
        # TODO: Discuss with Fly on what this looks like
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
