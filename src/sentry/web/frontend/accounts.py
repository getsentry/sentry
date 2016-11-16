"""
sentry.web.frontend.accounts
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import six

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import login as login_user, authenticate
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.db import IntegrityError, transaction
from django.http import HttpResponseRedirect, Http404, HttpResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.utils import timezone
from django.utils.translation import ugettext as _
from social_auth.backends import get_backend
from social_auth.models import UserSocialAuth
from sudo.decorators import sudo_required

from sentry.models import (
    UserEmail, LostPasswordHash, Project, UserOption, Authenticator
)
from sentry.signals import email_verified
from sentry.web.decorators import login_required, signed_auth_required
from sentry.web.forms.accounts import (
    AccountSettingsForm, AppearanceSettingsForm,
    RecoverPasswordForm, ChangePasswordRecoverForm,
    EmailForm
)
from sentry.web.helpers import render_to_response
from sentry.utils import auth


def send_password_recovery_mail(user):
    password_hash, created = LostPasswordHash.objects.get_or_create(
        user=user
    )
    if not password_hash.is_valid():
        password_hash.date_added = timezone.now()
        password_hash.set_hash()
        password_hash.save()
    password_hash.send_recover_mail()
    return password_hash


@login_required
def login_redirect(request):
    login_url = auth.get_login_redirect(request)
    return HttpResponseRedirect(login_url)


def expired(request, user):
    password_hash = send_password_recovery_mail(user)
    return render_to_response('sentry/account/recover/expired.html', {
        'email': password_hash.user.email,
    }, request)


def recover(request):
    form = RecoverPasswordForm(request.POST or None)
    if form.is_valid():
        password_hash = send_password_recovery_mail(form.cleaned_data['user'])

        return render_to_response('sentry/account/recover/sent.html', {
            'email': password_hash.user.email,
        }, request)

    context = {
        'form': form,
    }
    return render_to_response('sentry/account/recover/index.html', context, request)


def recover_confirm(request, user_id, hash):
    try:
        password_hash = LostPasswordHash.objects.get(user=user_id, hash=hash)
        if not password_hash.is_valid():
            password_hash.delete()
            raise LostPasswordHash.DoesNotExist
        user = password_hash.user

    except LostPasswordHash.DoesNotExist:
        context = {}
        tpl = 'sentry/account/recover/failure.html'

    else:
        tpl = 'sentry/account/recover/confirm.html'

        if request.method == 'POST':
            form = ChangePasswordRecoverForm(request.POST)
            if form.is_valid():
                user.set_password(form.cleaned_data['password'])
                user.refresh_session_nonce(request)
                user.save()

                # Ugly way of doing this, but Django requires the backend be set
                user = authenticate(
                    username=user.username,
                    password=form.cleaned_data['password'],
                )

                login_user(request, user)

                password_hash.delete()

                return login_redirect(request)
        else:
            form = ChangePasswordRecoverForm()

        context = {
            'form': form,
        }

    return render_to_response(tpl, context, request)


@login_required
@require_http_methods(["POST"])
def start_confirm_email(request):
    from sentry.app import ratelimiter

    if ratelimiter.is_limited(
        'auth:confirm-email:{}'.format(request.user.id),
        limit=10, window=60,  # 10 per minute should be enough for anyone
    ):
        return HttpResponse(
            'You have made too many email confirmation requests. Please try again later.',
            content_type='text/plain',
            status=429,
        )

    if 'primary-email' in request.POST:
        email = request.POST.get('email')
        try:
            email_to_send = UserEmail.objects.get(user=request.user, email=email)
        except UserEmail.DoesNotExist:
            msg = _('There was an error confirming your email.')
            level = messages.ERROR
        else:
            request.user.send_confirm_email_singular(email_to_send)
            msg = _('A verification email has been sent to %s.') % (email)
            level = messages.SUCCESS
        messages.add_message(request, level, msg)
        return HttpResponseRedirect(reverse('sentry-account-settings'))
    elif request.user.has_unverified_emails():
        request.user.send_confirm_emails()
        unverified_emails = [e.email for e in request.user.get_unverified_emails()]
        msg = _('A verification email has been sent to %s.') % (', ').join(unverified_emails)
    else:
        msg = _('Your email (%s) has already been verified.') % request.user.email
    messages.add_message(request, messages.SUCCESS, msg)
    return HttpResponseRedirect(reverse('sentry-account-settings-emails'))


def confirm_email(request, user_id, hash):
    msg = _('Thanks for confirming your email')
    level = messages.SUCCESS
    try:
        email = UserEmail.objects.get(user=user_id, validation_hash=hash)
        if not email.hash_is_valid():
            raise UserEmail.DoesNotExist
    except UserEmail.DoesNotExist:
        if request.user.is_anonymous() or request.user.has_unverified_emails():
            msg = _('There was an error confirming your email. Please try again or '
                    'visit your Account Settings to resend the verification email.')
            level = messages.ERROR
    else:
        email.is_verified = True
        email.validation_hash = ''
        email.save()
        email_verified.send(email=email.email, sender=email)
    messages.add_message(request, level, msg)
    return HttpResponseRedirect(reverse('sentry-account-settings-emails'))


@csrf_protect
@never_cache
@login_required
@transaction.atomic
def account_settings(request):
    user = request.user

    form = AccountSettingsForm(
        user, request, request.POST or None,
        initial={
            'email': UserEmail.get_primary_email(user).email,
            'username': user.username,
            'name': user.name,
        },
    )

    if form.is_valid():
        old_email = user.email

        form.save()

        # remove previously valid email address
        # TODO(dcramer): we should maintain validation here when we support
        # multiple email addresses
        if request.user.email != old_email:
            UserEmail.objects.filter(user=user, email=old_email).delete()
            try:
                with transaction.atomic():
                    user_email = UserEmail.objects.create(
                        user=user,
                        email=user.email,
                    )
            except IntegrityError:
                pass
            else:
                user_email.set_hash()
                user_email.save()
                user.send_confirm_email_singular(user_email)
                msg = _('A confirmation email has been sent to %s.') % user_email.email
                messages.add_message(
                    request,
                    messages.SUCCESS,
                    msg)

        messages.add_message(
            request, messages.SUCCESS, _('Your settings were saved.'))
        return HttpResponseRedirect(request.path)

    context = csrf(request)
    context.update({
        'form': form,
        'page': 'settings',
        'has_2fa': Authenticator.objects.user_has_2fa(request.user),
        'AUTH_PROVIDERS': auth.get_auth_providers(),
        'email': UserEmail.get_primary_email(user),
    })
    return render_to_response('sentry/account/settings.html', context, request)


@csrf_protect
@never_cache
@login_required
@sudo_required
@transaction.atomic
def twofactor_settings(request):
    interfaces = Authenticator.objects.all_interfaces_for_user(
        request.user, return_missing=True)

    if request.method == 'POST' and 'back' in request.POST:
        return HttpResponseRedirect(reverse('sentry-account-settings'))

    context = csrf(request)
    context.update({
        'page': 'security',
        'has_2fa': any(x.is_enrolled and not x.is_backup_interface for x in interfaces),
        'interfaces': interfaces,
    })
    return render_to_response('sentry/account/twofactor.html', context, request)


@csrf_protect
@never_cache
@login_required
@transaction.atomic
def avatar_settings(request):
    context = csrf(request)
    context.update({
        'page': 'avatar',
        'AUTH_PROVIDERS': auth.get_auth_providers(),
    })
    return render_to_response('sentry/account/avatar.html', context, request)


@csrf_protect
@never_cache
@login_required
@transaction.atomic
def appearance_settings(request):
    from django.conf import settings

    options = UserOption.objects.get_all_values(user=request.user, project=None)

    form = AppearanceSettingsForm(request.user, request.POST or None, initial={
        'language': options.get('language') or request.LANGUAGE_CODE,
        'stacktrace_order': int(options.get('stacktrace_order', -1) or -1),
        'timezone': options.get('timezone') or settings.SENTRY_DEFAULT_TIME_ZONE,
        'clock_24_hours': options.get('clock_24_hours') or False,
    })
    if form.is_valid():
        form.save()
        messages.add_message(request, messages.SUCCESS, 'Your settings were saved.')
        return HttpResponseRedirect(request.path)

    context = csrf(request)
    context.update({
        'form': form,
        'page': 'appearance',
        'AUTH_PROVIDERS': auth.get_auth_providers(),
    })
    return render_to_response('sentry/account/appearance.html', context, request)


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

    if request.method == 'POST':
        if 'cancel' not in request.POST:
            UserOption.objects.set_value(
                request.user, project, 'mail:alert', 0)
        return HttpResponseRedirect(auth.get_login_url())

    context = csrf(request)
    context['project'] = project
    return render_to_response('sentry/account/email_unsubscribe_project.html',
                              context, request)


@csrf_protect
@never_cache
@login_required
def list_identities(request):
    identity_list = list(UserSocialAuth.objects.filter(user=request.user))

    AUTH_PROVIDERS = auth.get_auth_providers()

    context = csrf(request)
    context.update({
        'identity_list': identity_list,
        'page': 'identities',
        'AUTH_PROVIDERS': AUTH_PROVIDERS,
    })
    return render_to_response('sentry/account/identities.html', context, request)


@csrf_protect
@never_cache
@login_required
def disconnect_identity(request, identity_id):
    if request.method != 'POST':
        raise NotImplementedError

    try:
        auth = UserSocialAuth.objects.get(id=identity_id)
    except UserSocialAuth.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-account-settings-identities'))

    backend = get_backend(auth.provider, request, '/')
    if backend is None:
        raise Exception('Backend was not found for request: {}'.format(auth.provider))

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
    assert not UserSocialAuth.objects.filter(
        user=request.user,
        id=identity_id,
    ).exists()

    backend_name = backend.AUTH_BACKEND.name

    messages.add_message(
        request, messages.SUCCESS,
        'Your {} identity has been disconnected.'.format(
            settings.AUTH_PROVIDER_LABELS.get(backend_name, backend_name),
        )
    )
    return HttpResponseRedirect(reverse('sentry-account-settings-identities'))


@csrf_protect
@never_cache
@login_required
def show_emails(request):
    user = request.user
    primary_email = UserEmail.get_primary_email(user)
    alt_emails = user.emails.all().exclude(email=primary_email.email)

    email_form = EmailForm(user, request.POST or None,
        initial={
            'primary_email': primary_email.email,
        },
    )

    if 'remove' in request.POST:
        email = request.POST.get('email')
        del_email = UserEmail.objects.filter(user=user, email=email)
        del_email.delete()
        return HttpResponseRedirect(request.path)

    if email_form.is_valid():
        old_email = user.email

        email_form.save()

        if user.email != old_email:
            useroptions = UserOption.objects.filter(user=user, value=old_email)
            for option in useroptions:
                option.value = user.email
                option.save()
            UserEmail.objects.filter(user=user, email=old_email).delete()
            try:
                with transaction.atomic():
                    user_email = UserEmail.objects.create(
                        user=user,
                        email=user.email,
                    )
            except IntegrityError:
                pass
            else:
                user_email.set_hash()
                user_email.save()
                user.send_confirm_email_singular(user_email)
                msg = _('A confirmation email has been sent to %s.') % user_email.email
                messages.add_message(
                    request,
                    messages.SUCCESS,
                    msg)
        alternative_email = email_form.cleaned_data['alt_email']
        # check if this alternative email already exists for user
        if alternative_email and not UserEmail.objects.filter(user=user, email=alternative_email):
            # create alternative email for user
            try:
                with transaction.atomic():
                    new_email = UserEmail.objects.create(
                        user=user,
                        email=alternative_email
                    )
            except IntegrityError:
                pass
            else:
                new_email.set_hash()
                new_email.save()
            # send confirmation emails to any non verified emails
            user.send_confirm_email_singular(new_email)
            msg = _('A confirmation email has been sent to %s.') % new_email.email
            messages.add_message(
                request,
                messages.SUCCESS,
                msg)

        messages.add_message(
            request, messages.SUCCESS, _('Your settings were saved.'))
        return HttpResponseRedirect(request.path)

    context = csrf(request)
    context.update({
        'email_form': email_form,
        'primary_email': primary_email,
        'alt_emails': alt_emails,
        'page': 'emails',
        'AUTH_PROVIDERS': auth.get_auth_providers(),
    })
    return render_to_response('sentry/account/emails.html', context, request)
