from urllib.parse import urlencode

from django.urls import reverse
from django.utils import timezone

from sentry import options
from sentry import ratelimits as ratelimiter
from sentry.utils.email import MessageBuilder
from sentry.utils.geo import geo_by_addr
from sentry.utils.http import absolute_uri

MFA_RATE_LIMITS = {
    "auth-2fa:user:{user_id}": {
        "limit": 5,
        "window": 20,
    },
    "auth-2fa-long:user:{user_id}": {
        "limit": 20,
        "window": 60 * 60,
    },
}


def is_2fa_rate_limited(user_id: int) -> bool:
    results = [
        ratelimiter.backend.is_limited(
            key_template.format(user_id=user_id),
            limit=rate_limit["limit"],
            window=rate_limit["window"],
        )
        for key_template, rate_limit in MFA_RATE_LIMITS.items()
    ]
    return any(results)


def reset_2fa_rate_limits(user_id: int) -> None:
    for key_template, rate_limit in MFA_RATE_LIMITS.items():
        ratelimiter.backend.reset(
            key_template.format(user_id=user_id),
            window=rate_limit["window"],
        )


def send_2fa_rate_limit_notification(*, user_id: int, email: str, ip_address: str) -> None:
    if ratelimiter.backend.is_limited(
        f"auth-2fa-failed-notification:user:{user_id}", limit=1, window=30 * 60
    ):
        return

    recover_uri = "{path}?{query}".format(
        path=reverse("sentry-account-recover"), query=urlencode({"email": email})
    )
    context = {
        "datetime": timezone.now(),
        "email": email,
        "geo": geo_by_addr(ip_address),
        "ip_address": ip_address,
        "url": absolute_uri(reverse("sentry-account-settings-security")),
        "recover_url": absolute_uri(recover_uri),
    }

    subject = "Suspicious Activity Detected"
    template = "mfa-too-many-attempts"
    message = MessageBuilder(
        subject="{}{}".format(options.get("mail.subject-prefix"), subject),
        template=f"sentry/emails/{template}.txt",
        html_template=f"sentry/emails/{template}.html",
        type="user.mfa-too-many-attempts",
        context=context,
    )
    message.send_async([email])
