from __future__ import absolute_import, print_function

__all__ = ["OAuth2Provider", "OAuth2CallbackView", "OAuth2LoginView"]

import logging
from six.moves.urllib.parse import parse_qsl, urlencode
from uuid import uuid4
from time import time
from requests.exceptions import SSLError
from django.views.decorators.csrf import csrf_exempt

from sentry.auth.exceptions import IdentityNotValid
from sentry.http import safe_urlopen, safe_urlread
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json
from sentry.utils.http import absolute_uri
from sentry.pipeline import PipelineView

from .base import Provider

logger = logging.getLogger(__name__)
ERR_INVALID_STATE = "An error occurred while validating your request."


class OAuth2Provider(Provider):
    """
    The OAuth2Provider is a generic way to implement an identity provider that
    uses the OAuth 2.0 protocol as a means for authenticating a user.

    OAuth scopes are configured through the oauth_scopes class property,
    however may be overridden using the ``config['oauth_scopes']`` object.
    """

    oauth_access_token_url = ""
    oauth_authorize_url = ""
    refresh_token_url = ""

    oauth_scopes = ()

    def _get_oauth_parameter(self, parameter_name):
        """
        Lookup an OAuth parameter for the provider. Depending on the context of the
        pipeline using the provider, the parameter may come from 1 of 3 places:

        1. Check the class property of the provider for the parameter.

        2. If the provider has the parameters made available within the ``config``.

        3. If provided, check the pipeline's ``provider_model`` for the oauth parameter
           in the config field.

        If the parameter cannot be found a KeyError will be raised.
        """
        try:
            prop = getattr(self, u"oauth_{}".format(parameter_name))
            if prop != "":
                return prop
        except AttributeError:
            pass

        if self.config.get(parameter_name):
            return self.config.get(parameter_name)

        model = self.pipeline.provider_model
        if model and model.config.get(parameter_name) is not None:
            return model.config.get(parameter_name)

        raise KeyError(u'Unable to resolve OAuth parameter "{}"'.format(parameter_name))

    def get_oauth_access_token_url(self):
        return self._get_oauth_parameter("access_token_url")

    def get_oauth_refresh_token_url(self):
        raise NotImplementedError

    def get_oauth_authorize_url(self):
        return self._get_oauth_parameter("authorize_url")

    def get_oauth_client_id(self):
        return self._get_oauth_parameter("client_id")

    def get_oauth_client_secret(self):
        return self._get_oauth_parameter("client_secret")

    def get_oauth_scopes(self):
        return self.config.get("oauth_scopes", self.oauth_scopes)

    def get_refresh_token_headers(self):
        return None

    def get_pipeline_views(self):
        return [
            OAuth2LoginView(
                authorize_url=self.get_oauth_authorize_url(),
                client_id=self.get_oauth_client_id(),
                scope=" ".join(self.get_oauth_scopes()),
            ),
            OAuth2CallbackView(
                access_token_url=self.get_oauth_access_token_url(),
                client_id=self.get_oauth_client_id(),
                client_secret=self.get_oauth_client_secret(),
            ),
        ]

    def get_refresh_token_params(self, refresh_token, *args, **kwargs):
        return {
            "client_id": self.get_client_id(),
            "client_secret": self.get_client_secret(),
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
        }

    def get_oauth_data(self, payload):
        data = {"access_token": payload["access_token"]}
        if "expires_in" in payload:
            data["expires"] = int(time()) + int(payload["expires_in"])
        if "refresh_token" in payload:
            data["refresh_token"] = payload["refresh_token"]
        if "token_type" in payload:
            data["token_type"] = payload["token_type"]

        return data

    def handle_refresh_error(self, req, payload):
        error_name = "unknown_error"
        error_description = "no description available"
        for name_key in ["error", "Error"]:
            if name_key in payload:
                error_name = payload.get(name_key)
                break

        for desc_key in ["error_description", "ErrorDescription"]:
            if desc_key in payload:
                error_description = payload.get(desc_key)
                break

        formatted_error = u"HTTP {} ({}): {}".format(req.status_code, error_name, error_description)

        if req.status_code == 401:
            self.logger.info(
                "identity.oauth.refresh.identity-not-valid-error",
                extra={
                    "error_name": error_name,
                    "error_status_code": req.status_code,
                    "error_description": error_description,
                    "provider_key": self.key,
                },
            )
            raise IdentityNotValid(formatted_error)

        if req.status_code == 400:
            # this may not be common, but at the very least Google will return
            # an invalid grant when a user is suspended
            if error_name == "invalid_grant":
                self.logger.info(
                    "identity.oauth.refresh.identity-not-valid-error",
                    extra={
                        "error_name": error_name,
                        "error_status_code": req.status_code,
                        "error_description": error_description,
                        "provider_key": self.key,
                    },
                )
                raise IdentityNotValid(formatted_error)

        if req.status_code != 200:
            self.logger.info(
                "identity.oauth.refresh.api-error",
                extra={
                    "error_name": error_name,
                    "error_status_code": req.status_code,
                    "error_description": error_description,
                    "provider_key": self.key,
                },
            )
            raise ApiError(formatted_error)

    def refresh_identity(self, identity, *args, **kwargs):
        refresh_token = identity.data.get("refresh_token")

        if not refresh_token:
            raise IdentityNotValid("Missing refresh token")

        # XXX(meredith): This is used in VSTS's `get_refresh_token_params`
        kwargs["identity"] = identity
        data = self.get_refresh_token_params(refresh_token, *args, **kwargs)

        req = safe_urlopen(
            url=self.get_refresh_token_url(), headers=self.get_refresh_token_headers(), data=data
        )

        try:
            body = safe_urlread(req)
            payload = json.loads(body)
        except Exception:
            payload = {}

        self.handle_refresh_error(req, payload)

        identity.data.update(self.get_oauth_data(payload))
        return identity.update(data=identity.data)


class OAuth2LoginView(PipelineView):
    authorize_url = None
    client_id = None
    scope = ""

    def __init__(self, authorize_url=None, client_id=None, scope=None, *args, **kwargs):
        super(OAuth2LoginView, self).__init__(*args, **kwargs)
        if authorize_url is not None:
            self.authorize_url = authorize_url
        if client_id is not None:
            self.client_id = client_id
        if scope is not None:
            self.scope = scope

    def get_scope(self):
        return self.scope

    def get_authorize_url(self):
        return self.authorize_url

    def get_authorize_params(self, state, redirect_uri):
        return {
            "client_id": self.client_id,
            "response_type": "code",
            "scope": self.get_scope(),
            "state": state,
            "redirect_uri": redirect_uri,
        }

    @csrf_exempt
    def dispatch(self, request, pipeline):
        for param in ("code", "error", "state"):
            if param in request.GET:
                return pipeline.next_step()

        state = uuid4().hex

        params = self.get_authorize_params(
            state=state, redirect_uri=absolute_uri(pipeline.redirect_url())
        )
        redirect_uri = u"{}?{}".format(self.get_authorize_url(), urlencode(params))

        pipeline.bind_state("state", state)

        return self.redirect(redirect_uri)


class OAuth2CallbackView(PipelineView):
    access_token_url = None
    client_id = None
    client_secret = None

    def __init__(self, access_token_url=None, client_id=None, client_secret=None, *args, **kwargs):
        super(OAuth2CallbackView, self).__init__(*args, **kwargs)
        if access_token_url is not None:
            self.access_token_url = access_token_url
        if client_id is not None:
            self.client_id = client_id
        if client_secret is not None:
            self.client_secret = client_secret

    def get_token_params(self, code, redirect_uri):
        return {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

    def exchange_token(self, request, pipeline, code):
        # TODO: this needs the auth yet
        data = self.get_token_params(code=code, redirect_uri=absolute_uri(pipeline.redirect_url()))
        verify_ssl = pipeline.config.get("verify_ssl", True)
        try:
            req = safe_urlopen(self.access_token_url, data=data, verify_ssl=verify_ssl)
            body = safe_urlread(req)
            if req.headers.get("Content-Type", "").startswith("application/x-www-form-urlencoded"):
                return dict(parse_qsl(body))
            return json.loads(body)
        except SSLError:
            logger.info(
                "identity.oauth2.ssl-error",
                extra={"url": self.access_token_url, "verify_ssl": verify_ssl},
            )
            url = self.access_token_url
            return {
                "error": "Could not verify SSL certificate",
                "error_description": u"Ensure that {} has a valid SSL certificate".format(url),
            }
        except json.JSONDecodeError:
            logger.info("identity.oauth2.json-error", extra={"url": self.access_token_url})
            return {
                "error": "Could not decode a JSON Response",
                "error_description": u"We were not able to parse a JSON response, please try again.",
            }

    def dispatch(self, request, pipeline):
        error = request.GET.get("error")
        state = request.GET.get("state")
        code = request.GET.get("code")

        if error:
            pipeline.logger.info("identity.token-exchange-error", extra={"error": error})
            return pipeline.error(error)

        if state != pipeline.fetch_state("state"):
            pipeline.logger.info(
                "identity.token-exchange-error",
                extra={
                    "error": "invalid_state",
                    "state": state,
                    "pipeline_state": pipeline.fetch_state("state"),
                    "code": code,
                },
            )
            return pipeline.error(ERR_INVALID_STATE)

        data = self.exchange_token(request, pipeline, code)

        if "error_description" in data:
            error = data.get("error")
            pipeline.logger.info("identity.token-exchange-error", extra={"error": error})
            return pipeline.error(data["error_description"])

        if "error" in data:
            pipeline.logger.info("identity.token-exchange-error", extra={"error": data["error"]})
            return pipeline.error("Failed to retrieve token from the upstream service.")

        # we can either expect the API to be implicit and say "im looking for
        # blah within state data" or we need to pass implementation + call a
        # hook here
        pipeline.bind_state("data", data)

        return pipeline.next_step()
