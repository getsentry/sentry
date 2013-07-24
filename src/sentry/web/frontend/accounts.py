"""
sentry.web.frontend.accounts
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import itertools

from django.contrib import messages
from django.contrib.auth import login as login_user, authenticate
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.db import transaction
from django.http import HttpResponseRedirect
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from django.utils import timezone

from sentry.constants import MEMBER_USER
from sentry.models import Project, UserOption, LostPasswordHash
from sentry.plugins import plugins
from sentry.web.decorators import login_required
from sentry.web.forms.accounts import (
    AccountSettingsForm, NotificationSettingsForm, AppearanceSettingsForm,
    RegistrationForm, RecoverPasswordForm, ChangePasswordRecoverForm,
    ProjectEmailOptionsForm)
from sentry.web.helpers import render_to_response
from sentry.utils.auth import get_auth_providers
from sentry.utils.safe import safe_execute


@csrf_protect
@never_cache
def login(request):
    from django.conf import settings
    from django.contrib.auth.forms import AuthenticationForm

    if request.user.is_authenticated():
        return login_redirect(request)

    form = AuthenticationForm(request, request.POST or None)
    if form.is_valid():
        login_user(request, form.get_user())
        return login_redirect(request)

    request.session.set_test_cookie()

    context = csrf(request)
    context.update({
        'form': form,
        'next': request.session.get('_next'),
        'CAN_REGISTER': settings.SENTRY_ALLOW_REGISTRATION or request.session.get('can_register'),
        'AUTH_PROVIDERS': get_auth_providers(),
        'SOCIAL_AUTH_CREATE_USERS': settings.SOCIAL_AUTH_CREATE_USERS,
    })
    return render_to_response('sentry/login.html', context, request)


@csrf_protect
@never_cache
@transaction.commit_on_success
def register(request):
    from django.conf import settings

    if not (settings.SENTRY_ALLOW_REGISTRATION or request.session.get('can_register')):
        return HttpResponseRedirect(reverse('sentry'))

    form = RegistrationForm(request.POST or None)
    if form.is_valid():
        user = form.save()

        # can_register should only allow a single registration
        request.session.pop('can_register', None)

        # HACK: grab whatever the first backend is and assume it works
        user.backend = settings.AUTHENTICATION_BACKENDS[0]

        login_user(request, user)

        return login_redirect(request)

    return render_to_response('sentry/register.html', {
        'form': form,
        'AUTH_PROVIDERS': get_auth_providers(),
        'SOCIAL_AUTH_CREATE_USERS': settings.SOCIAL_AUTH_CREATE_USERS,
    }, request)


@login_required
def login_redirect(request):
    default = reverse('sentry')
    login_url = request.session.pop('_next', None) or default
    if '//' in login_url:
        login_url = default
    elif login_url.startswith(reverse('sentry-login')):
        login_url = default
    return HttpResponseRedirect(login_url)


@never_cache
def logout(request):
    from django.contrib.auth import logout

    logout(request)

    return HttpResponseRedirect(reverse('sentry'))


def recover(request):
    form = RecoverPasswordForm(request.POST or None)
    if form.is_valid():
        password_hash, created = LostPasswordHash.objects.get_or_create(
            user=form.cleaned_data['user']
        )
        if not password_hash.is_valid():
            password_hash.date_added = timezone.now()
            password_hash.set_hash()

    if form.is_valid():
        password_hash.send_recover_mail()

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
@transaction.commit_on_success
def settings(request):
    form = AccountSettingsForm(request.user, request.POST or None, initial={
        'email': request.user.email,
        'first_name': request.user.first_name,
    })
    if form.is_valid():
        form.save()
        messages.add_message(request, messages.SUCCESS, 'Your settings were saved.')
        return HttpResponseRedirect(request.path)

    context = csrf(request)
    context.update({
        'form': form,
        'page': 'settings',
    })
    return render_to_response('sentry/account/settings.html', context, request)


@csrf_protect
@never_cache
@login_required
@transaction.commit_on_success
def appearance_settings(request):
    options = UserOption.objects.get_all_values(user=request.user, project=None)

    form = AppearanceSettingsForm(request.user, request.POST or None, initial={
        'language': options.get('language') or request.LANGUAGE_CODE,
        'stacktrace_order': int(options.get('stacktrace_order', -1) or -1),
    })
    if form.is_valid():
        form.save()
        messages.add_message(request, messages.SUCCESS, 'Your settings were saved.')
        return HttpResponseRedirect(request.path)

    context = csrf(request)
    context.update({
        'form': form,
        'page': 'appearance',
    })
    return render_to_response('sentry/account/appearance.html', context, request)


@csrf_protect
@never_cache
@login_required
@transaction.commit_on_success
def notification_settings(request):
    settings_form = NotificationSettingsForm(request.user, request.POST or None)

    project_list = Project.objects.get_for_user(request.user, access=MEMBER_USER)
    project_forms = [
        (project, ProjectEmailOptionsForm(
            project, request.user,
            request.POST or None,
            prefix='project-%s' % (project.id,)
        ))
        for project in sorted(project_list, key=lambda x: (x.team.name, x.name))
    ]

    ext_forms = []
    for plugin in plugins.all():
        for form in safe_execute(plugin.get_notification_forms) or ():
            form = safe_execute(form, plugin, request.user, request.POST or None, prefix=plugin.slug)
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
    })
    return render_to_response('sentry/account/notifications.html', context, request)


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
