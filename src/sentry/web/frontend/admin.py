"""
sentry.web.frontend.admin
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import functools
import logging
import sys
import uuid
from collections import defaultdict

import pkg_resources
import six
from django.conf import settings
from django.core.context_processors import csrf
from django.db import transaction
from django.http import HttpResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect

from sentry import options
from sentry.app import env
from sentry.models import Project, User
from sentry.plugins import plugins
from sentry.utils.email import send_mail
from sentry.utils.http import absolute_uri
from sentry.utils.warnings import DeprecatedSettingWarning, UnsupportedBackend, seen_warnings
from sentry.web.decorators import requires_admin
from sentry.web.forms import (
    ChangeUserForm, NewUserForm, RemoveUserForm, TestEmailForm
)
from sentry.utils import auth
from sentry.web.helpers import render_to_response, render_to_string


def configure_plugin(request, slug):
    plugin = plugins.get(slug)
    if not plugin.has_site_conf():
        return HttpResponseRedirect(auth.get_login_url())

    view = plugin.configure(request=request)
    if isinstance(view, HttpResponse):
        return view

    return render_to_response('sentry/admin/plugins/configure.html', {
        'plugin': plugin,
        'title': plugin.get_conf_title(),
        'slug': plugin.slug,
        'view': view,
    }, request)


@requires_admin
@transaction.atomic
@csrf_protect
def create_new_user(request):
    if not request.is_superuser():
        return HttpResponseRedirect(auth.get_login_url())

    form = NewUserForm(request.POST or None, initial={
        'send_welcome_mail': True,
        'create_project': True,
    })
    if form.is_valid():
        user = form.save(commit=False)

        # create a random password
        password = uuid.uuid4().hex
        user.set_password(password)

        user.save()

        if form.cleaned_data['send_welcome_mail']:
            context = {
                'username': user.username,
                'password': password,
                'url': absolute_uri(auth.get_login_url()),
            }
            body = render_to_string('sentry/emails/welcome_mail.txt', context, request)

            try:
                send_mail(
                    '%s Welcome to Sentry' % (options.get('mail.subject-prefix'),),
                    body, options.get('mail.from'), [user.email],
                    fail_silently=False
                )
            except Exception as e:
                logger = logging.getLogger('sentry.mail.errors')
                logger.exception(e)

        return HttpResponseRedirect(absolute_uri('/manage/users/'))

    context = {
        'form': form,
    }
    context.update(csrf(request))

    return render_to_response('sentry/admin/users/new.html', context, request)


@requires_admin
@csrf_protect
def edit_user(request, user_id):
    if not request.is_superuser():
        return HttpResponseRedirect(auth.get_login_url())

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return HttpResponseRedirect(absolute_uri('/manage/users/'))

    form = ChangeUserForm(request.POST or None, instance=user)
    if form.is_valid():
        user = form.save()
        return HttpResponseRedirect(absolute_uri('/manage/users/'))

    project_list = Project.objects.filter(
        status=0,
        organization__member_set__user=user,
    ).order_by('-date_added')

    context = {
        'form': form,
        'the_user': user,
        'project_list': project_list,
    }
    context.update(csrf(request))

    return render_to_response('sentry/admin/users/edit.html', context, request)


@requires_admin
@csrf_protect
def remove_user(request, user_id):
    if six.text_type(user_id) == six.text_type(request.user.id):
        return HttpResponseRedirect(absolute_uri('/manage/users/'))

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return HttpResponseRedirect(absolute_uri('/manage/users/'))

    form = RemoveUserForm(request.POST or None)
    if form.is_valid():
        if form.cleaned_data['removal_type'] == '2':
            user.delete()
        else:
            User.objects.filter(pk=user.pk).update(is_active=False)

        return HttpResponseRedirect(absolute_uri('/manage/users/'))

    context = csrf(request)
    context.update({
        'form': form,
        'the_user': user,
    })

    return render_to_response('sentry/admin/users/remove.html', context, request)


@requires_admin
def status_env(request):
    reserved = ('PASSWORD', 'SECRET', 'KEY')
    config = []
    for k in sorted(dir(settings)):
        v_repr = repr(getattr(settings, k))
        if any(r.lower() in v_repr.lower() for r in reserved):
            v_repr = '*' * 16
        if any(r in k for r in reserved):
            v_repr = '*' * 16
        if k.startswith('_'):
            continue
        if k.upper() != k:
            continue
        config.append((k, v_repr))

    return render_to_response('sentry/admin/status/env.html', {
        'python_version': sys.version,
        'config': config,
        'environment': env.data,
    }, request)


@requires_admin
def status_packages(request):
    config = []
    for k in sorted(dir(settings)):
        if k == 'KEY':
            continue
        if k.startswith('_'):
            continue
        if k.upper() != k:
            continue
        config.append((k, getattr(settings, k)))

    return render_to_response('sentry/admin/status/packages.html', {
        'modules': sorted([(p.project_name, p.version) for p in pkg_resources.working_set]),
        'extensions': [
            (p.get_title(), '%s.%s' % (p.__module__, p.__class__.__name__))
            for p in plugins.all(version=None)
        ],
    }, request)


@requires_admin
def status_warnings(request):
    groupings = {
        DeprecatedSettingWarning: 'Deprecated Settings',
        UnsupportedBackend: 'Unsupported Backends',
    }

    groups = defaultdict(list)
    warnings = []
    for warning in seen_warnings:
        cls = type(warning)
        if cls in groupings:
            groups[cls].append(warning)
        else:
            warnings.append(warning)

    sort_by_message = functools.partial(sorted, key=six.binary_type)

    return render_to_response(
        'sentry/admin/status/warnings.html',
        {
            'groups': sorted([(groupings[key], sort_by_message(values)) for key, values in groups.items()]),
            'warnings': sort_by_message(warnings),
        },
        request,
    )


@requires_admin
@csrf_protect
def status_mail(request):
    form = TestEmailForm(request.POST or None)

    if form.is_valid():
        body = """This email was sent as a request to test the Sentry outbound email configuration."""
        try:
            send_mail(
                '%s Test Email' % (options.get('mail.subject-prefix'),),
                body, options.get('mail.from'), [request.user.email],
                fail_silently=False
            )
        except Exception as e:
            form.errors['__all__'] = [six.text_type(e)]

    return render_to_response('sentry/admin/status/mail.html', {
        'form': form,
        'mail_host': options.get('mail.host'),
        'mail_password': bool(options.get('mail.password')),
        'mail_username': options.get('mail.username'),
        'mail_port': options.get('mail.port'),
        'mail_use_tls': options.get('mail.use-tls'),
        'mail_from': options.get('mail.from'),
        'mail_list_namespace': options.get('mail.list-namespace'),
    }, request)
