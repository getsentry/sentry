from __future__ import annotations

import logging
import secrets
from time import time
from urllib.parse import parse_qsl, urlencode

import orjson
from django.http import HttpResponse, HttpResponseRedirect
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from requests.exceptions import SSLError

from sentry.auth.exceptions import IdentityNotValid
from sentry.exceptions import NotRegistered
from sentry.http import safe_urlopen, safe_urlread
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.utils.metrics import (
    IntegrationPipelineViewEvent,
    IntegrationPipelineViewType,
)
from sentry.pipeline import Pipeline, PipelineView
from sentry.shared_integrations.exceptions import ApiError
from sentry.utils.http import absolute_uri

from .base import Provider

__all__ = ["OAuth2Provider", "OAuth2CallbackView", "OAuth2LoginView"]

logger = logging.getLogger(__name__)
ERR_INVALID_STATE = "An error occurred while validating your request."
ERR_TOKEN_RETRIEVAL = "Failed to retrieve token from the upstream service."


def _redirect_url(pipeline: Pipeline) -> str:
    associate_url = reverse(
        "sentry-extension-setup",
        kwargs={
            # TODO(adhiraj): Remove provider_id from the callback URL, it's unused.
            "provider_id": "default"
        },
    )

    # Use configured redirect_url if specified for the pipeline if available
    return pipeline.config.get("redirect_url", associate_url)


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

    oauth_scopes: tuple[str, ...] = ()

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
            prop = getattr(self, f"oauth_{parameter_name}")
            if prop != "":
                return prop
        except AttributeError:
            pass

        if self.config.get(parameter_name):
            return self.config.get(parameter_name)

        model = self.pipeline.provider_model
        if model and model.config.get(parameter_name) is not None:
            return model.config.get(parameter_name)

        raise KeyError(f'Unable to resolve OAuth parameter "{parameter_name}"')

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

    def get_pipeline_views(self) -> list[PipelineView]:
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

    def get_refresh_token_url(self) -> str:
        raise NotImplementedError

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

        formatted_error = f"HTTP {req.status_code} ({error_name}): {error_description}"

        if req.status_code == 401:
            logger.info(
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
                logger.info(
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
            logger.info(
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
            payload = orjson.loads(body)
        except orjson.JSONDecodeError:
            payload = {}

        self.handle_refresh_error(req, payload)

        identity.data.update(self.get_oauth_data(payload))
        return identity.update(data=identity.data)


from rest_framework.request import Request


def record_event(event: IntegrationPipelineViewType, provider: str):
    from sentry.identity import default_manager as identity_manager

    try:
        identity_manager.get(provider)
    except NotRegistered:
        logger.exception("oauth2.record_event.invalid_provider", extra={"provider": provider})

    return IntegrationPipelineViewEvent(
        event, domain=IntegrationDomain.IDENTITY, provider_key=provider
    )


class OAuth2LoginView(PipelineView):
    authorize_url = None
    client_id = None
    scope = ""

    def __init__(self, authorize_url=None, client_id=None, scope=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
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

    @method_decorator(csrf_exempt)
    def dispatch(self, request: Request, pipeline) -> HttpResponse:
        with record_event(IntegrationPipelineViewType.OAUTH_LOGIN, pipeline.provider.key).capture():
            for param in ("code", "error", "state"):
                if param in request.GET:
                    return pipeline.next_step()

            state = secrets.token_hex()

            params = self.get_authorize_params(
                state=state, redirect_uri=absolute_uri(_redirect_url(pipeline))
            )
            redirect_uri = f"{self.get_authorize_url()}?{urlencode(params)}"

            pipeline.bind_state("state", state)
            if request.subdomain:
                pipeline.bind_state("subdomain", request.subdomain)

            return HttpResponseRedirect(redirect_uri)


class OAuth2CallbackView(PipelineView):
    access_token_url = None
    client_id = None
    client_secret = None

    def __init__(self, access_token_url=None, client_id=None, client_secret=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
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

    def exchange_token(self, request: Request, pipeline, code):
        with record_event(
            IntegrationPipelineViewType.TOKEN_EXCHANGE, pipeline.provider.key
        ).capture() as lifecycle:
            # TODO: this needs the auth yet
            data = self.get_token_params(
                code=code, redirect_uri=absolute_uri(_redirect_url(pipeline))
            )
            verify_ssl = pipeline.config.get("verify_ssl", True)
            try:
                req = safe_urlopen(self.access_token_url, data=data, verify_ssl=verify_ssl)
                body = safe_urlread(req)
                if req.headers.get("Content-Type", "").startswith(
                    "application/x-www-form-urlencoded"
                ):
                    return dict(parse_qsl(body))
                return orjson.loads(body)
            except SSLError:
                logger.info(
                    "identity.oauth2.ssl-error",
                    extra={"url": self.access_token_url, "verify_ssl": verify_ssl},
                )
                lifecycle.record_failure("ssl_error")
                url = self.access_token_url
                return {
                    "error": "Could not verify SSL certificate",
                    "error_description": f"Ensure that {url} has a valid SSL certificate",
                }
            except ConnectionError:
                url = self.access_token_url
                logger.info("identity.oauth2.connection-error", extra={"url": url})
                lifecycle.record_failure("connection_error")
                return {
                    "error": "Could not connect to host or service",
                    "error_description": f"Ensure that {url} is open to connections",
                }
            except orjson.JSONDecodeError:
                logger.info("identity.oauth2.json-error", extra={"url": self.access_token_url})
                lifecycle.record_failure("json_error")
                return {
                    "error": "Could not decode a JSON Response",
                    "error_description": "We were not able to parse a JSON response, please try again.",
                }

    def dispatch(self, request: Request, pipeline) -> HttpResponse:
        with record_event(
            IntegrationPipelineViewType.OAUTH_CALLBACK, pipeline.provider.key
        ).capture() as lifecycle:
            error = request.GET.get("error")
            state = request.GET.get("state")
            code = request.GET.get("code")

            if error:
                logger.info("identity.token-exchange-error", extra={"error": error})
                lifecycle.record_failure(
                    "token_exchange_error", extra={"failure_info": ERR_INVALID_STATE}
                )
                return pipeline.error(f"{ERR_INVALID_STATE}\nError: {error}")

            if state != pipeline.fetch_state("state"):
                logger.info(
                    "identity.token-exchange-error",
                    extra={
                        "error": "invalid_state",
                        "state": state,
                        "pipeline_state": pipeline.fetch_state("state"),
                        "code": code,
                    },
                )
                lifecycle.record_failure(
                    "token_exchange_error", extra={"failure_info": ERR_INVALID_STATE}
                )
                return pipeline.error(ERR_INVALID_STATE)

        # separate lifecycle event inside exchange_token
        data = self.exchange_token(request, pipeline, code)

        # these errors are based off of the results of exchange_token, lifecycle errors are captured inside
        if "error_description" in data:
            error = data.get("error")
            return pipeline.error(data["error_description"])

        if "error" in data:
            logger.info("identity.token-exchange-error", extra={"error": data["error"]})
            return pipeline.error(f"{ERR_TOKEN_RETRIEVAL}\nError: {data['error']}")

        # we can either expect the API to be implicit and say "im looking for
        # blah within state data" or we need to pass implementation + call a
        # hook here
        pipeline.bind_state("data", data)

        return pipeline.next_step()
