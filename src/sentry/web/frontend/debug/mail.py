from __future__ import absolute_import, print_function

import itertools
import logging
import time
import traceback
from datetime import (
    datetime,
    timedelta,
)
from random import Random

import pytz

from django.core.urlresolvers import reverse
from django.utils.safestring import mark_safe

from sentry.digests.notifications import (
    build_digest,
    event_to_record,
)
from sentry.models import (
    Activity, Event, Group, Organization, Project, Rule, Team,
)
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
        data=load_data('python'),
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
        group=event.group, event=event, project=event.project,
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
def digest(request):
    seed = request.GET.get('seed', str(time.time()))
    logger.debug('Using random seed value: %s')

    random = Random(seed)

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

    now = datetime.utcnow().replace(tzinfo=pytz.utc)

    rules = [
        Rule(id=1, label="First Rule"),
        Rule(id=2, label="Second Rule"),
        Rule(id=3, label="Third Rule"),
    ]

    records = []

    event_sequence = itertools.count(1)
    for i in xrange(random.randint(1, 4)):
        group = Group(
            id=i + 1,
            project=project,
            message='This is example event #%s' % (i + 1),
        )

        offset = timedelta(seconds=0)
        for i in xrange(random.randint(1, 10)):
            offset += timedelta(seconds=random.random() * 120)
            records.append(
                event_to_record(
                    Event(
                        id=next(itertools.count()),
                        project=project,
                        group=group,
                        message=group.message,
                        data=load_data('python'),
                        datetime=now - offset,
                    ),
                    random.sample(rules, random.randint(1, len(rules))),
                    clean=lambda i: i,
                )
            )

    digest = build_digest(project, records)

    return MailPreview(
        html_template='sentry/emails/digests/body.html',
        text_template='sentry/emails/digests/body.txt',
        context={
            'project': project,
            'digest': digest,
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
