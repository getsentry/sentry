from __future__ import absolute_import, print_function

import itertools
import logging
import time
import traceback
import uuid
from datetime import (
    datetime,
    timedelta,
)
from random import Random

import pytz

from django.contrib.webdesign.lorem_ipsum import (
    WORDS,
    words,
)
from django.core.urlresolvers import reverse
from django.utils.safestring import mark_safe

from sentry.constants import LOG_LEVELS
from sentry.digests import Record
from sentry.digests.notifications import (
    Notification,
    build_digest,
)
from sentry.digests.utilities import get_digest_metadata
from sentry.models import (
    Activity,
    Event,
    Group,
    Organization,
    OrganizationMember,
    Project,
    Rule,
    Team,
)
from sentry.utils.dates import to_timestamp
from sentry.utils.samples import load_data
from sentry.utils.email import inline_css
from sentry.utils.http import absolute_uri
from sentry.web.decorators import login_required
from sentry.web.helpers import render_to_response, render_to_string


logger = logging.getLogger(__name__)


# TODO(dcramer): use https://github.com/disqus/django-mailviews
class MailPreview(object):
    def __init__(self, html_template, text_template, context=None):
        self.html_template = html_template
        self.text_template = text_template
        self.context = context if context is not None else {}

    def text_body(self):
        return render_to_string(self.text_template, self.context)

    def html_body(self):
        try:
            return inline_css(render_to_string(self.html_template, self.context))
        except Exception:
            traceback.print_exc()
            raise

    def render(self):
        return render_to_response('sentry/debug/mail/preview.html', {
            'preview': self,
        })


@login_required
def new_event(request):
    platform = request.GET.get('platform', 'python')
    org = Organization(
        id=1,
        slug='example',
        name='Example',
    )
    team = Team(
        id=1,
        slug='example',
        name='Example',
        organization=org,
    )
    project = Project(
        id=1,
        slug='example',
        name='Example',
        team=team,
        organization=org,
    )
    group = Group(
        id=1,
        project=project,
        message='This is an example event.',
        level=logging.ERROR,
    )

    event = Event(
        id=1,
        project=project,
        group=group,
        message=group.message,
        data=load_data(platform),
    )

    rule = Rule(label="An example rule")

    interface_list = []
    for interface in event.interfaces.itervalues():
        body = interface.to_email_html(event)
        if not body:
            continue
        interface_list.append((interface.get_title(), mark_safe(body)))

    return MailPreview(
        html_template='sentry/emails/error.html',
        text_template='sentry/emails/error.html',
        context={
            'rule': rule,
            'group': group,
            'event': event,
            'link': 'http://example.com/link',
            'interfaces': interface_list,
            'tags': event.get_tags(),
            'project_label': project.name,
            'tags': [
                ('logger', 'javascript'),
                ('environment', 'prod'),
                ('level', 'error'),
                ('device', 'Other')
            ]
        },
    ).render()


@login_required
def new_note(request):

    org = Organization(
        id=1,
        slug='example',
        name='Example',
    )
    team = Team(
        id=1,
        slug='example',
        name='Example',
        organization=org,
    )
    project = Project(
        id=1,
        slug='example',
        name='Example',
        team=team,
        organization=org,
    )
    group = Group(
        id=1,
        project=project,
        message='This is an example event.',
    )
    event = Event(
        id=1,
        project=project,
        group=group,
        message=group.message,
        data=load_data('python'),
    )
    note = Activity(
        group=event.group, project=event.project,
        type=Activity.NOTE, user=request.user,
        data={'text': 'This is an example note!'},
    )

    return MailPreview(
        html_template='sentry/emails/activity/note.html',
        text_template='sentry/emails/activity/note.txt',
        context={
            'data': note.data,
            'author': note.user,
            'date': note.datetime,
            'group': group,
            'link': group.get_absolute_url(),
        },
    ).render()


@login_required
def assigned(request):

    org = Organization(
        id=1,
        slug='example',
        name='Example',
    )
    team = Team(
        id=1,
        slug='example',
        name='Example',
        organization=org,
    )
    project = Project(
        id=1,
        slug='example',
        name='Example',
        team=team,
        organization=org,
    )
    group = Group(
        id=1,
        project=project,
        message='This is an example event.',
    )
    event = Event(
        id=1,
        project=project,
        group=group,
        message=group.message,
        data=load_data('python'),
    )
    assigned = Activity(
        group=event.group, project=event.project,
        type=Activity.ASSIGNED, user=request.user,
        data={'text': 'This is an example note!', 'assignee': 'foo@example.com'},
    )

    return MailPreview(
        html_template='sentry/emails/activity/assigned.html',
        text_template='sentry/emails/activity/assigned.txt',
        context={
            'data': assigned.data,
            'author': assigned.user,
            'date': assigned.datetime,
            'group': group,
            'link': group.get_absolute_url(),
        },
    ).render()


@login_required
def digest(request):
    seed = request.GET.get('seed', str(time.time()))
    logger.debug('Using random seed value: %s')
    random = Random(seed)

    now = datetime.utcnow().replace(tzinfo=pytz.utc)

    # TODO: Refactor all of these into something more manageable.
    org = Organization(
        id=1,
        slug='example',
        name='Example Organization',
    )

    team = Team(
        id=1,
        slug='example',
        name='Example Team',
        organization=org,
    )

    project = Project(
        id=1,
        slug='example',
        name='Example Project',
        team=team,
        organization=org,
    )

    rules = {i: Rule(
        id=i,
        project=project,
        label="Rule #%s" % (i,),
    ) for i in xrange(1, random.randint(2, 4))}

    state = {
        'project': project,
        'groups': {},
        'rules': rules,
        'event_counts': {},
        'user_counts': {},
    }

    records = []

    group_sequence = itertools.count(1)
    event_sequence = itertools.count(1)

    for i in xrange(random.randint(1, 30)):
        group_id = next(group_sequence)

        culprit = '{module} in {function}'.format(
            module='.'.join(
                ''.join(random.sample(WORDS, random.randint(1, int(random.paretovariate(2.2))))) for word in xrange(1, 4)
            ),
            function=random.choice(WORDS)
        )
        group = state['groups'][group_id] = Group(
            id=group_id,
            project=project,
            message=words(int(random.weibullvariate(8, 4)), common=False),
            culprit=culprit,
            level=random.choice(LOG_LEVELS.keys()),
        )

        offset = timedelta(seconds=0)
        for i in xrange(random.randint(1, 10)):
            offset += timedelta(seconds=random.random() * 120)
            event = Event(
                id=next(event_sequence),
                event_id=uuid.uuid4().hex,
                project=project,
                group=group,
                message=group.message,
                data=load_data('python'),
                datetime=now - offset,
            )

            records.append(
                Record(
                    event.event_id,
                    Notification(
                        event,
                        random.sample(state['rules'], random.randint(1, len(state['rules']))),
                    ),
                    to_timestamp(event.datetime),
                )
            )

            state['event_counts'][group_id] = random.randint(10, 1e4)
            state['user_counts'][group_id] = random.randint(10, 1e4)

    digest = build_digest(project, records, state)
    start, end, counts = get_digest_metadata(digest)

    return MailPreview(
        html_template='sentry/emails/digests/body.html',
        text_template='sentry/emails/digests/body.txt',
        context={
            'project': project,
            'counts': counts,
            'digest': digest,
            'start': start,
            'end': end,
        },
    ).render()


@login_required
def request_access(request):
    org = Organization(
        id=1,
        slug='example',
        name='Example',
    )
    team = Team(
        id=1,
        slug='example',
        name='Example',
        organization=org,
    )

    return MailPreview(
        html_template='sentry/emails/request-team-access.html',
        text_template='sentry/emails/request-team-access.txt',
        context={
            'email': 'foo@example.com',
            'name': 'George Bush',
            'organization': org,
            'team': team,
            'url': absolute_uri(reverse('sentry-organization-members', kwargs={
                'organization_slug': org.slug,
            }) + '?ref=access-requests'),
        },
    ).render()


@login_required
def invitation(request):
    org = Organization(
        id=1,
        slug='example',
        name='Example',
    )
    om = OrganizationMember(
        id=1,
        email='foo@example.com',
        organization=org,
    )

    return MailPreview(
        html_template='sentry/emails/member-invite.html',
        text_template='sentry/emails/member-invite.txt',
        context={
            'email': 'foo@example.com',
            'organization': org,
            'url': absolute_uri(reverse('sentry-accept-invite', kwargs={
                'member_id': om.id,
                'token': om.token,
            })),
        },
    ).render()


@login_required
def access_approved(request):
    org = Organization(
        id=1,
        slug='example',
        name='Example',
    )
    team = Team(
        id=1,
        slug='example',
        name='Example',
        organization=org,
    )

    return MailPreview(
        html_template='sentry/emails/access-approved.html',
        text_template='sentry/emails/access-approved.txt',
        context={
            'email': 'foo@example.com',
            'name': 'George Bush',
            'organization': org,
            'team': team,
        },
    ).render()
