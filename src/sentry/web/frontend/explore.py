"""
sentry.web.frontend.explore
~~~~~~~~~~~~~~~~~~~~~~~~~~~

Contains views for the "Explore" section of Sentry.

:copyright: (c) 2010-2013 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from __future__ import division

from sentry.models import TagKey, TagValue, Group
from sentry.web.decorators import has_access
from sentry.web.helpers import render_to_response

DEFAULT_SORT_OPTION = 'recent'
SORT_OPTIONS = {
    'recent': 'Last Seen',
    'newest': 'First Seen',
    'events': 'Number of Events',
}


@has_access
def tag_list(request, team, project):
    tag_key_qs = sorted(TagKey.objects.filter(
        project=project
    ).exclude(key__startswith='sentry:'), key=lambda x: x.get_label())

    tag_value_qs = TagValue.objects.filter(
        project=project).order_by('-times_seen')

    # O(N) db access
    tag_list = []
    for tag_key in tag_key_qs:
        tag_list.append((tag_key, [
            (id, value, times_seen)
            for (id, value, times_seen)
            in tag_value_qs.filter(
                key=tag_key.key).values_list('id', 'value', 'times_seen')[:5]
        ]))

    return render_to_response('sentry/explore/tag_list.html', {
        'SECTION': 'explore',
        'project': project,
        'team': team,
        'tag_list': tag_list,
    }, request)


@has_access
def tag_value_list(request, team, project, key):
    tag_key = TagKey.objects.get(
        project=project, key=key)
    tag_values_qs = TagValue.objects.filter(
        project=project, key=key)

    sort = request.GET.get('sort')
    if sort not in SORT_OPTIONS:
        sort = DEFAULT_SORT_OPTION

    if sort == 'recent':
        tag_values_qs = tag_values_qs.order_by('-last_seen')
    elif sort == 'newest':
        tag_values_qs = tag_values_qs.order_by('-first_seen')
    elif sort == 'events':
        tag_values_qs = tag_values_qs.order_by('-times_seen')

    return render_to_response('sentry/explore/tag_value_list.html', {
        'SECTION': 'explore',
        'project': project,
        'team': team,
        'SORT_OPTIONS': SORT_OPTIONS,
        'sort_label': SORT_OPTIONS[sort],
        'tag_key': tag_key,
        'tag_values': tag_values_qs,
    }, request)


@has_access
def tag_value_details(request, team, project, key, value_id):
    tag_key = TagKey.objects.get(
        project=project, key=key)
    tag_value = TagValue.objects.get(
        project=project, key=key, id=value_id)

    event_list = Group.objects.filter(
        grouptag__key=key,
        grouptag__value=tag_value.value,
    ).order_by('-score')

    return render_to_response('sentry/explore/tag_value_details.html', {
        'SECTION': 'explore',
        'project': project,
        'team': team,
        'tag_key': tag_key,
        'tag_value': tag_value,
        'event_list': event_list,
    }, request)
