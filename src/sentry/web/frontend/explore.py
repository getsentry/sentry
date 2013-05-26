"""
sentry.web.frontend.explore
~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.core.urlresolvers import reverse
from django.http import HttpResponseRedirect
from sentry.models import TagKey, TagValue, Group
from sentry.web.decorators import login_required, has_access
from sentry.web.helpers import render_to_response

DEFAULT_SORT_OPTION = 'recent'
SORT_OPTIONS = {
    'recent': 'Last Seen',
    'newest': 'First Seen',
    'events': 'Number of Events',
}


@has_access
@login_required
def list_tag(request, team, project, tag_name):
    try:
        tag = TagKey.objects.get(project=project, key=tag_name)
    except TagKey.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-stream', args=[team.slug, project.slug]))

    sort = request.GET.get('sort')
    if sort not in SORT_OPTIONS:
        sort = DEFAULT_SORT_OPTION

    tag_list = TagValue.objects.filter(project=project, key=tag_name)

    if sort == 'recent':
        tag_list = tag_list.order_by('-last_seen')
    elif sort == 'newest':
        tag_list = tag_list.order_by('-first_seen')
    elif sort == 'events':
        tag_list = tag_list.order_by('-times_seen')

    return render_to_response('sentry/explore/list_tag.html', {
        'team': team,
        'project': project,
        'tag': tag,
        'tag_list': tag_list,
        'sort_label': SORT_OPTIONS[sort],
        'SORT_OPTIONS': SORT_OPTIONS,
    }, request)


@has_access
@login_required
def tag_details(request, team, project, tag_name, tag_id):
    try:
        tag = TagKey.objects.get(project=project, key=tag_name)
    except TagKey.DoesNotExist:
        return HttpResponseRedirect(reverse('sentry-stream', args=[team.slug, project.slug]))

    tag_value = TagValue.objects.get(
        project=project,
        key=tag_name,
        id=tag_id,
    )

    event_list = Group.objects.filter(
        grouptag__project=project,
        grouptag__key=tag_name,
        grouptag__value=tag.value,
    )

    return render_to_response('sentry/explore/tag_details.html', {
        'team': team,
        'project': project,
        'tag': tag,
        'tag_value': tag_value,
        'event_list': event_list,
    }, request)
