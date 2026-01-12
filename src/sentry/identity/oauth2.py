from __future__ import annotations

import logging
import secrets
from time import time
from typing import Any
from urllib.parse import parse_qsl, urlencode

import orjson
import sentry_sdk
from django.http import HttpResponseRedirect
from django.http.request import HttpRequest
from django.http.response import HttpResponseBase
from django.urls import reverse
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from requests import Response
from requests.exceptions import HTTPError, SSLError

from sentry.auth.exceptions import IdentityNotValid
from sentry.exceptions import NotRegistered
from sentry.http import safe_urlopen, safe_urlread
from sentry.identity.pipeline import IdentityPipeline
from sentry.identity.services.identity import identity_service
from sentry.identity.services.identity.model import RpcIdentity
from sentry.integrations.base import IntegrationDomain
from sentry.integrations.utils.metrics import (
    IntegrationPipelineErrorReason,
    IntegrationPipelineHaltReason,
    IntegrationPipelineViewEvent,
    IntegrationPipelineViewType,
)
from sentry.pipeline.views.base import PipelineView
from sentry.shared_integrations.exceptions import ApiError, ApiInvalidRequestError, ApiUnauthorized
from sentry.users.models.identity import Identity
from sentry.utils.http import absolute_uri

from .base import Provider

__all__ = ["OAuth2Provider", "OAuth2CallbackView", "OAuth2LoginView"]

logger = logging.getLogger(__name__)
ERR_INVALID_STATE = "An error occurred while validating your request."
ERR_TOKEN_RETRIEVAL = "Failed to retrieve token from the upstream service."


def _redirect_url(pipeline: IdentityPipeline) -> str:
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

    def get_pipeline_views(self) -> list[PipelineView[IdentityPipeline]]:
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

    def get_refresh_token_params(
        self, refresh_token: str, identity: Identity | RpcIdentity, **kwargs: Any
    ) -> dict[str, str | None]:
        raise NotImplementedError

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

    def get_refresh_token(
        self, refresh_token, url: str, identity: Identity | RpcIdentity, **kwargs: Any
    ) -> Response:
        data = self.get_refresh_token_params(refresh_token, identity, **kwargs)

        try:
            req = safe_urlopen(
                url=url,
                headers=self.get_refresh_token_headers(),
                data=data,
                verify_ssl=kwargs.get("verify_ssl", True),
            )
            req.raise_for_status()
        except HTTPError as e:
            error_resp = e.response
            exc = ApiError.from_response(error_resp, url=url)
            if isinstance(exc, ApiUnauthorized) or isinstance(exc, ApiInvalidRequestError):
                raise IdentityNotValid from e
            raise exc from e

        return req

    def refresh_identity(self, identity: Identity | RpcIdentity, **kwargs: Any) -> None:
        refresh_token = identity.data.get("refresh_token")

        if not refresh_token:
            raise IdentityNotValid("Missing refresh token")

        req = self.get_refresh_token(
            refresh_token=refresh_token,
            url=self.get_refresh_token_url(),
            identity=identity,
            **kwargs,
        )

        try:
            body = safe_urlread(req)
            payload = orjson.loads(body)
        except orjson.JSONDecodeError:
            payload = {}

        identity.data.update(self.get_oauth_data(payload))
        identity_service.update_data(identity_id=identity.id, data=identity.data)


def record_event(event: IntegrationPipelineViewType, provider: str):
    from sentry.identity import default_manager as identity_manager

    try:
        identity_manager.get(provider)
    except NotRegistered:
        logger.exception("oauth2.record_event.invalid_provider", extra={"provider": provider})

    return IntegrationPipelineViewEvent(
        event, domain=IntegrationDomain.IDENTITY, provider_key=provider
    )


class OAuth2LoginView:
    authorize_url: str | None = None
    client_id: str | None = None
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
    def dispatch(self, request: HttpRequest, pipeline: IdentityPipeline) -> HttpResponseBase:
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


class OAuth2CallbackView:
    access_token_url: str | None = None
    client_id: str | None = None
    client_secret: str | None = None

    def __init__(self, access_token_url=None, client_id=None, client_secret=None, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if access_token_url is not None:
            self.access_token_url = access_token_url
        if client_id is not None:
            self.client_id = client_id
        if client_secret is not None:
            self.client_secret = client_secret

    def get_token_params(self, code: str, redirect_uri: str) -> dict[str, str | None]:
        return {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

    def get_access_token(self, pipeline: IdentityPipeline, code: str) -> Response:
        data = self.get_token_params(code=code, redirect_uri=absolute_uri(_redirect_url(pipeline)))
        verify_ssl = pipeline.config.get("verify_ssl", True)
        return safe_urlopen(self.access_token_url, data=data, verify_ssl=verify_ssl)

    def exchange_token(
        self, request: HttpRequest, pipeline: IdentityPipeline, code: str
    ) -> dict[str, str]:
        with record_event(
            IntegrationPipelineViewType.TOKEN_EXCHANGE, pipeline.provider.key
        ).capture() as lifecycle:
            try:
                req: Response = self.get_access_token(pipeline, code)
                req.raise_for_status()
            except HTTPError as e:
                error_resp = e.response
                exc = ApiError.from_response(error_resp, url=self.access_token_url)
                sentry_sdk.capture_exception(exc)
                lifecycle.record_failure(exc)
                return {
                    "error": f"Could not retrieve access token. Received {exc.code}: {exc.text}",
                }
            except SSLError:
                lifecycle.record_failure(
                    "ssl_error",
                    {
                        "verify_ssl": pipeline.config.get("verify_ssl", True),
                        "url": self.access_token_url,
                    },
                )
                url = self.access_token_url
                return {
                    "error": "Could not verify SSL certificate",
                    "error_description": f"Ensure that {url} has a valid SSL certificate",
                }
            except ConnectionError:
                url = self.access_token_url
                lifecycle.record_failure("connection_error", {"url": url})
                return {
                    "error": "Could not connect to host or service",
                    "error_description": f"Ensure that {url} is open to connections",
                }

            try:
                body = safe_urlread(req)
                content_type = req.headers.get("Content-Type", "").lower()
                if content_type.startswith("application/x-www-form-urlencoded"):
                    return dict(parse_qsl(body))
                return orjson.loads(body)
            except orjson.JSONDecodeError:
                lifecycle.record_failure(
                    "json_error",
                    {
                        "content_type": content_type,
                        "url": self.access_token_url,
                        "status_code": req.status_code,
                    },
                )
                return {
                    "error": "Could not decode a JSON Response",
                    "error_description": "We were not able to parse a JSON response, please try again.",
                }

    def dispatch(self, request: HttpRequest, pipeline: IdentityPipeline) -> HttpResponseBase:
        with record_event(
            IntegrationPipelineViewType.OAUTH_CALLBACK, pipeline.provider.key
        ).capture() as lifecycle:
            error = request.GET.get("error")
            state = request.GET.get("state")
            code = request.GET.get("code")

            if error:
                # Sanitize error parameter to prevent injection of malicious content
                # Only log the original error for debugging, but show a safe generic message to users
                lifecycle.record_failure(
                    IntegrationPipelineErrorReason.TOKEN_EXCHANGE_MISMATCHED_STATE,
                    extra={"error": error},
                )
                # Log the raw error for debugging but don't display it to users
                logger.warning(
                    "OAuth callback received error parameter",
                    extra={
                        "provider": pipeline.provider.key,
                        "error": error,
                    },
                )
                return pipeline.error(ERR_INVALID_STATE)

            if state != pipeline.fetch_state("state"):
                extra = {
                    "error": "invalid_state",
                    "state": state,
                    "pipeline_state": pipeline.fetch_state("state"),
                    "code": code,
                }
                lifecycle.record_failure(
                    IntegrationPipelineErrorReason.TOKEN_EXCHANGE_MISMATCHED_STATE, extra=extra
                )
                return pipeline.error(ERR_INVALID_STATE)

            if code is None:
                lifecycle.record_halt(IntegrationPipelineHaltReason.NO_CODE_PROVIDED)
                return pipeline.error("no code was provided")

        # separate lifecycle event inside exchange_token
        data = self.exchange_token(request, pipeline, code)

        # these errors are based off of the results of exchange_token, lifecycle errors are captured inside
        if "error_description" in data:
            # error_description could come from:
            # 1. Our internal code (safe, specific patterns)
            # 2. OAuth provider's token endpoint response (untrusted)
            error = data.get("error")
            
            # Check if this is an internally generated error_description (safe to display)
            # Our internal errors have these specific patterns
            internal_error_patterns = (
                "Ensure that ",
                "We were not able to",
                "Could not ",
            )
            is_internal_error = any(
                data["error_description"].startswith(pattern) 
                for pattern in internal_error_patterns
            )
            
            if is_internal_error:
                # Safe to display - this is an error we generated
                return pipeline.error(data["error_description"])
            else:
                # This came from the OAuth provider - log but don't display
                logger.warning(
                    "Token exchange returned external error_description",
                    extra={
                        "provider": pipeline.provider.key,
                        "error": error,
                        "error_description": data["error_description"],
                    },
                )
                return pipeline.error(ERR_TOKEN_RETRIEVAL)

        if "error" in data:
            # error could come from:
            # 1. Our internal code (safe, specific patterns)
            # 2. OAuth provider's token endpoint response (untrusted)
            
            # Check if this is an internally generated error (safe to display)
            # Our internal errors start with "Could not "
            if data["error"].startswith("Could not "):
                return pipeline.error(data["error"])
            else:
                # This came from the OAuth provider - log but don't display
                logger.info(
                    "identity.token-exchange-error",
                    extra={
                        "provider": pipeline.provider.key,
                        "error": data["error"],
                    },
                )
                return pipeline.error(ERR_TOKEN_RETRIEVAL)

        # we can either expect the API to be implicit and say "im looking for
        # blah within state data" or we need to pass implementation + call a
        # hook here
        pipeline.bind_state("data", data)

        return pipeline.next_step()
