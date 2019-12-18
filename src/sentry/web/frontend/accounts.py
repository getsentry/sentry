from __future__ import absolute_import

import logging
from functools import partial, update_wrapper

import six

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login as login_user, authenticate
from django.template.context_processors import csrf
from django.core.urlresolvers import reverse
from django.db import transaction
from django.http import HttpResponseRedirect, Http404, HttpResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.utils.translation import ugettext as _

from sentry.models import UserEmail, LostPasswordHash, Project, UserOption, Authenticator
from sentry.security import capture_security_activity
from sentry.signals import email_verified
from sentry.web.decorators import login_required, signed_auth_required
from sentry.web.forms.accounts import RecoverPasswordForm, ChangePasswordRecoverForm
from sentry.web.helpers import render_to_response
from sentry.utils import auth
from social_auth.backends import get_backend
from social_auth.models import UserSocialAuth

logger = logging.getLogger("sentry.accounts")


@login_required
def login_redirect(request):
    login_url = auth.get_login_redirect(request)
    return HttpResponseRedirect(login_url)


def expired(request, user):
    password_hash = LostPasswordHash.for_user(user)
    password_hash.send_email(request)

    context = {"email": password_hash.user.email}
    return render_to_response("sentry/account/recover/expired.html", context, request)


def recover(request):
    from sentry.app import ratelimiter

    extra = {
        "ip_address": request.META["REMOTE_ADDR"],
        "user_agent": request.META.get("HTTP_USER_AGENT"),
    }

    if request.method == "POST" and ratelimiter.is_limited(
        u"accounts:recover:{}".format(extra["ip_address"]),
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
            password_hash = LostPasswordHash.for_user(email)
            password_hash.send_email(request)

            extra["passwordhash_id"] = password_hash.id
            extra["user_id"] = password_hash.user_id

            logger.info("recover.sent", extra=extra)

        tpl = "sentry/account/recover/sent.html"
        context = {"email": email}

        return render_to_response(tpl, context, request)

    if form._errors:
        logger.warning("recover.error", extra=extra)

    tpl = "sentry/account/recover/index.html"
    context = {"form": form}

    return render_to_response(tpl, context, request)


def recover_confirm(request, user_id, hash, mode="recover"):
    try:
        password_hash = LostPasswordHash.objects.get(user=user_id, hash=hash)
        if not password_hash.is_valid():
            password_hash.delete()
            raise LostPasswordHash.DoesNotExist
        user = password_hash.user

    except LostPasswordHash.DoesNotExist:
        return render_to_response(u"sentry/account/{}/{}.html".format(mode, "failure"), {}, request)

    if request.method == "POST":
        form = ChangePasswordRecoverForm(request.POST)
        if form.is_valid():
            with transaction.atomic():
                user.set_password(form.cleaned_data["password"])
                user.refresh_session_nonce(request)
                user.save()

                # Ugly way of doing this, but Django requires the backend be set
                user = authenticate(username=user.username, password=form.cleaned_data["password"])

                # Only log the user in if there is no two-factor on the
                # account.
                if not Authenticator.objects.user_has_2fa(user):
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
        form = ChangePasswordRecoverForm()

    return render_to_response(
        u"sentry/account/{}/{}.html".format(mode, "confirm"), {"form": form}, request
    )


# Set password variation of password recovery
set_password_confirm = partial(recover_confirm, mode="set_password")
set_password_confirm = update_wrapper(set_password_confirm, recover)


@login_required
@require_http_methods(["POST"])
def start_confirm_email(request):
    from sentry.app import ratelimiter

    if ratelimiter.is_limited(
        u"auth:confirm-email:{}".format(request.user.id),
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
            email_to_send = UserEmail.objects.get(user=request.user, email=email)
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


def confirm_email(request, user_id, hash):
    msg = _("Thanks for confirming your email")
    level = messages.SUCCESS
    try:
        email = UserEmail.objects.get(user=user_id, validation_hash=hash)
        if not email.hash_is_valid():
            raise UserEmail.DoesNotExist
    except UserEmail.DoesNotExist:
        if request.user.is_anonymous() or request.user.has_unverified_emails():
            msg = _(
                "There was an error confirming your email. Please try again or "
                "visit your Account Settings to resend the verification email."
            )
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


@csrf_protect
@never_cache
@signed_auth_required
@transaction.atomic
def email_unsubscribe_project(request, project_id):
    # For now we only support getting here from the signed link.
    if not request.user_from_signed_request:
        raise Http404()
    try:
        project = Project.objects.get(pk=project_id)
    except Project.DoesNotExist:
        raise Http404()

    if request.method == "POST":
        if "cancel" not in request.POST:
            UserOption.objects.set_value(
                user=request.user, key="mail:alert", value=0, project=project
            )
        return HttpResponseRedirect(auth.get_login_url())

    context = csrf(request)
    context["project"] = project
    return render_to_response("sentry/account/email_unsubscribe_project.html", context, request)


@csrf_protect
@never_cache
@login_required
def disconnect_identity(request, identity_id):
    if request.method != "POST":
        raise NotImplementedError

    try:
        auth = UserSocialAuth.objects.get(id=identity_id)
    except UserSocialAuth.DoesNotExist:
        return HttpResponseRedirect(reverse("sentry-account-settings-identities"))

    backend = get_backend(auth.provider, request, "/")
    if backend is None:
        raise Exception(u"Backend was not found for request: {}".format(auth.provider))

    # stop this from bubbling up errors to social-auth's middleware
    # XXX(dcramer): IM SO MAD ABOUT THIS
    try:
        backend.disconnect(request.user, identity_id)
    except Exception as exc:
        import sys

        exc_tb = sys.exc_info()[2]
        six.reraise(Exception, exc, exc_tb)
        del exc_tb

    # XXX(dcramer): we experienced an issue where the identity still existed,
    # and given that this is a cheap query, lets error hard in that case
    assert not UserSocialAuth.objects.filter(user=request.user, id=identity_id).exists()

    backend_name = backend.AUTH_BACKEND.name

    messages.add_message(
        request,
        messages.SUCCESS,
        u"Your {} identity has been disconnected.".format(
            settings.AUTH_PROVIDER_LABELS.get(backend_name, backend_name)
        ),
    )
    logger.info(
        "user.identity.disconnect",
        extra={
            "user_id": request.user.id,
            "ip_address": request.META["REMOTE_ADDR"],
            "usersocialauth_id": identity_id,
        },
    )
    return HttpResponseRedirect(reverse("sentry-account-settings-identities"))
