"""
sentry.web.frontend.admin
~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import absolute_import, print_function

import six
from django.core.context_processors import csrf
from django.http import HttpResponse, HttpResponseRedirect
from django.views.decorators.csrf import csrf_protect

from sentry.models import Project, User
from sentry.plugins import plugins
from sentry.utils.http import absolute_uri
from sentry.web.decorators import requires_admin
from sentry.web.forms import (ChangeUserForm, RemoveUserForm)
from sentry.utils import auth
from sentry.web.helpers import render_to_response


def configure_plugin(request, slug):
    plugin = plugins.get(slug)
    if not plugin.has_site_conf():
        return HttpResponseRedirect(auth.get_login_url())

    view = plugin.configure(request=request)
    if isinstance(view, HttpResponse):
        return view

    return render_to_response(
        'sentry/admin/plugins/configure.html', {
            'plugin': plugin,
            'title': plugin.get_conf_title(),
            'slug': plugin.slug,
            'view': view,
        }, request
    )


@requires_admin
@csrf_protect
def edit_user(request, user_id):
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
