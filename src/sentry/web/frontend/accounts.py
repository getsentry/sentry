"""
sentry.web.frontend.accounts
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

import itertools

from django.contrib import messages
from django.contrib.auth import login as login_user, authenticate
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.db import transaction
from django.http import HttpResponseRedirect, Http404
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.utils import timezone
from sudo.decorators import sudo_required

from sentry.models import (
    LostPasswordHash, Project, ProjectStatus, UserOption, Authenticator)
from sentry.plugins import plugins
from sentry.web.decorators import login_required, signed_auth_required
from sentry.web.forms.accounts import (
    AccountSettingsForm, NotificationSettingsForm, AppearanceSettingsForm,
    RecoverPasswordForm, ChangePasswordRecoverForm,
    ProjectEmailOptionsForm)
from sentry.web.helpers import render_to_response
from sentry.utils.auth import get_auth_providers, get_login_redirect
from sentry.utils.safe import safe_execute


@login_required
def login_redirect(request):
    login_url = get_login_redirect(request)
    return HttpResponseRedirect(login_url)


def recover(request):
    form = RecoverPasswordForm(request.POST or None,
                               captcha=bool(request.session.get('needs_captcha')))
    if form.is_valid():
        password_hash, created = LostPasswordHash.objects.get_or_create(
            user=form.cleaned_data['user']
        )
        if not password_hash.is_valid():
            password_hash.date_added = timezone.now()
            password_hash.set_hash()
            password_hash.save()

        password_hash.send_recover_mail()

        request.session.pop('needs_captcha', None)

        return render_to_response('sentry/account/recover/sent.html', {
            'email': password_hash.user.email,
        }, request)

    elif request.POST and not request.session.get('needs_captcha'):
        request.session['needs_captcha'] = 1
        form = RecoverPasswordForm(request.POST or None, captcha=True)
        form.errors.pop('captcha', None)

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


@csrf_protect
@never_cache
@login_required
@sudo_required
@transaction.atomic
def settings(request):
    form = AccountSettingsForm(request.user, request.POST or None, initial={
        'email': request.user.email,
        'username': request.user.username,
        'name': request.user.name,
    })
    if form.is_valid():
        form.save()
        messages.add_message(request, messages.SUCCESS, 'Your settings were saved.')
        return HttpResponseRedirect(request.path)

    context = csrf(request)
    context.update({
        'form': form,
        'page': 'settings',
        'has_2fa': Authenticator.objects.user_has_2fa(request.user),
        'AUTH_PROVIDERS': get_auth_providers(),
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
        'page': 'settings',
        'has_2fa': any(x.is_enrolled and not x.is_backup_interface for x in interfaces),
        'interfaces': interfaces,
    })
    return render_to_response('sentry/account/twofactor.html', context, request)


@csrf_protect
@never_cache
@login_required
@sudo_required
@transaction.atomic
def avatar_settings(request):
    context = csrf(request)
    context.update({
        'page': 'avatar',
        'AUTH_PROVIDERS': get_auth_providers(),
    })
    return render_to_response('sentry/account/avatar.html', context, request)


@csrf_protect
@never_cache
@login_required
@sudo_required
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
        'AUTH_PROVIDERS': get_auth_providers(),
    })
    return render_to_response('sentry/account/appearance.html', context, request)


@csrf_protect
@never_cache
@login_required
@sudo_required
@transaction.atomic
def notification_settings(request):
    settings_form = NotificationSettingsForm(request.user, request.POST or None)

    project_list = list(Project.objects.filter(
        team__organizationmemberteam__organizationmember__user=request.user,
        team__organizationmemberteam__is_active=True,
        status=ProjectStatus.VISIBLE,
    ).distinct())

    project_forms = [
        (project, ProjectEmailOptionsForm(
            project, request.user,
            request.POST or None,
            prefix='project-%s' % (project.id,)
        ))
        for project in sorted(project_list, key=lambda x: (
            x.team.name if x.team else None, x.name))
    ]

    ext_forms = []
    for plugin in plugins.all():
        for form in safe_execute(plugin.get_notification_forms, _with_transaction=False) or ():
            form = safe_execute(form, plugin, request.user, request.POST or None, prefix=plugin.slug,
                                _with_transaction=False)
            if not form:
                continue
            ext_forms.append(form)

    if request.POST:
        all_forms = list(itertools.chain(
            [settings_form], ext_forms, (f for _, f in project_forms)
        ))
        if all(f.is_valid() for f in all_forms):
            for form in all_forms:
                form.save()
            messages.add_message(request, messages.SUCCESS, 'Your settings were saved.')
            return HttpResponseRedirect(request.path)

    context = csrf(request)
    context.update({
        'settings_form': settings_form,
        'project_forms': project_forms,
        'ext_forms': ext_forms,
        'page': 'notifications',
        'AUTH_PROVIDERS': get_auth_providers(),
    })
    return render_to_response('sentry/account/notifications.html', context, request)


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
        return HttpResponseRedirect(reverse('sentry'))

    context = csrf(request)
    context['project'] = project
    return render_to_response('sentry/account/email_unsubscribe_project.html',
                              context, request)


@csrf_protect
@never_cache
@login_required
def list_identities(request):
    from social_auth.models import UserSocialAuth

    identity_list = list(UserSocialAuth.objects.filter(user=request.user))

    AUTH_PROVIDERS = get_auth_providers()

    context = csrf(request)
    context.update({
        'identity_list': identity_list,
        'page': 'identities',
        'AUTH_PROVIDERS': AUTH_PROVIDERS,
    })
    return render_to_response('sentry/account/identities.html', context, request)
