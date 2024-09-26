from functools import wraps

from csp.decorators import csp_update  # type: ignore[import-untyped]
from django.conf import settings

# We use inline scripts for all response templates. If CSP is enforced, we need to allow them with either a nonce or 'unsafe-inline'.
NEEDS_UNSAFE_INLINE = (
    "script-src" not in settings.CSP_INCLUDE_NONCE_IN
    and "'unsafe-inline'" not in settings.CSP_SCRIPT_SRC
)


def toolbar_csp(fx):
    """
    Decorator used to conditionally modify the Content-Security-Policy of toolbar views, depending on settings.
    """
    if not NEEDS_UNSAFE_INLINE:
        return fx

    @wraps(fx)
    @csp_update(SCRIPT_SRC=["'unsafe-inline'"])
    def wrapper(*args, **kwargs):
        return fx(*args, **kwargs)

    return wrapper
