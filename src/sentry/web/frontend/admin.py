"""
sentry.web.frontend.admin
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import datetime
import logging
import pkg_resources
import sys
import uuid

from django.conf import settings
from django.core.context_processors import csrf
from django.core.mail import send_mail
from django.core.urlresolvers import reverse
from django.db import transaction
from django.db.models import Sum, Count
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect

from sentry.app import env
from sentry.models import Team, Project, GroupCountByMinute, User
from sentry.plugins import plugins
from sentry.utils.http import absolute_uri
from sentry.web.forms import (
    NewUserForm, ChangeUserForm, RemoveUserForm, TestEmailForm)
from sentry.web.decorators import requires_admin
from sentry.web.helpers import (
    render_to_response, plugin_config, render_to_string)


def configure_plugin(request, slug):
    plugin = plugins.get(slug)
    if not plugin.has_site_conf():
        return HttpResponseRedirect(reverse('sentry'))

    action, view = plugin_config(plugin, None, request)
    if action == 'redirect':
        return HttpResponseRedirect(request.path)

    return render_to_response('sentry/admin/plugins/configure.html', {
        'plugin': plugin,
        'title': plugin.get_conf_title(),
        'slug': plugin.slug,
        'view': view,
    }, request)


@requires_admin
def manage_projects(request):
    project_list = Project.objects.filter(
        status=0,
        team__isnull=False,
    ).select_related('owner', 'team')

    project_query = request.GET.get('pquery')
    if project_query:
        project_list = project_list.filter(name__icontains=project_query)

    sort = request.GET.get('sort')
    if sort not in ('name', 'date', 'events'):
        sort = 'date'

    if sort == 'date':
        order_by = '-date_added'
    elif sort == 'name':
        order_by = 'name'
    elif sort == 'events':
        project_list = project_list.annotate(
            events=Sum('projectcountbyminute__times_seen'),
        ).filter(projectcountbyminute__date__gte=timezone.now() - datetime.timedelta(days=1))
        order_by = '-events'

    project_list = project_list.order_by(order_by)

    context = {
        'project_list': project_list,
        'project_query': project_query,
        'sort': sort,
    }

    return render_to_response('sentry/admin/projects/list.html', context, request)


@requires_admin
def manage_users(request):
    user_list = User.objects.all().order_by('-date_joined')

    user_query = request.GET.get('uquery')
    if user_query:
        user_list = user_list.filter(email__icontains=user_query)

    sort = request.GET.get('sort')
    if sort not in ('name', 'joined', 'login', 'projects'):
        sort = 'joined'

    if sort == 'joined':
        order_by = '-date_joined'
    elif sort == 'login':
        order_by = '-last_login'
    elif sort == 'name':
        order_by = 'first_name'

    user_list = user_list.order_by(order_by)

    return render_to_response('sentry/admin/users/list.html', {
        'user_list': user_list,
        'user_query': user_query,
        'sort': sort,
    }, request)


@requires_admin
@transaction.commit_on_success
@csrf_protect
def create_new_user(request):
    if not request.user.has_perm('auth.can_add_user'):
        return HttpResponseRedirect(reverse('sentry'))

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

        if form.cleaned_data['create_project']:
            project = Project.objects.create(
                owner=user,
                name='%s\'s New Project' % user.username.capitalize()
            )
            member = project.team.member_set.get(user=user)
            key = project.key_set.get(user=user)

        if form.cleaned_data['send_welcome_mail']:
            context = {
                'username': user.username,
                'password': password,
                'url': absolute_uri(reverse('sentry')),
            }
            if form.cleaned_data['create_project']:
                context.update({
                    'project': project,
                    'member': member,
                    'dsn': key.get_dsn(),
                })
            body = render_to_string('sentry/emails/welcome_mail.txt', context, request)

            try:
                send_mail(
                    '%s Welcome to Sentry' % (settings.EMAIL_SUBJECT_PREFIX,),
                    body, settings.SERVER_EMAIL, [user.email],
                    fail_silently=False
                )
            except Exception, e:
                logger = logging.getLogger('sentry.mail.errors')
                logger.exception(e)

        return HttpResponseRedirect(reverse('sentry-admin-users'))

    context = {
        'form': form,
    }
    context.update(csrf(request))

    return render_to_response('sentry/admin/users/new.html', context, request)


@requires_admin
@csrf_protect
def edit_user(request, user_id):
    if not request.user.has_perm('auth.can_change_user'):
        return HttpResponseRedirect(reverse('sentry'))

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-admin-users'))

    form = ChangeUserForm(request.POST or None, instance=user)
    if form.is_valid():
        user = form.save()
        return HttpResponseRedirect(reverse('sentry-admin-users'))

    project_list = Project.objects.filter(
        status=0,
        team__member_set__user=user,
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
    if str(user_id) == str(request.user.id):
        return HttpResponseRedirect(reverse('sentry-admin-users'))

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-admin-users'))

    form = RemoveUserForm(request.POST or None)
    if form.is_valid():
        if form.cleaned_data['removal_type'] == '2':
            user.delete()
        else:
            User.objects.filter(pk=user.pk).update(is_active=False)

        return HttpResponseRedirect(reverse('sentry-admin-users'))

    context = csrf(request)
    context.update({
        'form': form,
        'the_user': user,
    })

    return render_to_response('sentry/admin/users/remove.html', context, request)


@requires_admin
def list_user_projects(request, user_id):
    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-admin-users'))

    project_list = Project.objects.filter(
        status=0,
        member_set__user=user,
    ).order_by('-date_added')

    context = {
        'project_list': project_list,
        'the_user': user,
    }

    return render_to_response('sentry/admin/users/list_projects.html', context, request)


@requires_admin
def manage_teams(request):
    team_list = Team.objects.order_by('-date_added').select_related('owner')

    team_query = request.GET.get('tquery')
    if team_query:
        team_list = team_list.filter(name__icontains=team_query)

    sort = request.GET.get('sort')
    if sort not in ('name', 'date', 'events'):
        sort = 'date'

    if sort == 'date':
        order_by = '-date_added'
    elif sort == 'name':
        order_by = 'name'
    elif sort == 'projects':
        order_by = '-num_projects'

    team_list = team_list.annotate(
        num_projects=Count('project'),
    ).order_by(order_by)

    return render_to_response('sentry/admin/teams/list.html', {
        'team_list': team_list,
        'team_query': team_query,
        'sort': sort,
    }, request)


@requires_admin
def status_env(request):
    reserved = ('PASSWORD', 'SECRET')
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
        'extensions': [(p.get_title(), '%s.%s' % (p.__module__, p.__class__.__name__)) for p in plugins.all()],
    }, request)


@requires_admin
@csrf_protect
def status_mail(request):
    form = TestEmailForm(request.POST or None)

    if form.is_valid():
        body = """This email was sent as a request to test the Sentry outbound email configuration."""
        try:
            send_mail(
                '%s Test Email' % (settings.EMAIL_SUBJECT_PREFIX,),
                body, settings.SERVER_EMAIL, [request.user.email],
                fail_silently=False
            )
        except Exception, e:
            form.errors['__all__'] = [unicode(e)]

    return render_to_response('sentry/admin/status/mail.html', {
        'form': form,
        'EMAIL_HOST': settings.EMAIL_HOST,
        'EMAIL_HOST_PASSWORD': bool(settings.EMAIL_HOST_PASSWORD),
        'EMAIL_HOST_USER': settings.EMAIL_HOST_USER,
        'EMAIL_PORT': settings.EMAIL_PORT,
        'EMAIL_USE_TLS': settings.EMAIL_USE_TLS,
        'SERVER_EMAIL': settings.SERVER_EMAIL,
    }, request)


@requires_admin
def stats(request):
    statistics = (
        ('Projects', Project.objects.count()),
        ('Projects (24h)', Project.objects.filter(
            date_added__gte=timezone.now() - datetime.timedelta(hours=24),
        ).count()),
        ('Events', GroupCountByMinute.objects.aggregate(x=Sum('times_seen'))['x'] or 0),
        ('Events (24h)', GroupCountByMinute.objects.filter(
            date__gte=timezone.now() - datetime.timedelta(hours=24),
        ).aggregate(x=Sum('times_seen'))['x'] or 0)
    )

    return render_to_response('sentry/admin/stats.html', {
        'statistics': statistics,
    }, request)
