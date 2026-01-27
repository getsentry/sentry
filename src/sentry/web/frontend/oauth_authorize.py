from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from django.conf import settings
from django.db import IntegrityError, router, transaction
from django.http import HttpRequest, HttpResponse
from django.http.response import HttpResponseBase
from django.utils import timezone
from django.utils.safestring import mark_safe

from sentry import features
from sentry.models.apiapplication import ApiApplication, ApiApplicationStatus
from sentry.models.apiauthorization import ApiAuthorization
from sentry.models.apigrant import ApiGrant
from sentry.models.apitoken import ApiToken
from sentry.oauth.cimd import CIMDClient, CIMDError
from sentry.users.models.user import User
from sentry.users.services.user.service import user_service
from sentry.utils import metrics
from sentry.web.frontend.auth_login import AuthLoginView

logger = logging.getLogger("sentry.oauth")


@dataclass
class CIMDClientInfo:
    """
    Represents a CIMD (Client ID Metadata Document) client for OAuth authorization.

    This is a transient representation of a client whose metadata is fetched
    from the client_id URL. Unlike ApiApplication, CIMD clients are not stored
    in the database but validated on-the-fly from their metadata document.
    """

    client_id: str  # The URL-based client_id
    client_name: str
    redirect_uris: list[str]
    client_uri: str | None = None
    logo_uri: str | None = None
    contacts: list[str] | None = None

    @classmethod
    def from_metadata(cls, metadata: dict, client_id_url: str) -> CIMDClientInfo:
        """
        Create a CIMDClientInfo from a validated CIMD metadata document.

        Args:
            metadata: The validated CIMD metadata document.
            client_id_url: The URL from which the metadata was fetched.

        Returns:
            CIMDClientInfo instance with client details.
        """
        return cls(
            client_id=client_id_url,
            client_name=metadata.get("client_name", _extract_display_name(client_id_url)),
            redirect_uris=metadata.get("redirect_uris", []),
            client_uri=metadata.get("client_uri"),
            logo_uri=metadata.get("logo_uri"),
            contacts=metadata.get("contacts"),
        )

    @property
    def name(self) -> str:
        """Alias for client_name for compatibility with ApiApplication interface."""
        return self.client_name

    def is_valid_redirect_uri(self, value: str) -> bool:
        """
        Validate that a redirect_uri is valid for this CIMD client.

        Per RFC, redirect_uris in CIMD metadata must be matched exactly,
        with the exception of loopback addresses (RFC 8252 §7.3).
        """
        return is_valid_cimd_redirect_uri(value, self.redirect_uris)

    def get_redirect_uris(self) -> list[str]:
        """Return the list of registered redirect URIs."""
        return self.redirect_uris

    def get_default_redirect_uri(self) -> str | None:
        """Return the first registered redirect URI, or None if none registered."""
        return self.redirect_uris[0] if self.redirect_uris else None


def _extract_display_name(url: str) -> str:
    """Extract a display name from a URL (uses hostname as fallback)."""
    parsed = urlparse(url)
    return parsed.netloc or url


def is_valid_cimd_redirect_uri(value: str, registered_uris: list[str]) -> bool:
    """
    Validate that a redirect_uri is valid for a CIMD client.

    Per RFC 6749 §3.1.2.3, redirect_uris must be matched exactly with the
    exception of loopback addresses (RFC 8252 §7.3 and §8.4) which allow
    any ephemeral port.

    Args:
        value: The redirect_uri to validate.
        registered_uris: List of redirect_uris from the CIMD metadata.

    Returns:
        True if the redirect_uri is valid, False otherwise.
    """
    # Normalize the value
    try:
        v_parts = urlparse(value)
        # Normalize path
        normalized_path = v_parts.path or "/"
        value_normalized = urlunparse(v_parts._replace(path=normalized_path))
    except Exception:
        return False

    # First: exact match only (spec-compliant)
    for ruri in registered_uris:
        try:
            r_parts = urlparse(ruri)
            normalized_path = r_parts.path or "/"
            ruri_normalized = urlunparse(r_parts._replace(path=normalized_path))
        except Exception:
            continue

        if value_normalized == ruri_normalized:
            return True

    # RFC 8252 §8.4 / §7: For loopback interface redirects in native apps, accept
    # any ephemeral port when the registered URI omits a port. Match scheme, host,
    # path (and query) exactly, ignoring only the port.
    if v_parts.scheme in {"http", "https"} and v_parts.hostname in {
        "127.0.0.1",
        "localhost",
        "::1",
    }:
        for ruri in registered_uris:
            try:
                r_parts = urlparse(ruri)
            except Exception:
                continue
            if (
                r_parts.scheme in {"http", "https"}
                and r_parts.hostname in {"127.0.0.1", "localhost", "::1"}
                and r_parts.port is None  # registered without a fixed port
                and v_parts.scheme == r_parts.scheme
                and v_parts.hostname == r_parts.hostname
                and v_parts.path == r_parts.path
                and v_parts.query == r_parts.query
            ):
                return True

    return False


# RFC 7636 §4.2: code_challenge is 43-128 unreserved characters (same format as verifier)
# ABNF: code-challenge = 43*128unreserved
# unreserved = ALPHA / DIGIT / "-" / "." / "_" / "~"
CODE_CHALLENGE_REGEX = re.compile(r"^[A-Za-z0-9\-._~]{43,128}$")


def _build_permissions_list(scopes: list[str]) -> list[str]:
    """
    Build a list of human-readable permission descriptions from OAuth scopes.

    Maps scopes to their descriptions using SENTRY_SCOPE_SETS, ensuring
    that related scopes (e.g., org:read and org:write) show a single
    combined description rather than duplicates.
    """
    if not scopes:
        return []

    permissions = []
    pending_scopes = set(scopes)
    matched_sets: set = set()
    for scope_set in settings.SENTRY_SCOPE_SETS:
        for scope, description in scope_set:
            if scope_set in matched_sets and scope in pending_scopes:
                pending_scopes.remove(scope)
            elif scope in pending_scopes:
                permissions.append(description)
                matched_sets.add(scope_set)
                pending_scopes.remove(scope)

    if pending_scopes:
        raise NotImplementedError(f"{pending_scopes} scopes did not have descriptions")

    return permissions


def is_valid_cimd_url(client_id: str) -> bool:
    """
    Validate that a client_id is a valid CIMD URL per the draft RFC specification.

    CIMD URL requirements:
    - MUST be HTTPS scheme
    - MUST contain a path component (not just domain)
    - MUST NOT contain dot segments (. or ..)
    - MUST NOT contain fragment (#)
    - MUST NOT contain credentials (user:pass@)
    - Query strings are allowed but discouraged

    Returns True if valid CIMD URL, False otherwise.
    """
    try:
        parsed = urlparse(client_id)
    except Exception:
        return False

    # Must be HTTPS
    if parsed.scheme != "https":
        return False

    # Must have a netloc (domain)
    if not parsed.netloc:
        return False

    # Must NOT contain credentials (user:pass@)
    if parsed.username or parsed.password:
        return False

    # Must NOT contain fragment
    if parsed.fragment:
        return False

    # Must have a path component (not just "/")
    if not parsed.path or parsed.path == "/":
        return False

    # Must NOT contain dot segments (. or ..)
    path_segments = parsed.path.split("/")
    if "." in path_segments or ".." in path_segments:
        return False

    return True


def detect_cimd_client_id(
    client_id: str,
) -> tuple[Literal["cimd", "registered", "invalid"], str | None]:
    """
    Detect whether a client_id is a CIMD URL or a traditional registered client_id.

    Returns a tuple of (client_type, error_message):
    - ("cimd", None) - Valid CIMD URL
    - ("registered", None) - Traditional registered client_id (64-char hex)
    - ("invalid", error_message) - Invalid client_id format
    """
    # Check if it looks like a URL (starts with http:// or https://)
    if client_id.startswith("http://"):
        return ("invalid", "CIMD client_id must use HTTPS scheme")

    if client_id.startswith("https://"):
        if is_valid_cimd_url(client_id):
            return ("cimd", None)
        return ("invalid", "Invalid CIMD URL format")

    # Traditional client_id: should be a 64-character hex string
    # Allow it through for the existing flow to validate
    return ("registered", None)


class OAuthAuthorizeView(AuthLoginView):
    auth_required = False

    def get_next_uri(self, request: HttpRequest) -> str:
        return request.get_full_path()

    def redirect_response(self, response_type, redirect_uri, params):
        if response_type == "token":
            final_uri = "{}#{}".format(
                redirect_uri,
                urlencode([(k, v) for k, v in params.items() if v is not None]),
            )
        else:
            parts = list(urlparse(redirect_uri))
            query = parse_qsl(parts[4])
            for key, value in params.items():
                if value is not None:
                    query.append((key, value))
            parts[4] = urlencode(query)
            final_uri = urlunparse(parts)

        # Django's HttpResponseRedirect blocks custom URL schemes for security.
        # For OAuth redirects to Sentry Apple apps, we need to support the
        # sentry-apple:// scheme, so we use HttpResponse with a Location
        # header directly.
        parsed_uri = urlparse(final_uri)
        if parsed_uri.scheme == "sentry-apple":
            response = HttpResponse(status=302)
            response["Location"] = final_uri
            return response

        return self.redirect(final_uri)

    def error(
        self,
        request,
        response_type,
        redirect_uri,
        name,
        state=None,
        client_id=None,
        err_response=None,
    ):
        logger.error(
            "oauth.authorize-error",
            extra={
                "error_name": name,
                "response_type": response_type,
                "client_id": client_id,
                "redirect_uri": redirect_uri,
            },
        )
        if err_response:
            return self.respond(
                "sentry/oauth-error.html",
                {"error": mark_safe(f"Missing or invalid <em>{err_response}</em> parameter.")},
                status=400,
            )

        return self.redirect_response(response_type, redirect_uri, {"error": name, "state": state})

    def respond_login(self, request: HttpRequest, context, **kwargs):
        application = kwargs["application"]  # required argument
        context["banner"] = f"Connect Sentry to {application.name}"
        return self.respond("sentry/login.html", context)

    def get(self, request: HttpRequest, **kwargs) -> HttpResponseBase:
        response_type = request.GET.get("response_type")
        client_id = request.GET.get("client_id")
        redirect_uri = request.GET.get("redirect_uri")
        state = request.GET.get("state")
        force_prompt = request.GET.get("force_prompt")

        if not client_id:
            return self.error(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="unauthorized_client",
                err_response="client_id",
            )

        # Detect if client_id is a CIMD URL or a traditional registered client_id
        client_type, cimd_error = detect_cimd_client_id(client_id)

        if client_type == "invalid":
            logger.warning(
                "oauth.cimd.invalid-url",
                extra={
                    "client_id": client_id,
                    "error": cimd_error,
                },
            )
            return self.error(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="unauthorized_client",
                err_response="client_id",
            )

        if client_type == "cimd":
            # Check if CIMD is enabled via feature flag
            if not features.has("oauth:cimd-enabled"):
                logger.info(
                    "oauth.cimd.disabled",
                    extra={"client_id": client_id},
                )
                metrics.incr("oauth.cimd.authorization.disabled", sample_rate=1.0)
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="unauthorized_client",
                    err_response="client_id",
                )

            # CIMD flow: client_id is a URL where metadata can be fetched
            metrics.incr("oauth.cimd.authorization.attempt", sample_rate=1.0)
            return self._handle_cimd_authorization(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                state=state,
                force_prompt=force_prompt,
            )

        # Traditional registered client flow
        try:
            application = ApiApplication.objects.get(
                client_id=client_id, status=ApiApplicationStatus.active
            )
        except ApiApplication.DoesNotExist:
            return self.error(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="unauthorized_client",
                err_response="client_id",
            )

        # Spec references:
        #   - RFC 6749 §3.1.2.3 (Redirection Endpoint): redirect_uri must match a pre-registered value; if
        #     multiple redirect URIs are registered, the client MUST include redirect_uri in the request.
        #     https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.3
        #   - RFC 8252 §8.4 (Native Apps): loopback redirect considerations (ephemeral ports).
        #     https://datatracker.ietf.org/doc/html/rfc8252#section-8.4
        if not redirect_uri:
            # If multiple redirect URIs are registered, require the client to provide an
            # exact redirect_uri.
            # See RFC 6749 §3.1.2.3: https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2.3
            uris = application.get_redirect_uris()
            if len(uris) != 1:
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    err_response="redirect_uri",
                )
            redirect_uri = application.get_default_redirect_uri()
        elif not application.is_valid_redirect_uri(redirect_uri):
            return self.error(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="invalid_request",
                err_response="redirect_uri",
            )

        if not application.is_allowed_response_type(response_type):
            return self.error(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="unsupported_response_type",
                err_response="client_id",
            )

        scopes_s = request.GET.get("scope")
        if scopes_s:
            scopes = scopes_s.split(" ")
        else:
            scopes = []
        if application.requires_org_level_access:
            # Applications that require org level access have a maximum scope limit set
            # in admin that should not pass
            max_scopes = application.scopes
            for scope in scopes:
                if scope not in max_scopes:
                    return self.error(
                        request=request,
                        client_id=client_id,
                        response_type=response_type,
                        redirect_uri=redirect_uri,
                        name="invalid_scope",
                        state=state,
                    )

        for scope in scopes:
            if scope not in settings.SENTRY_SCOPES:
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_scope",
                    state=state,
                )

        # PKCE support (RFC 7636): accept code_challenge and code_challenge_method.
        # This implementation only supports S256 method (plain method not supported for security).
        # Note: OAuth 2.1 requires S256 to be implemented; plain is still allowed in narrow cases.
        # Reference: https://datatracker.ietf.org/doc/html/rfc7636#section-4.2
        code_challenge = request.GET.get("code_challenge")
        code_challenge_method = request.GET.get("code_challenge_method")

        if code_challenge is not None:
            # Validate code_challenge format per RFC 7636 §4.2: 43-128 unreserved chars
            if not CODE_CHALLENGE_REGEX.match(code_challenge):
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    state=state,
                )

            # Require S256 method explicitly (plain method not supported for security)
            if code_challenge_method != "S256":
                logger.error(
                    "oauth.pkce.invalid-method",
                    extra={
                        "client_id": client_id,
                        "application_id": application.id if application else None,
                        "method": code_challenge_method,
                    },
                )
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    state=state,
                )

        payload = {
            "rt": response_type,
            "cid": client_id,
            "ru": redirect_uri,
            "sc": scopes,
            "st": state,
            "uid": request.user.id if request.user.is_authenticated else "",
            "cc": code_challenge,
            "ccm": code_challenge_method if code_challenge else None,
        }
        # TODO(dcramer): Using a single "oa2" session key means multiple tabs authorizing
        # different applications will overwrite each other's session data. If a user has
        # Tab A (App A) and Tab B (App B) open, whichever tab they opened last will have
        # its payload in the session. Approving from Tab A would then authorize App B.
        # Consider using a unique transaction ID per authorization request, stored either
        # in the URL or as a per-request session key (e.g., oa2:{tx_id}).
        # See oauth_device.py for an example using user_code as a natural unique key.
        request.session["oa2"] = payload

        if not request.user.is_authenticated:
            return super().get(request, application=application)

        # If the application expects org level access, we need to prompt the user to choose which
        # organization they want to give access to every time. We should not presume the user intention
        if not (force_prompt or application.requires_org_level_access):
            try:
                existing_auth = ApiAuthorization.objects.get(
                    user_id=request.user.id, application=application
                )
            except ApiAuthorization.DoesNotExist:
                pass
            else:
                # if we've already approved all of the required scopes
                # we can skip prompting the user
                if all(existing_auth.has_scope(s) for s in scopes):
                    return self.approve(
                        request=request,
                        user=request.user,
                        application=application,
                        scopes=scopes,
                        response_type=response_type,
                        redirect_uri=redirect_uri,
                        state=state,
                        code_challenge=payload.get("cc"),
                        code_challenge_method=payload.get("ccm"),
                    )

        permissions = _build_permissions_list(scopes)

        if application.requires_org_level_access:
            organization_options = user_service.get_organizations(
                user_id=request.user.id, only_visible=True
            )
            if not organization_options:
                return self.respond(
                    "sentry/oauth-error.html",
                    {
                        "error": "This authorization flow is only available for users who are members of an organization."
                    },
                    status=400,
                )
        else:
            # If application is not org level we should not show organizations to choose from at all
            organization_options = []

        context = self.get_default_context(request) | {
            "user": request.user,
            "application": application,
            "scopes": scopes,
            "permissions": permissions,
            "organization_options": organization_options,
        }

        return self.respond("sentry/oauth-authorize.html", context)

    def _handle_cimd_authorization(
        self,
        request: HttpRequest,
        client_id: str,
        response_type: str | None,
        redirect_uri: str | None,
        state: str | None,
        force_prompt: str | None,
    ) -> HttpResponseBase:
        """
        Handle OAuth authorization for CIMD (Client ID Metadata Document) clients.

        This method fetches and validates the client metadata from the client_id URL,
        then presents the consent screen to the user.
        """
        logger.info(
            "oauth.cimd.detected",
            extra={"client_id": client_id},
        )

        # Fetch and validate CIMD metadata
        cimd_client = CIMDClient()
        try:
            metadata = cimd_client.fetch_and_validate(client_id)
            metrics.incr("oauth.cimd.metadata_fetch.success", sample_rate=1.0)
        except CIMDError as e:
            logger.warning(
                "oauth.cimd.error",
                extra={"client_id": client_id, "error": str(e)},
            )
            metrics.incr("oauth.cimd.metadata_fetch.error", sample_rate=1.0)
            # Per RFC: show only hostname to user, not potentially spoofed metadata
            return self.respond(
                "sentry/oauth-error.html",
                {"error": e.safe_message},
                status=400,
            )

        # Create CIMDClientInfo from validated metadata
        cimd_info = CIMDClientInfo.from_metadata(metadata, client_id)

        # CIMD clients only support authorization code flow (not implicit token flow)
        # per RFC draft - they are public clients that must use PKCE
        if response_type != "code":
            return self.error(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="unsupported_response_type",
                err_response="response_type",
            )

        # Validate redirect_uri
        if not redirect_uri:
            # CIMD clients MUST provide redirect_uri if multiple are registered
            uris = cimd_info.get_redirect_uris()
            if len(uris) != 1:
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    err_response="redirect_uri",
                )
            redirect_uri = cimd_info.get_default_redirect_uri()
            if redirect_uri is None:
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    err_response="redirect_uri",
                )
        elif not cimd_info.is_valid_redirect_uri(redirect_uri):
            return self.error(
                request=request,
                client_id=client_id,
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="invalid_request",
                err_response="redirect_uri",
            )

        # Validate scopes
        scopes_s = request.GET.get("scope")
        scopes = scopes_s.split(" ") if scopes_s else []

        for scope in scopes:
            if scope not in settings.SENTRY_SCOPES:
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_scope",
                    state=state,
                )

        # PKCE validation - CIMD clients SHOULD use PKCE (it's recommended for public clients)
        code_challenge = request.GET.get("code_challenge")
        code_challenge_method = request.GET.get("code_challenge_method")

        if code_challenge is not None:
            if not CODE_CHALLENGE_REGEX.match(code_challenge):
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    state=state,
                )

            if code_challenge_method != "S256":
                logger.error(
                    "oauth.pkce.invalid-method",
                    extra={
                        "client_id": client_id,
                        "client_type": "cimd",
                        "method": code_challenge_method,
                    },
                )
                return self.error(
                    request=request,
                    client_id=client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    state=state,
                )

        # Store session payload - mark as CIMD client
        payload = {
            "rt": response_type,
            "cid": client_id,
            "ru": redirect_uri,
            "sc": scopes,
            "st": state,
            "uid": request.user.id if request.user.is_authenticated else "",
            "cc": code_challenge,
            "ccm": code_challenge_method if code_challenge else None,
            "cimd": True,  # Flag to indicate this is a CIMD client
            "cimd_name": cimd_info.client_name,  # Store client name for POST
        }
        request.session["oa2"] = payload

        if not request.user.is_authenticated:
            return super().get(request, application=cimd_info)

        # CIMD clients don't have stored authorizations to check
        # Always prompt for consent (force_prompt is implicit for CIMD)

        # Build permissions list for display
        permissions = _build_permissions_list(scopes)

        # CIMD clients don't support org-level access restrictions
        organization_options: list[Any] = []

        context = self.get_default_context(request) | {
            "user": request.user,
            "application": cimd_info,
            "scopes": scopes,
            "permissions": permissions,
            "organization_options": organization_options,
            "is_cimd_client": True,
            "client_uri": cimd_info.client_uri,
        }

        metrics.incr("oauth.cimd.authorization.consent_shown", sample_rate=1.0)
        return self.respond("sentry/oauth-authorize.html", context)

    def _logged_out_post(
        self, request: HttpRequest, application: ApiApplication | CIMDClientInfo, **kwargs: Any
    ) -> HttpResponseBase:
        # subtle indirection to avoid "unreachable" after `.is_authenticated` below
        # since `.post()` mutates `request.user`
        response = super().post(request, application=application, **kwargs)
        # once they login, bind their user ID
        if request.user.is_authenticated:
            # Regenerate session to prevent session fixation attacks
            request.session.cycle_key()

            # Update OAuth payload with authenticated user ID for validation in post()
            request.session["oa2"]["uid"] = request.user.id
            request.session.modified = True
        return response

    def post(self, request: HttpRequest, **kwargs) -> HttpResponseBase:
        try:
            payload = request.session["oa2"]
        except KeyError:
            return self.respond(
                "sentry/oauth-error.html",
                {
                    "error": "We were unable to complete your request. Please re-initiate the authorization flow."
                },
            )

        # Determine if this is a CIMD client or traditional registered client
        is_cimd = payload.get("cimd", False)
        application: ApiApplication | CIMDClientInfo

        if is_cimd:
            # CIMD client: reconstruct CIMDClientInfo from session
            # We need to re-fetch to validate the client is still valid
            client_id = payload["cid"]
            cimd_client = CIMDClient()
            try:
                metadata = cimd_client.fetch_and_validate(client_id)
                application = CIMDClientInfo.from_metadata(metadata, client_id)
            except CIMDError as e:
                logger.warning(
                    "oauth.cimd.post-error",
                    extra={"client_id": client_id, "error": str(e)},
                )
                # Per RFC: show only hostname to user, not potentially spoofed metadata
                return self.respond(
                    "sentry/oauth-error.html",
                    {"error": e.safe_message},
                )
        else:
            # Traditional registered client
            try:
                application = ApiApplication.objects.get(
                    client_id=payload["cid"], status=ApiApplicationStatus.active
                )
            except ApiApplication.DoesNotExist:
                return self.respond(
                    "sentry/oauth-error.html",
                    {"error": mark_safe("Missing or invalid <em>client_id</em> parameter.")},
                )

        if not request.user.is_authenticated:
            return self._logged_out_post(request, application, **kwargs)

        if payload["uid"] != request.user.id:
            return self.respond(
                "sentry/oauth-error.html",
                {
                    "error": "We were unable to complete your request. Please re-initiate the authorization flow."
                },
            )

        response_type = payload["rt"]
        redirect_uri = payload["ru"]
        scopes = payload["sc"]
        code_challenge = payload.get("cc")
        code_challenge_method = payload.get("ccm")

        op = request.POST.get("op")
        if op == "approve":
            return self.approve(
                request=request,
                user=request.user,
                application=application,
                scopes=scopes,
                response_type=response_type,
                redirect_uri=redirect_uri,
                state=payload["st"],
                code_challenge=code_challenge,
                code_challenge_method=code_challenge_method,
            )

        elif op == "deny":
            return self.error(
                request=request,
                client_id=payload["cid"],
                response_type=response_type,
                redirect_uri=redirect_uri,
                name="access_denied",
                state=payload["st"],
            )
        else:
            raise NotImplementedError

    def approve(
        self,
        *,
        request: HttpRequest,
        user: User,
        application: ApiApplication | CIMDClientInfo,
        scopes,
        response_type: Literal["code", "token"],
        redirect_uri,
        state,
        code_challenge=None,
        code_challenge_method=None,
    ) -> HttpResponseBase:
        is_cimd = isinstance(application, CIMDClientInfo)

        # Some applications require org level access, so user who approves only gives
        # access to that organization by selecting one. If None, means the application
        # has user level access and will be able to have access to all the organizations of that user.
        selected_organization_id = request.POST.get("selected_organization_id")

        # Validate organization selection for org-level access applications
        # CIMD clients don't support org-level access restrictions
        if (
            not is_cimd
            and isinstance(application, ApiApplication)
            and application.requires_org_level_access
        ):
            # Organization ID is required for org-level access applications
            if not selected_organization_id:
                return self.error(
                    request=request,
                    client_id=application.client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="invalid_request",
                    state=state,
                )

            user_orgs = user_service.get_organizations(user_id=user.id, only_visible=True)
            org_ids = {org.id for org in user_orgs}

            try:
                selected_org_id_int = int(selected_organization_id)
            except (ValueError, TypeError):
                return self.error(
                    request=request,
                    client_id=application.client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="unauthorized_client",
                    state=state,
                )

            if selected_org_id_int not in org_ids:
                return self.error(
                    request=request,
                    client_id=application.client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="unauthorized_client",
                    state=state,
                )

        # Create ApiAuthorization for registered clients only
        # CIMD clients don't have persistent authorizations (they're validated on each request)
        if not is_cimd and isinstance(application, ApiApplication):
            try:
                with transaction.atomic(router.db_for_write(ApiAuthorization)):
                    ApiAuthorization.objects.create(
                        application=application,
                        user_id=user.id,
                        scope_list=scopes,
                        organization_id=selected_organization_id,
                    )
            except IntegrityError:
                if scopes:
                    auth = ApiAuthorization.objects.get(
                        application=application,
                        user_id=user.id,
                        organization_id=selected_organization_id,
                    )
                    for scope in scopes:
                        if scope not in auth.scope_list:
                            auth.scope_list.append(scope)
                    auth.save()

        metrics.incr(
            "oauth_authorize.get.approve",
            sample_rate=1.0,
            tags={
                "response_type": response_type,
                "client_type": "cimd" if is_cimd else "registered",
            },
        )

        if response_type == "code":
            # Create grant with either application or cimd_client_id
            if is_cimd:
                grant = ApiGrant.objects.create(
                    user_id=user.id,
                    cimd_client_id=application.client_id,
                    redirect_uri=redirect_uri,
                    scope_list=scopes,
                    organization_id=selected_organization_id,
                    code_challenge=code_challenge,
                    code_challenge_method=code_challenge_method,
                )
                logger.info(
                    "approve.grant.cimd",
                    extra={
                        "response_type": response_type,
                        "redirect_uri": redirect_uri,
                        "scope": scopes,
                        "cimd_client_id": application.client_id,
                    },
                )
            else:
                # Type narrowing: at this point application is ApiApplication
                assert isinstance(application, ApiApplication)
                grant = ApiGrant.objects.create(
                    user_id=user.id,
                    application=application,
                    redirect_uri=redirect_uri,
                    scope_list=scopes,
                    organization_id=selected_organization_id,
                    code_challenge=code_challenge,
                    code_challenge_method=code_challenge_method,
                )
                logger.info(
                    "approve.grant",
                    extra={
                        "response_type": response_type,
                        "redirect_uri": redirect_uri,
                        "scope": scopes,
                    },
                )
            return self.redirect_response(
                response_type,
                redirect_uri,
                {"code": grant.code, "state": state},
            )
        elif response_type == "token":
            # CIMD clients don't support implicit token flow (only authorization code)
            if is_cimd:
                return self.error(
                    request=request,
                    client_id=application.client_id,
                    response_type=response_type,
                    redirect_uri=redirect_uri,
                    name="unsupported_response_type",
                    state=state,
                )

            token = ApiToken.objects.create(
                application=application,
                user_id=user.id,
                refresh_token=None,
                scope_list=scopes,
                scoping_organization_id=selected_organization_id,
            )

            logger.info(
                "approve.token",
                extra={
                    "response_type": response_type,
                    "redirect_uri": redirect_uri,
                    "scope": " ".join(token.get_scopes()),
                    "state": state,
                },
            )

            return self.redirect_response(
                response_type,
                redirect_uri,
                {
                    "access_token": token.token,
                    "expires_in": int((token.expires_at - timezone.now()).total_seconds()),
                    "expires_at": token.expires_at.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
                    "token_type": "Bearer",
                    "scope": " ".join(token.get_scopes()),
                    "state": state,
                },
            )
        else:
            raise AssertionError(response_type)
