"""
sentry.web.frontend.generic
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
import datetime
import pkg_resources
import sys
import uuid

from django.contrib.auth.models import User
from django.core.context_processors import csrf
from django.core.mail import send_mail
from django.core.urlresolvers import reverse
from django.db import transaction
from django.db.models import Sum, Count, Max
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect
from djkombu.models import Queue

from sentry import environment
from sentry.conf import settings
from sentry.models import Project, MessageCountByMinute
from sentry.plugins import plugins
from sentry.web.forms import NewUserForm, ChangeUserForm, RemoveUserForm
from sentry.web.decorators import requires_admin
from sentry.web.helpers import render_to_response, plugin_config, \
  render_to_string


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
    ).exclude(
        projectcountbyminute__date__lte=datetime.datetime.now() - datetime.timedelta(days=30),
    ).annotate(
        last_event=Max('messagecountbyminute__date'),
        avg_events_per_n=Sum('projectcountbyminute__times_seen'),
        n_value=Count('projectcountbyminute__times_seen')
    ).select_related('owner').order_by('-date_added')

    context = {
        'project_list': project_list,
    }

    return render_to_response('sentry/admin/projects/list.html', context, request)


@requires_admin
def manage_users(request):
    users = User.objects.annotate(num_projects=Count('sentry_project_set'))\
                .order_by('-date_joined')

    return render_to_response('sentry/admin/users/list.html', {
        'user_list': users,
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
                name='New Project',
            )
            member = project.member_set.get()

        if form.cleaned_data['send_welcome_mail']:
            context = {
                'username': user.username,
                'password': password,
                'url': request.build_absolute_uri(reverse('sentry')),
            }
            if form.cleaned_data['create_project']:
                context.update({
                    'project': project,
                    'member': member,
                    'dsn': member.get_dsn(request.get_host(), secure=request.is_secure()),
                })
            body = render_to_string('sentry/emails/welcome_mail.txt', context, request)

            send_mail('%s Welcome to Sentry' % (settings.EMAIL_SUBJECT_PREFIX,),
                body, settings.SERVER_EMAIL, [user.email],
                fail_silently=True)

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

    context = {
        'form': form,
        'the_user': user,
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
    ).exclude(
        projectcountbyminute__date__lte=datetime.datetime.now() - datetime.timedelta(days=30),
    ).annotate(
        last_event=Max('messagecountbyminute__date'),
        avg_events_per_n=Sum('projectcountbyminute__times_seen'),
        n_value=Count('projectcountbyminute__times_seen')
    ).order_by('-date_added')

    context = {
        'project_list': project_list,
        'the_user': user,
    }

    return render_to_response('sentry/admin/users/list_projects.html', context, request)


@requires_admin
def status_env(request):
    config = []
    for k in sorted(dir(settings)):
        if k == 'KEY':
            continue
        if k.startswith('_'):
            continue
        if k.upper() != k:
            continue
        config.append((k, getattr(settings, k)))

    return render_to_response('sentry/admin/status/env.html', {
        'python_version': sys.version,
        'config': config,
        'environment': environment,
    }, request)


@requires_admin
def status_packages(request):
    from sentry.views import View

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
        'views': [(x.__class__.__name__, x.__module__) for x in View.objects.all()],
    }, request)


@requires_admin
def status_queue(request):
    worker_status = (settings.QUEUE['transport'] == 'djkombu.transport.DatabaseTransport')
    if worker_status:
        pending_tasks = list(Queue.objects.filter(
            messages__visible=True,
        ).annotate(num=Sum('messages__id')).values_list('name', 'num'))
        # fetch queues which had no pending tasks
        pending_tasks.extend((q, 0) for q in Queue.objects.exclude(
            name__in=[p[0] for p in pending_tasks],
        ).values_list('name', flat=True))
    else:
        pending_tasks = None

    return render_to_response('sentry/admin/status/queue.html', {
        'pending_tasks': pending_tasks,
        'worker_status': worker_status,
    }, request)


@requires_admin
def stats(request):
    statistics = (
        ('Projects', Project.objects.count()),
        ('Projects (24h)', Project.objects.filter(
            date_added__gte=datetime.datetime.now() - datetime.timedelta(hours=24),
        ).count()),
        ('Events', MessageCountByMinute.objects.aggregate(x=Sum('times_seen'))['x'] or 0),
        ('Events (24h)', MessageCountByMinute.objects.filter(
            date__gte=datetime.datetime.now() - datetime.timedelta(hours=24),
        ).aggregate(x=Sum('times_seen'))['x'] or 0)
    )

    return render_to_response('sentry/admin/stats.html', {
        'statistics': statistics,
    }, request)
