import logging
from functools import partial

from django.contrib import messages
from django.contrib.auth import authenticate
from django.contrib.auth import login as login_user
from django.core.signing import BadSignature, SignatureExpired
from django.db import router, transaction
from django.http import HttpRequest, HttpResponse, HttpResponseNotFound, HttpResponseRedirect
from django.urls import reverse
from django.utils.translation import gettext as _
from django.views.decorators.http import require_http_methods

from sentry import options
from sentry.models.organizationmapping import OrganizationMapping
from sentry.models.organizationmembermapping import OrganizationMemberMapping
from sentry.organizations.services.organization import organization_service
from sentry.security.utils import capture_security_activity
from sentry.signals import email_verified, terms_accepted
from sentry.silo.base import control_silo_function
from sentry.users.models.lostpasswordhash import LostPasswordHash
from sentry.users.models.user import User
from sentry.users.models.useremail import UserEmail
from sentry.users.services.lost_password_hash import lost_password_hash_service
from sentry.users.services.user.service import user_service
from sentry.users.web.accounts_form import (
    ChangePasswordRecoverForm,
    RecoverPasswordForm,
    RelocationForm,
)
from sentry.utils import auth
from sentry.utils.signing import unsign
from sentry.web.decorators import login_required, set_referrer_policy
from sentry.web.frontend.twofactor import reset_2fa_rate_limits
from sentry.web.helpers import render_to_response

logger = logging.getLogger("sentry.accounts")

ERR_CONFIRMING_EMAIL = _(
    "There was an error confirming your email. Please try again or "
    "visit your Account Settings to resend the verification email."
)

ERR_SIGNATURE_EXPIRED = _(
    "The confirmation link has expired. Please visit your Account "
    "Settings to resend the verification email."
)

WARN_EMAIL_ALREADY_VERIFIED = _("The email you are trying to verify has already been verified.")


EMAIL_CONFIRMATION_SALT = "email-confirmation"


class InvalidRequest(Exception):
    pass


class VerifiedEmailAlreadyExists(Exception):
    """email already exists as a verified email on the account"""

    pass


def get_template(mode: str, name: str) -> str:
    return f"sentry/account/{mode}/{name}.html"


@login_required
@control_silo_function
def login_redirect(request: HttpRequest) -> HttpResponseRedirect:
    login_url = auth.get_login_redirect(request)
    return HttpResponseRedirect(login_url)


@control_silo_function
def expired(request: HttpRequest, user: User) -> HttpResponse:
    hash = lost_password_hash_service.get_or_create(user_id=user.id).hash
    LostPasswordHash.send_recover_password_email(user, hash, request.META["REMOTE_ADDR"])

    context = {"email": user.email}
    return render_to_response(get_template("recover", "expired"), context, request)


@control_silo_function
def recover(request: HttpRequest) -> HttpResponse:
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
@control_silo_function
def relocate_reclaim(request: HttpRequest, user_id: int) -> HttpResponse:
    """
    Ask to receive a new "claim this user" email.
    """
    from sentry import ratelimits as ratelimiter

    extra = {
        "ip_address": request.META["REMOTE_ADDR"],
        "user_agent": request.META.get("HTTP_USER_AGENT"),
        "user_id": user_id,
    }
    if request.method != "POST":
        logger.warning("reclaim.error", extra=extra)
        return render_to_response(get_template("relocate", "error"), {}, request)

    if ratelimiter.backend.is_limited(
        "accounts:reclaim:{}".format(extra["ip_address"]),
        limit=5,
        window=60,  # 5 per minute should be enough for anyone
    ):
        logger.warning("reclaim.rate-limited", extra=extra)

        return HttpResponse(
            "You have made too many password recovery attempts. Please try again later.",
            content_type="text/plain",
            status=429,
        )

    # Verify that the user is unclaimed. If they are already claimed, tell the requester that this
    # is the case, since of course claiming this account would be impossible.
    user = User.objects.filter(id=user_id).first()
    if user is None:
        logger.warning("reclaim.user_not_found", extra=extra)
        return render_to_response(get_template("relocate", "error"), {}, request)
    if not user.is_unclaimed:
        logger.warning("reclaim.already_claimed", extra=extra)
        return render_to_response(get_template("relocate", "claimed"), {}, request)

    # Get all orgs for user. We'll need this info to properly compose the new relocation email.
    org_ids = OrganizationMemberMapping.objects.filter(user_id=user_id).values_list(
        "organization_id", flat=True
    )
    org_slugs = list(
        OrganizationMapping.objects.filter(organization_id__in=org_ids).values_list(
            "slug", flat=True
        )
    )
    if len(org_slugs) == 0:
        logger.warning("reclaim.error", extra=extra)
        return render_to_response(get_template("relocate", "error"), {}, request)

    # Make a new `LostPasswordHash`, and send the "this user has been relocated ..." email again.
    password_hash = lost_password_hash_service.get_or_create(user_id=user_id)
    LostPasswordHash.send_relocate_account_email(user, password_hash.hash, org_slugs)
    extra["passwordhash_id"] = password_hash.id
    extra["org_slugs"] = org_slugs

    # Let the user know that we've sent them a new email.
    logger.info("recover.sent", extra=extra)
    return render_to_response(get_template("relocate", "sent"), {}, request)


@set_referrer_policy("strict-origin-when-cross-origin")
@control_silo_function
def recover_confirm(
    request: HttpRequest, user_id: int, hash: str, mode: str = "recover"
) -> HttpResponse:
    from sentry import ratelimits as ratelimiter

    try:
        password_hash = LostPasswordHash.objects.get(user=user_id, hash=hash)
        if not password_hash.is_valid():
            password_hash.delete()
            raise LostPasswordHash.DoesNotExist
        user = password_hash.user
    except LostPasswordHash.DoesNotExist:
        return render_to_response(get_template(mode, "failure"), {"user_id": user_id}, request)

    extra = {
        "ip_address": request.META["REMOTE_ADDR"],
        "user_agent": request.META.get("HTTP_USER_AGENT"),
    }

    if request.method == "POST" and ratelimiter.backend.is_limited(
        "accounts:confirm:{}".format(extra["ip_address"]),
        limit=5,
        window=60,  # 5 per minute should be enough for anyone
    ):
        logger.warning("confirm.rate-limited", extra=extra)

        return HttpResponse(
            "You have made too many attempts. Please try again later.",
            content_type="text/plain",
            status=429,
        )

    # TODO(getsentry/team-ospo#190): Clean up ternary logic and only show relocation form if user is unclaimed
    form_cls = RelocationForm if mode == "relocate" else ChangePasswordRecoverForm
    if request.method == "POST":
        form = form_cls(request.POST, user=user)
        if form.is_valid():
            if mode == "relocate":
                # Relocation form requires users to accept TOS and privacy policy with an org
                # associated. We only need the first membership, since all of user's orgs will be in
                # the same region.
                membership = OrganizationMemberMapping.objects.filter(user=user).first()
                assert membership is not None
                mapping = OrganizationMapping.objects.get(
                    organization_id=membership.organization_id
                )

                # These service calls need to be outside of the transaction block. Claiming an
                # account constitutes an email verifying action. We'll verify the primary email
                # associated with this account in particular, since that is the only one the user
                # claiming email could have been sent to.
                rpc_user = user_service.get_user(user_id=user.id)
                user_service.verify_user_email(email=user.email, user_id=user.id)
                orgs = organization_service.get_organizations_by_user_and_scope(
                    region_name=mapping.region_name, user=rpc_user
                )
                for org in orgs:
                    terms_accepted.send_robust(
                        user=user,
                        organization=org,
                        ip_address=request.META["REMOTE_ADDR"],
                        sender=recover_confirm,
                    )

            with transaction.atomic(router.db_for_write(User)):
                if mode == "relocate":
                    user.username = form.cleaned_data["username"]
                    user.is_unclaimed = False

                user.set_password(form.cleaned_data["password"])
                user.refresh_session_nonce(request)
                user.save()

                # Ugly way of doing this, but Django requires the backend be set
                auth = authenticate(username=user.username, password=form.cleaned_data["password"])
                assert isinstance(auth, User), auth
                user = auth

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

                reset_2fa_rate_limits(user.id)

            return login_redirect(request)
    else:
        form = form_cls(user=user)

    return render_to_response(get_template(mode, "confirm"), {"form": form}, request)


# Set password variation of password recovery
set_password_confirm = partial(recover_confirm, mode="set_password")


# Relocation variation of password recovery
relocate_confirm = partial(recover_confirm, mode="relocate")


@login_required
@require_http_methods(["POST"])
@control_silo_function
def start_confirm_email(request: HttpRequest) -> HttpResponse:
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

    assert isinstance(
        request.user, User
    ), "User must have an associated email to send confirm emails to"
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
@login_required
@control_silo_function
def confirm_email(request: HttpRequest, user_id: int, hash: str) -> HttpResponseRedirect:
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
        email.save(update_fields=["is_verified", "validation_hash"])
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


@set_referrer_policy("strict-origin-when-cross-origin")
@login_required
@control_silo_function
def confirm_signed_email(
    request: HttpRequest, signed_data: str
) -> HttpResponseRedirect | HttpResponse:

    use_signed_urls = options.get("user-settings.signed-url-confirmation-emails")
    if not use_signed_urls:
        return HttpResponseNotFound()

    msg = _("Thanks for confirming your email!")
    level = messages.SUCCESS

    try:
        data = unsign(signed_data, salt=EMAIL_CONFIRMATION_SALT)

        # is the currently logged in user the one that
        # wants to add the email to their account
        if request.user.id != int(data["user_id"]):
            raise InvalidRequest

        # check to see if the email has already been verified
        email = UserEmail.objects.get(user=request.user.id, email=data["email"])
        if email:
            raise VerifiedEmailAlreadyExists
    except UserEmail.DoesNotExist:
        # user email does not exist, so we can create it
        pass
    except VerifiedEmailAlreadyExists:
        msg = WARN_EMAIL_ALREADY_VERIFIED
        level = messages.INFO
        return HttpResponseRedirect(reverse("sentry-account-settings-emails"))
    except SignatureExpired:
        msg = ERR_SIGNATURE_EXPIRED
        level = messages.ERROR
        return HttpResponseRedirect(reverse("sentry-account-settings-emails"))
    except (InvalidRequest, BadSignature):
        msg = ERR_CONFIRMING_EMAIL
        level = messages.ERROR
        return HttpResponseRedirect(reverse("sentry-account-settings-emails"))
    except Exception:
        logger.exception("user.email.signed-confirm.error")
        msg = ERR_CONFIRMING_EMAIL
        level = messages.ERROR
        return HttpResponseRedirect(reverse("sentry-account-settings-emails"))

    user = User.objects.get(id=request.user.id)
    email = UserEmail.objects.create(
        user=user,
        email=data["email"],
        is_verified=True,
    )
    email.save()

    email_verified.send(email=email.email, sender=email)
    logger.info(
        "user.email.signed-confirm",
        extra={
            "user_id": request.user.id,
            "ip_address": request.META["REMOTE_ADDR"],
            "email": email.email,
        },
    )

    messages.add_message(request, level, msg)
    return HttpResponseRedirect(reverse("sentry-account-settings-emails"))
