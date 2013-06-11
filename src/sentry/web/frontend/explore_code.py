"""
sentry.web.frontend.explore_code
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2012 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from sentry.models import TagValue, Group
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
def list_tag(request, team, project, selection):
    assert selection in ('filenames', 'functions')

    tag_name = selection[:-1]

    sort = request.GET.get('sort')
    if sort not in SORT_OPTIONS:
        sort = DEFAULT_SORT_OPTION

    tag_list = TagValue.objects.filter(project=project, key='sentry:%s' % (tag_name,))

    if sort == 'recent':
        tag_list = tag_list.order_by('-last_seen')
    elif sort == 'newest':
        tag_list = tag_list.order_by('-first_seen')
    elif sort == 'events':
        tag_list = tag_list.order_by('-times_seen')

    return render_to_response('sentry/explore/code/list_tag.html', {
        'team': team,
        'project': project,
        'tag_list': tag_list,
        'selection': selection,
        'sort_label': SORT_OPTIONS[sort],
        'SORT_OPTIONS': SORT_OPTIONS,
    }, request)


@has_access
@login_required
def tag_details(request, team, project, selection, tag_id):
    assert selection in ('filenames', 'functions')

    tag_name = selection[:-1]

    tag = TagValue.objects.get(
        project=project,
        key='sentry:%s' % (tag_name,),
        id=tag_id,
    )

    event_list = Group.objects.filter(
        grouptag__project=project,
        grouptag__key='sentry:%s' % (tag_name,),
        grouptag__value=tag.value,
    )

    return render_to_response('sentry/explore/code/tag_details.html', {
        'team': team,
        'project': project,
        'tag': tag,
        'selection': selection,
        'event_list': event_list,
    }, request)
