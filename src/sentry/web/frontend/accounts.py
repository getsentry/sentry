import logging
from functools import partial, update_wrapper

from django.contrib import messages
from django.contrib.auth import authenticate
from django.contrib.auth import login as login_user
from django.db import router, transaction
from django.http import HttpResponse, HttpResponseRedirect
from django.urls import reverse
from django.utils.translation import gettext as _
from django.views.decorators.http import require_http_methods

from sentry.models.lostpasswordhash import LostPasswordHash
from sentry.models.user import User
from sentry.models.useremail import UserEmail
from sentry.security.utils import capture_security_activity
from sentry.services.hybrid_cloud.lost_password_hash import lost_password_hash_service
from sentry.signals import email_verified
from sentry.utils import auth
from sentry.web.decorators import login_required, set_referrer_policy
from sentry.web.forms.accounts import ChangePasswordRecoverForm, RecoverPasswordForm, RelocationForm
from sentry.web.helpers import render_to_response

logger = logging.getLogger("sentry.accounts")

ERR_CONFIRMING_EMAIL = _(
    "There was an error confirming your email. Please try again or "
    "visit your Account Settings to resend the verification email."
)


class InvalidRequest(Exception):
    pass


def get_template(mode, name):
    return f"sentry/account/{mode}/{name}.html"


@login_required
def login_redirect(request):
    login_url = auth.get_login_redirect(request)
    return HttpResponseRedirect(login_url)


def expired(request, user):
    hash = lost_password_hash_service.get_or_create(user_id=user.id).hash
    LostPasswordHash.send_recover_password_email(user, hash, request.META["REMOTE_ADDR"])

    context = {"email": user.email}
    return render_to_response(get_template("recover", "expired"), context, request)


def recover(request):
    from sentry import ratelimits as ratelimiter

    extra = {
        "ip_address": request.META["REMOTE_ADDR"],
        "user_agent": request.META.get("HTTP_USER_AGENT"),
    }

    if request.method == "POST" and ratelimiter.backend.is_limited(
        "accounts:recover:{}".format(extra["ip_address"]),
        limit=5,
        window=60,  # 5 per minute should be enough for anyone
    ):
        logger.warning("recover.rate-limited", extra=extra)

        return HttpResponse(
            "You have made too many password recovery attempts. Please try again later.",
            content_type="text/plain",
            status=429,
        )

    prefill = {"user": request.GET.get("email")}

    form = RecoverPasswordForm(request.POST or None, initial=prefill)
    extra["user_recovered"] = form.data.get("user")

    if form.is_valid():
        email = form.cleaned_data["user"]
        if email:
            password_hash = lost_password_hash_service.get_or_create(user_id=email.id)
            LostPasswordHash.send_recover_password_email(
                email, password_hash.hash, request.META["REMOTE_ADDR"]
            )

            extra["passwordhash_id"] = password_hash.id
            extra["user_id"] = password_hash.user_id

            logger.info("recover.sent", extra=extra)

        context = {"email": email}

        return render_to_response(get_template("recover", "sent"), context, request)

    if form.errors:
        logger.warning("recover.error", extra=extra)

    context = {"form": form}

    return render_to_response(get_template("recover", "index"), context, request)


@set_referrer_policy("strict-origin-when-cross-origin")
def recover_confirm(request, user_id, hash, mode="recover"):
    try:
        password_hash = LostPasswordHash.objects.get(user=user_id, hash=hash)
        if not password_hash.is_valid():
            password_hash.delete()
            raise LostPasswordHash.DoesNotExist
        user = password_hash.user
    except LostPasswordHash.DoesNotExist:
        return render_to_response(get_template(mode, "failure"), {}, request)

    # TODO(getsentry/team-ospo#190): Clean up ternary logic and only show relocation form if user is unclaimed
    form_cls = RelocationForm if mode == "relocate" else ChangePasswordRecoverForm
    if request.method == "POST":
        form = form_cls(request.POST, user=user)
        if form.is_valid():
            with transaction.atomic(router.db_for_write(User)):
                if mode == "relocate":
                    user.username = form.cleaned_data["username"]
                    user.is_unclaimed = False
                user.set_password(form.cleaned_data["password"])
                user.refresh_session_nonce(request)
                user.save()

                # Ugly way of doing this, but Django requires the backend be set
                user = authenticate(username=user.username, password=form.cleaned_data["password"])

                # Only log the user in if there is no two-factor on the
                # account.
                if not user.has_2fa():
                    login_user(request, user)

                password_hash.delete()

                capture_security_activity(
                    account=user,
                    type="password-changed",
                    actor=request.user,
                    ip_address=request.META["REMOTE_ADDR"],
                    send_email=True,
                )

            return login_redirect(request)
    else:
        form = form_cls(user=user)

    return render_to_response(get_template(mode, "confirm"), {"form": form}, request)


# Set password variation of password recovery
set_password_confirm = partial(recover_confirm, mode="set_password")
set_password_confirm = update_wrapper(set_password_confirm, recover)


# Relocation variation of password recovery
relocate_confirm = partial(recover_confirm, mode="relocate")
relocate_confirm = update_wrapper(relocate_confirm, recover)


@login_required
@require_http_methods(["POST"])
def start_confirm_email(request):
    from sentry import ratelimits as ratelimiter

    if ratelimiter.backend.is_limited(
        f"auth:confirm-email:{request.user.id}",
        limit=10,
        window=60,  # 10 per minute should be enough for anyone
    ):
        return HttpResponse(
            "You have made too many email confirmation requests. Please try again later.",
            content_type="text/plain",
            status=429,
        )

    if "primary-email" in request.POST:
        email = request.POST.get("email")
        try:
            email_to_send = UserEmail.objects.get(user_id=request.user.id, email=email)
        except UserEmail.DoesNotExist:
            msg = _("There was an error confirming your email.")
            level = messages.ERROR
        else:
            request.user.send_confirm_email_singular(email_to_send)
            msg = _("A verification email has been sent to %s.") % (email)
            level = messages.SUCCESS
        messages.add_message(request, level, msg)
        return HttpResponseRedirect(reverse("sentry-account-settings"))
    elif request.user.has_unverified_emails():
        request.user.send_confirm_emails()
        unverified_emails = [e.email for e in request.user.get_unverified_emails()]
        msg = _("A verification email has been sent to %s.") % (", ").join(unverified_emails)
        for email in unverified_emails:
            logger.info(
                "user.email.start_confirm",
                extra={
                    "user_id": request.user.id,
                    "ip_address": request.META["REMOTE_ADDR"],
                    "email": email,
                },
            )
    else:
        msg = _("Your email (%s) has already been verified.") % request.user.email
    messages.add_message(request, messages.SUCCESS, msg)
    return HttpResponseRedirect(reverse("sentry-account-settings-emails"))


@set_referrer_policy("strict-origin-when-cross-origin")
def confirm_email(request, user_id, hash):
    msg = _("Thanks for confirming your email")
    level = messages.SUCCESS
    try:
        if request.user.id != int(user_id):
            raise InvalidRequest
        email = UserEmail.objects.get(user=user_id, validation_hash=hash)
        if not email.hash_is_valid():
            raise UserEmail.DoesNotExist
    except UserEmail.DoesNotExist:
        if request.user.is_anonymous or request.user.has_unverified_emails():
            msg = ERR_CONFIRMING_EMAIL
            level = messages.ERROR
    except InvalidRequest:
        msg = ERR_CONFIRMING_EMAIL
        level = messages.ERROR
    else:
        email.is_verified = True
        email.validation_hash = ""
        email.save()
        email_verified.send(email=email.email, sender=email)
        logger.info(
            "user.email.confirm",
            extra={
                "user_id": user_id,
                "ip_address": request.META["REMOTE_ADDR"],
                "email": email.email,
            },
        )
    messages.add_message(request, level, msg)
    return HttpResponseRedirect(reverse("sentry-account-settings-emails"))
