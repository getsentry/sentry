"""
Base backends structures.

This module defines base classes needed to define custom OpenID or OAuth
auth services from third parties. This customs must subclass an Auth and
and Backend class, check current implementation for examples.

Also the modules *must* define a BACKENDS dictionary with the backend name
(which is used for URLs matching) and Auth class, otherwise it won't be
enabled.
"""
from __future__ import absolute_import

import logging
import requests
import six
import threading

from requests_oauthlib import OAuth1
from django.contrib.auth import authenticate
from django.utils.crypto import get_random_string, constant_time_compare
from six.moves.urllib.error import HTTPError
from six.moves.urllib.request import Request
from six.moves.urllib.parse import urlencode
from social_auth.models import UserSocialAuth
from social_auth.utils import (
    setting,
    model_to_ctype,
    ctype_to_model,
    clean_partial_pipeline,
    url_add_parameters,
    dsa_urlopen,
    parse_qs,
)
from social_auth.exceptions import (
    StopPipeline,
    AuthFailed,
    AuthCanceled,
    AuthUnknownError,
    AuthTokenError,
    AuthMissingParameter,
    AuthStateMissing,
    AuthStateForbidden,
    BackendError,
)

from sentry.utils import json
from sentry.utils.compat import map

PIPELINE = setting(
    "SOCIAL_AUTH_PIPELINE",
    (
        "social_auth.backends.pipeline.social.social_auth_user",
        # Removed by default since it can be a dangerous behavior that
        # could lead to accounts take over.
        # 'social_auth.backends.pipeline.associate.associate_by_email',
        "social_auth.backends.pipeline.user.get_username",
        "social_auth.backends.pipeline.user.create_user",
        "social_auth.backends.pipeline.social.associate_user",
        "social_auth.backends.pipeline.social.load_extra_data",
        "social_auth.backends.pipeline.user.update_user_details",
    ),
)

logger = logging.getLogger("social_auth")


class SocialAuthBackend(object):
    """A django.contrib.auth backend that authenticates the user based on
    a authentication provider response"""

    name = ""  # provider name, it's stored in database
    supports_inactive_user = False

    def authenticate(self, request, *args, **kwargs):
        """Authenticate user using social credentials

        Authentication is made if this is the correct backend, backend
        verification is made by kwargs inspection for current backend
        name presence.
        """
        # Validate backend and arguments. Require that the Social Auth
        # response be passed in as a keyword argument, to make sure we
        # don't match the username/password calling conventions of
        # authenticate.
        if not (self.name and kwargs.get(self.name) and "response" in kwargs):
            return None

        response = kwargs.get("response")
        pipeline = PIPELINE
        kwargs = kwargs.copy()
        kwargs["backend"] = self

        if "pipeline_index" in kwargs:
            pipeline = pipeline[kwargs["pipeline_index"] :]
        else:
            kwargs["details"] = self.get_user_details(response)
            kwargs["uid"] = self.get_user_id(kwargs["details"], response)
            kwargs["is_new"] = False

        out = self.pipeline(pipeline, request, *args, **kwargs)
        if not isinstance(out, dict):
            return out

        social_user = out.get("social_user")
        if social_user:
            # define user.social_user attribute to track current social
            # account
            user = social_user.user
            user.social_user = social_user
            user.is_new = out.get("is_new")
            return user

    def pipeline(self, pipeline, request, *args, **kwargs):
        """Pipeline"""
        out = kwargs.copy()

        if "pipeline_index" in kwargs:
            base_index = int(kwargs["pipeline_index"])
        else:
            base_index = 0

        for idx, name in enumerate(pipeline):
            out["pipeline_index"] = base_index + idx
            mod_name, func_name = name.rsplit(".", 1)
            mod = __import__(mod_name, {}, {}, [func_name])
            func = getattr(mod, func_name, None)

            try:
                result = {}
                if func_name == "save_status_to_session":
                    result = func(request, *args, **out) or {}
                else:
                    result = func(*args, **out) or {}
            except StopPipeline:
                # Clean partial pipeline on stop
                if "request" in kwargs:
                    clean_partial_pipeline(kwargs["request"])
                break

            if isinstance(result, dict):
                out.update(result)
            else:
                return result

        # clean the partial pipeline at the end of the process
        if "request" in kwargs:
            clean_partial_pipeline(kwargs["request"])
        return out

    def extra_data(self, user, uid, response, details):
        """Return default blank user extra data"""
        return {}

    def get_user_id(self, details, response):
        """Must return a unique ID from values returned on details"""
        raise NotImplementedError("Implement in subclass")

    def get_user_details(self, response):
        """Must return user details in a know internal struct:
        {'username': <username if any>,
         'email': <user email if any>,
         'fullname': <user full name if any>,
         'first_name': <user first name if any>,
         'last_name': <user last name if any>}
        """
        raise NotImplementedError("Implement in subclass")

    @classmethod
    def tokens(cls, instance):
        """Return the tokens needed to authenticate the access to any API the
        service might provide. The return value will be a dictionary with the
        token type name as key and the token value.

        instance must be a UserSocialAuth instance.
        """
        if instance.extra_data and "access_token" in instance.extra_data:
            return {"access_token": instance.extra_data["access_token"]}
        else:
            return {}

    def get_user(self, user_id):
        """
        Return user with given ID from the User model used by this backend.
        This is called by django.contrib.auth.middleware.
        """
        return UserSocialAuth.get_user(user_id)


class OAuthBackend(SocialAuthBackend):
    """OAuth authentication backend base class.

    EXTRA_DATA defines a set of name that will be stored in
               extra_data field. It must be a list of tuples with
               name and alias.

    Also settings will be inspected to get more values names that should be
    stored on extra_data field. Setting name is created from current backend
    name (all uppercase) plus _EXTRA_DATA.

    access_token is always stored.
    """

    EXTRA_DATA = None
    ID_KEY = "id"

    def get_user_id(self, details, response):
        """OAuth providers return an unique user id in response"""
        return response[self.ID_KEY]

    @classmethod
    def extra_data(cls, user, uid, response, details=None):
        """Return access_token and extra defined names to store in
        extra_data field"""
        data = {"access_token": response.get("access_token", "")}
        name = cls.name.replace("-", "_").upper()
        names = (cls.EXTRA_DATA or []) + setting(name + "_EXTRA_DATA", [])

        for entry in names:
            if isinstance(entry, six.string_types):
                entry = (entry,)

            try:
                if len(entry) == 3:
                    name, alias, discard = entry
                elif len(entry) == 2:
                    (name, alias), discard = entry, False
                elif len(entry) == 1:
                    (name,), (alias,), discard = entry, entry, False
                else:
                    raise ValueError("invalid tuple for EXTRA_DATA entry" % entry)

                value = response.get(name)
                if discard and not value:
                    continue
                data[alias] = value

            except (TypeError, ValueError):
                raise BackendError("invalid entry: %s" % (entry,))

        return data


class BaseAuth(object):
    """Base authentication class, new authenticators should subclass
    and implement needed methods.

        AUTH_BACKEND   Authorization backend related with this service
    """

    AUTH_BACKEND = None

    def __init__(self, request, redirect):
        self.request = request
        # TODO(python3): use {**x, **y} syntax once 2.7 support is dropped
        data = request.GET.copy()
        data.update(request.POST)
        self.data = data
        self.redirect = redirect

    def auth_url(self):
        """Must return redirect URL to auth provider"""
        raise NotImplementedError("Implement in subclass")

    def auth_html(self):
        """Must return login HTML content returned by provider"""
        raise NotImplementedError("Implement in subclass")

    def auth_complete(self, *args, **kwargs):
        """Completes logging process, must return user instance"""
        raise NotImplementedError("Implement in subclass")

    def to_session_dict(self, next_idx, *args, **kwargs):
        """Returns dict to store on session for partial pipeline."""
        return {
            "next": next_idx,
            "backend": self.AUTH_BACKEND.name,
            "args": tuple(map(model_to_ctype, args)),
            "kwargs": dict((key, model_to_ctype(val)) for key, val in six.iteritems(kwargs)),
        }

    def from_session_dict(self, session_data, *args, **kwargs):
        """Takes session saved data to continue pipeline and merges with any
        new extra argument needed. Returns tuple with next pipeline index
        entry, arguments and keyword arguments to continue the process."""
        args = args[:] + tuple(map(ctype_to_model, session_data["args"]))

        kwargs = kwargs.copy()
        saved_kwargs = dict(
            (key, ctype_to_model(val)) for key, val in six.iteritems(session_data["kwargs"])
        )
        saved_kwargs.update((key, val) for key, val in six.iteritems(kwargs))
        return (session_data["next"], args, saved_kwargs)

    def continue_pipeline(self, *args, **kwargs):
        """Continue previous halted pipeline"""
        kwargs.update({"auth": self, self.AUTH_BACKEND.name: True})
        return authenticate(*args, **kwargs)

    def request_token_extra_arguments(self):
        """Return extra arguments needed on request-token process,
        setting is per backend and defined by:
            <backend name in uppercase>_REQUEST_TOKEN_EXTRA_ARGUMENTS.
        """
        backend_name = self.AUTH_BACKEND.name.upper().replace("-", "_")
        return setting(backend_name + "_REQUEST_TOKEN_EXTRA_ARGUMENTS", {})

    def auth_extra_arguments(self):
        """Return extra arguments needed on auth process, setting is per
        backend and defined by:
            <backend name in uppercase>_AUTH_EXTRA_ARGUMENTS.
        The defaults can be overridden by GET parameters.
        """
        backend_name = self.AUTH_BACKEND.name.upper().replace("-", "_")
        extra_arguments = setting(backend_name + "_AUTH_EXTRA_ARGUMENTS", {})
        for key, value in six.iteritems(extra_arguments):
            if key in self.data:
                extra_arguments[key] = self.data[key]
            elif value:
                extra_arguments[key] = value
        return extra_arguments

    @property
    def uses_redirect(self):
        """Return True if this provider uses redirect url method,
        otherwise return false."""
        return True

    @classmethod
    def enabled(cls):
        """Return backend enabled status, all enabled by default"""
        return True

    def disconnect(self, user, association_id=None):
        """Deletes current backend from user if associated.
        Override if extra operations are needed.
        """
        name = self.AUTH_BACKEND.name
        do_revoke = setting("SOCIAL_AUTH_REVOKE_TOKENS_ON_DISCONNECT")
        filter_args = {}

        if association_id:
            filter_args["id"] = association_id
        else:
            filter_args["provider"] = name
        instances = UserSocialAuth.get_social_auth_for_user(user).filter(**filter_args)

        if do_revoke:
            for instance in instances:
                instance.revoke_token(drop_token=False)
        instances.delete()

    def build_absolute_uri(self, path=None):
        """Build absolute URI for given path. Replace http:// schema with
        https:// if SOCIAL_AUTH_REDIRECT_IS_HTTPS is defined.
        """
        uri = self.request.build_absolute_uri(path)
        if setting("SOCIAL_AUTH_REDIRECT_IS_HTTPS"):
            uri = uri.replace("http://", "https://")
        return uri


class OAuthAuth(BaseAuth):
    """OAuth base class"""

    SETTINGS_KEY_NAME = ""
    SETTINGS_SECRET_NAME = ""
    SCOPE_VAR_NAME = None
    SCOPE_PARAMETER_NAME = "scope"
    DEFAULT_SCOPE = None
    SCOPE_SEPARATOR = " "

    def __init__(self, request, redirect):
        """Init method"""
        super(OAuthAuth, self).__init__(request, redirect)
        self.redirect_uri = self.build_absolute_uri(self.redirect)

    @classmethod
    def get_key_and_secret(cls):
        """Return tuple with Consumer Key and Consumer Secret for current
        service provider. Must return (key, secret), order *must* be respected.
        """
        return (setting(cls.SETTINGS_KEY_NAME), setting(cls.SETTINGS_SECRET_NAME))

    @classmethod
    def enabled(cls):
        """Return backend enabled status by checking basic settings"""
        return bool(setting(cls.SETTINGS_KEY_NAME) and setting(cls.SETTINGS_SECRET_NAME))

    def get_scope(self):
        """Return list with needed access scope"""
        scope = self.DEFAULT_SCOPE or []
        if self.SCOPE_VAR_NAME:
            scope = scope + setting(self.SCOPE_VAR_NAME, [])
        return scope

    def get_scope_argument(self):
        param = {}
        scope = self.get_scope()
        if scope:
            param[self.SCOPE_PARAMETER_NAME] = self.SCOPE_SEPARATOR.join(scope)
        return param

    def user_data(self, access_token, *args, **kwargs):
        """Loads user data from service. Implement in subclass"""
        return {}


class BaseOAuth1(OAuthAuth):
    """Consumer based mechanism OAuth authentication, fill the needed
    parameters to communicate properly with authentication service.

        AUTHORIZATION_URL       Authorization service url
        REQUEST_TOKEN_URL       Request token URL
        ACCESS_TOKEN_URL        Access token URL
    """

    AUTHORIZATION_URL = ""
    REQUEST_TOKEN_URL = ""
    ACCESS_TOKEN_URL = ""

    def auth_url(self):
        """Return redirect url"""
        token = self.unauthorized_token()
        name = self.AUTH_BACKEND.name + "unauthorized_token_name"
        if not isinstance(self.request.session.get(name), list):
            self.request.session[name] = []
        self.request.session[name].append(token.to_string())
        self.request.session.modified = True
        return self.oauth_authorization_request(token)

    def auth_complete(self, *args, **kwargs):
        """Return user, might be logged in"""
        # Multiple unauthorized tokens are supported (see #521)
        name = self.AUTH_BACKEND.name + "unauthorized_token_name"
        token = None
        unauthed_tokens = self.request.session.get(name) or []
        if not unauthed_tokens:
            raise AuthTokenError(self, "Missing unauthorized token")
        for unauthed_token in unauthed_tokens:
            token = unauthed_token
            if not isinstance(unauthed_token, dict):
                token = parse_qs(unauthed_token)
            if token.get("oauth_token") == self.data.get("oauth_token"):
                unauthed_tokens = list(set(unauthed_tokens) - set([unauthed_token]))
                self.request.session[name] = unauthed_tokens
                self.request.session.modified = True
                break
        else:
            raise AuthTokenError(self, "Incorrect tokens")

        try:
            access_token = self.access_token(token)
        except HTTPError as e:
            if e.code == 400:
                raise AuthCanceled(self)
            else:
                raise
        return self.do_auth(access_token, *args, **kwargs)

    def do_auth(self, access_token, *args, **kwargs):
        """Finish the auth process once the access_token was retrieved"""
        data = self.user_data(access_token)
        if data is not None:
            data["access_token"] = access_token.to_string()

        kwargs.update({"auth": self, "response": data, self.AUTH_BACKEND.name: True})
        return authenticate(*args, **kwargs)

    def unauthorized_token(self):
        """Return request for unauthorized token (first stage)"""
        params = self.request_token_extra_arguments()
        params.update(self.get_scope_argument())
        key, secret = self.get_key_and_secret()
        response = self.request(
            url=self.REQUEST_TOKEN_URL,
            params=params,
            auth=OAuth1(key, secret, callback_uri=self.redirect_uri),
        )
        return response.content

    def oauth_authorization_request(self, token):
        """Generate OAuth request to authorize token."""
        if not isinstance(token, dict):
            token = parse_qs(token)
        params = self.auth_extra_arguments() or {}
        params.update(self.get_scope_argument())
        params["oauth_token"] = token.get("oauth_token")
        params["redirect_uri"] = self.redirect_uri
        return self.AUTHORIZATION_URL + "?" + urlencode(params)

    def oauth_auth(self, token=None, oauth_verifier=None):
        key, secret = self.get_key_and_secret()
        oauth_verifier = oauth_verifier or self.data.get("oauth_verifier")
        token = token or {}
        return OAuth1(
            key,
            secret,
            resource_owner_key=token.get("oauth_token"),
            resource_owner_secret=token.get("oauth_token_secret"),
            callback_uri=self.redirect_uri,
            verifier=oauth_verifier,
        )

    def oauth_request(self, token, url, extra_params=None, method="GET"):
        """Generate OAuth request, setups callback url"""
        return self.request(url, auth=self.oauth_auth(token))

    def fetch_response(self, request):
        """Executes request and fetches service response"""
        response = dsa_urlopen(request.to_url())
        return "\n".join(response.readlines())

    def access_token(self, token):
        """Return request for access token value"""
        return self.get_querystring(self.ACCESS_TOKEN_URL, auth=self.oauth_auth(token))


class BaseOAuth2(OAuthAuth):
    """Base class for OAuth2 providers.

    OAuth2 draft details at:
        http://tools.ietf.org/html/draft-ietf-oauth-v2-10

    Attributes:
        AUTHORIZATION_URL       Authorization service url
        ACCESS_TOKEN_URL        Token URL
    """

    AUTHORIZATION_URL = None
    ACCESS_TOKEN_URL = None
    REFRESH_TOKEN_URL = None
    REVOKE_TOKEN_URL = None
    REVOKE_TOKEN_METHOD = "POST"
    RESPONSE_TYPE = "code"
    REDIRECT_STATE = True
    STATE_PARAMETER = True

    def state_token(self):
        """Generate csrf token to include as state parameter."""
        return get_random_string(32)

    def get_redirect_uri(self, state=None):
        """Build redirect_uri with redirect_state parameter."""
        uri = self.redirect_uri
        if self.REDIRECT_STATE and state:
            uri = url_add_parameters(uri, {"redirect_state": state})
        return uri

    def auth_params(self, state=None):
        client_id, client_secret = self.get_key_and_secret()
        params = {"client_id": client_id, "redirect_uri": self.get_redirect_uri(state)}
        if self.STATE_PARAMETER and state:
            params["state"] = state
        if self.RESPONSE_TYPE:
            params["response_type"] = self.RESPONSE_TYPE
        return params

    def auth_url(self):
        """Return redirect url"""
        if self.STATE_PARAMETER or self.REDIRECT_STATE:
            # Store state in session for further request validation. The state
            # value is passed as state parameter (as specified in OAuth2 spec),
            # but also added to redirect_uri, that way we can still verify the
            # request if the provider doesn't implement the state parameter.
            # Reuse token if any.
            name = self.AUTH_BACKEND.name + "_state"
            state = self.request.session.get(name) or self.state_token()
            self.request.session[self.AUTH_BACKEND.name + "_state"] = state
        else:
            state = None

        params = self.auth_params(state)
        params.update(self.get_scope_argument())
        params.update(self.auth_extra_arguments())

        if self.request.META.get("QUERY_STRING"):
            query_string = "&" + self.request.META["QUERY_STRING"]
        else:
            query_string = ""
        return self.AUTHORIZATION_URL + "?" + urlencode(params) + query_string

    def validate_state(self):
        """Validate state value. Raises exception on error, returns state
        value if valid."""
        if not self.STATE_PARAMETER and not self.REDIRECT_STATE:
            return None
        state = self.request.session.get(self.AUTH_BACKEND.name + "_state")
        if state:
            request_state = self.data.get("state") or self.data.get("redirect_state")
            if not request_state:
                raise AuthMissingParameter(self, "state")
            elif not state:
                raise AuthStateMissing(self, "state")
            elif not constant_time_compare(request_state, state):
                raise AuthStateForbidden(self)
        return state

    def process_error(self, data):
        error = data.get("error_description") or data.get("error")
        if error:
            raise AuthFailed(self, error)

    def auth_complete_params(self, state=None):
        client_id, client_secret = self.get_key_and_secret()
        return {
            "grant_type": "authorization_code",  # request auth code
            "code": self.data.get("code", ""),  # server response code
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": self.get_redirect_uri(state),
        }

    @classmethod
    def auth_headers(cls):
        return {"Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"}

    def auth_complete(self, *args, **kwargs):
        """Completes logging process, must return user instance"""
        self.process_error(self.data)
        params = self.auth_complete_params(self.validate_state())
        request = Request(
            self.ACCESS_TOKEN_URL,
            data=urlencode(params).encode("utf-8"),
            headers=self.auth_headers(),
        )

        try:
            response = json.loads(dsa_urlopen(request).read())
        except HTTPError as e:
            logger.exception(
                "plugins.auth.error",
                extra={"class": type(self), "status_code": e.code, "response": e.read()[:128]},
            )
            raise AuthUnknownError(self)
        except (ValueError, KeyError):
            raise AuthUnknownError(self)

        self.process_error(response)
        return self.do_auth(response["access_token"], response=response, *args, **kwargs)

    @classmethod
    def refresh_token_params(cls, token, provider):
        client_id, client_secret = cls.get_key_and_secret()
        return {
            "refresh_token": token,
            "grant_type": "refresh_token",
            "client_id": client_id,
            "client_secret": client_secret,
        }

    @classmethod
    def refresh_token(cls, token, provider):
        params = cls.refresh_token_params(token, provider)
        response = requests.post(
            cls.REFRESH_TOKEN_URL or cls.ACCESS_TOKEN_URL, data=params, headers=cls.auth_headers()
        )
        response.raise_for_status()
        return response.json()

    @classmethod
    def revoke_token_params(cls, token, uid):
        return None

    @classmethod
    def revoke_token_headers(cls, token, uid):
        return None

    @classmethod
    def process_revoke_token_response(cls, response):
        return response.code == 200

    @classmethod
    def revoke_token(cls, token, uid):
        if not cls.REVOKE_TOKEN_URL:
            return
        url = cls.REVOKE_TOKEN_URL.format(token=token, uid=uid)
        params = cls.revoke_token_params(token, uid) or {}
        headers = cls.revoke_token_headers(token, uid) or {}
        data = None

        if cls.REVOKE_TOKEN_METHOD == "GET":
            url = u"{}?{}".format(url, urlencode(params))
        else:
            data = urlencode(params)

        request = Request(url, data=data, headers=headers)
        if cls.REVOKE_TOKEN_URL.lower() not in ("get", "post"):
            # Patch get_method to return the needed method
            request.get_method = lambda: cls.REVOKE_TOKEN_METHOD
        response = dsa_urlopen(request)
        return cls.process_revoke_token_response(response)

    def do_auth(self, access_token, *args, **kwargs):
        """Finish the auth process once the access_token was retrieved"""
        data = self.user_data(access_token, *args, **kwargs)
        response = kwargs.get("response") or {}
        response.update(data or {})
        kwargs.update({"auth": self, "response": response, self.AUTH_BACKEND.name: True})
        return authenticate(*args, **kwargs)


# Cache for discovered backends.
BACKENDSCACHE = {}

_import_lock = threading.Lock()


def get_backends(force_load=False):
    """
    Entry point to the BACKENDS cache. If BACKENDSCACHE hasn't been
    populated, each of the modules referenced in
    AUTHENTICATION_BACKENDS is imported and checked for a BACKENDS
    definition and if enabled, added to the cache.

    Previously all backends were attempted to be loaded at
    import time of this module, which meant that backends that subclass
    bases found in this module would not have the chance to be loaded
    by the time they were added to this module's BACKENDS dict. See:
    https://github.com/omab/django-social-auth/issues/204

    This new approach ensures that backends are allowed to subclass from
    bases in this module and still be picked up.

    A force_load boolean arg is also provided so that get_backend
    below can retry a requested backend that may not yet be discovered.
    """
    global BACKENDSCACHE

    if not BACKENDSCACHE or force_load:
        with _import_lock:
            for auth_backend in setting("AUTHENTICATION_BACKENDS"):
                mod, cls_name = auth_backend.rsplit(".", 1)
                module = __import__(mod, {}, {}, ["BACKENDS", cls_name])
                backend = getattr(module, cls_name)

                if issubclass(backend, SocialAuthBackend):
                    name = backend.name
                    backends = getattr(module, "BACKENDS", {})
                    if name in backends and backends[name].enabled():
                        BACKENDSCACHE[name] = backends[name]
    return BACKENDSCACHE


def get_backend(name, *args, **kwargs):
    get_backends()

    try:
        # Cached backend which has previously been discovered.
        backend_cls = BACKENDSCACHE[name]
    except KeyError:
        return None
    else:
        return backend_cls(*args, **kwargs)
