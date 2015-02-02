"""
sentry.web.frontend.projects.keys
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import

from django.contrib import messages
from django.core.context_processors import csrf
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.http import require_http_methods
from django.utils.translation import ugettext_lazy as _

from sentry.constants import MEMBER_ADMIN
from sentry.models import (
    AuditLogEntry, AuditLogEntryEvent, ProjectKey, ProjectKeyStatus
)
from sentry.permissions import (
    can_remove_project_key, can_add_project_key, can_edit_project_key
)
from sentry.plugins import plugins
from sentry.web.decorators import has_access
from sentry.web.forms.projectkeys import EditProjectKeyForm
from sentry.web.helpers import render_to_response


@has_access(MEMBER_ADMIN)
@csrf_protect
def manage_project_keys(request, organization, project):
    result = plugins.first('has_perm', request.user, 'edit_project', project)
    if result is False and not request.user.is_superuser:
        return HttpResponseRedirect(reverse('sentry'))

    key_list = list(ProjectKey.objects.filter(
        project=project,
    ).select_related('user', 'user_added').order_by('-id'))

    for key in key_list:
        key.project = project
        key.can_remove = can_remove_project_key(request.user, key),
        key.can_edit = can_edit_project_key(request.user, key),

    context = csrf(request)
    context.update({
        'team': project.team,
        'organization': organization,
        'page': 'keys',
        'project': project,
        'key_list': key_list,
        'can_add_key': can_add_project_key(request.user, project),
    })

    return render_to_response('sentry/projects/keys.html', context, request)


@has_access(MEMBER_ADMIN)
@csrf_protect
def new_project_key(request, organization, project):
    if not can_add_project_key(request.user, project):
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

    key = ProjectKey.objects.create(
        project=project,
        user_added=request.user,
    )

    AuditLogEntry.objects.create(
        organization=organization,
        actor=request.user,
        ip_address=request.META['REMOTE_ADDR'],
        target_object=key.id,
        event=AuditLogEntryEvent.PROJECTKEY_ADD,
        data=key.get_audit_log_data(),
    )

    return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))


@has_access(MEMBER_ADMIN)
@csrf_protect
def edit_project_key(request, organization, project, key_id):
    try:
        key = ProjectKey.objects.get(
            id=key_id,
            project=project,
        )
    except ProjectKey.DoesNotExist():
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

    if not can_edit_project_key(request.user, key):
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

    form = EditProjectKeyForm(request.POST or None, instance=key)
    if form.is_valid():
        key = form.save()

        AuditLogEntry.objects.create(
            organization=organization,
            actor=request.user,
            ip_address=request.META['REMOTE_ADDR'],
            target_object=key.id,
            event=AuditLogEntryEvent.PROJECTKEY_EDIT,
            data=key.get_audit_log_data(),
        )

        messages.add_message(
            request, messages.SUCCESS,
            _('Changes to the API key (%s) were saved.') % (key.public_key,))
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

    context = {
        'organization': organization,
        'team': project.team,
        'project': project,
        'page': 'keys',
        'key': key,
        'form': form,
    }

    return render_to_response('sentry/projects/edit_key.html', context, request)


@require_http_methods(['POST'])
@has_access(MEMBER_ADMIN)
@csrf_protect
def remove_project_key(request, organization, project, key_id):
    try:
        key = ProjectKey.objects.get(id=key_id)
    except ProjectKey.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

    if not can_remove_project_key(request.user, key):
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

    audit_data = key.get_audit_log_data()

    key.delete()

    AuditLogEntry.objects.create(
        organization=organization,
        actor=request.user,
        ip_address=request.META['REMOTE_ADDR'],
        target_object=key.id,
        event=AuditLogEntryEvent.PROJECTKEY_REMOVE,
        data=audit_data,
    )

    messages.add_message(
        request, messages.SUCCESS,
        _('The API key (%s) was revoked.') % (key.public_key,))

    return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))


@require_http_methods(['POST'])
@has_access(MEMBER_ADMIN)
@csrf_protect
def disable_project_key(request, organization, project, key_id):
    try:
        key = ProjectKey.objects.get(id=key_id)
    except ProjectKey.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

    # we require removal permission for this
    if not can_edit_project_key(request.user, key):
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

    key.update(status=ProjectKeyStatus.INACTIVE)

    AuditLogEntry.objects.create(
        organization=organization,
        actor=request.user,
        ip_address=request.META['REMOTE_ADDR'],
        target_object=key.id,
        event=AuditLogEntryEvent.PROJECTKEY_DISABLE,
        data=key.get_audit_log_data(),
    )

    messages.add_message(
        request, messages.SUCCESS,
        _('The API key (%s) was disabled.') % (key.public_key,))

    return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))


@require_http_methods(['POST'])
@has_access(MEMBER_ADMIN)
@csrf_protect
def enable_project_key(request, organization, project, key_id):
    try:
        key = ProjectKey.objects.get(id=key_id)
    except ProjectKey.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

    # we require removal permission for this
    if not can_edit_project_key(request.user, key):
        return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))

    key.update(status=ProjectKeyStatus.ACTIVE)

    AuditLogEntry.objects.create(
        organization=organization,
        actor=request.user,
        ip_address=request.META['REMOTE_ADDR'],
        target_object=key.id,
        event=AuditLogEntryEvent.PROJECTKEY_ENABLE,
        data=key.get_audit_log_data(),
    )

    messages.add_message(
        request, messages.SUCCESS,
        _('The API key (%s) was enabled.') % (key.public_key,))

    return HttpResponseRedirect(reverse('sentry-manage-project-keys', args=[project.organization.slug, project.slug]))
