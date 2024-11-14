from django.conf import settings
from django.utils.deprecation import MiddlewareMixin
from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.superuser import Superuser, logger


class SuperuserMiddleware(MiddlewareMixin):
    def process_request(self, request: Request):
        # This avoids touching user session, which means we avoid
        # setting `Vary: Cookie` as a response header which will
        # break HTTP caching entirely.
        self.__skip_caching = request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES)

        if self.__skip_caching:
            # XXX(dcramer): support legacy is_superuser calls for unauthenticated requests
            request.is_superuser = lambda: False
            return

        su = Superuser(request)

        request.superuser = su
        # XXX(schew2381): is_superuser is a DEPRECATED property. Please use is_active_superuser(request) instead.
        request.is_superuser = lambda: request.superuser.is_active

        if su.is_active:
            logger.info(
                "superuser.request",
                extra={
                    "url": request.build_absolute_uri(),
                    "method": request.method,
                    "ip_address": request.META["REMOTE_ADDR"],
                    "user_id": request.user.id,
                    "user_email": self._extract_email(request),
                },
            )

    def process_response(self, request: Request, response: Response) -> Response:
        try:
            if self.__skip_caching:
                return response
        except AttributeError:
            pass
        su = getattr(request, "superuser", None)
        if su:
            if su.is_active:
                org_slug = getattr(getattr(request, "organization", None), "slug", None)
                if org_slug:
                    logger.info(
                        "superuser.superuser_access",
                        extra={
                            "superuser_token_id": su.token,
                            "user_id": request.user.id,
                            "user_email": self._extract_email(request),
                            "su_org_accessed": org_slug,
                        },
                    )
            su.on_response(response)
        return response

    def _extract_email(self, request: Request) -> str | None:
        """Extract the email address of an authorized superuser for logging.

        If the superuser is authorized with an email address that belongs to the host
        organization, include that address in the log entry as a convenience.
        Otherwise, the User object might be showing the address of a user being
        impersonated, which leaks PII into the logs. It also could be a secondary,
        personal email address on the superuser's account. In such cases, we want to
        omit the email address from the logs and rely on "user_id" instead.

        See https://github.com/getsentry/team-core-product-foundations/issues/315
        """
        staff_email_suffix = settings.SUPERUSER_STAFF_EMAIL_SUFFIX
        if not staff_email_suffix:
            return None
        email = getattr(request.user, "email", None)
        if email and email.endswith(staff_email_suffix):
            return email
        return None
