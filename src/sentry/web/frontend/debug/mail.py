from __future__ import absolute_import, print_function

import itertools
import logging
import six
import time
import traceback
import uuid

from datetime import (
    datetime,
    timedelta,
)
from django.contrib.webdesign.lorem_ipsum import WORDS
from django.core.urlresolvers import reverse
from django.utils import timezone
from django.utils.safestring import mark_safe
from django.views.generic import View
from random import Random

from sentry.constants import LOG_LEVELS
from sentry.digests import Record
from sentry.digests.notifications import (
    Notification,
    build_digest,
)
from sentry.digests.utilities import get_digest_metadata
from sentry.http import get_server_hostname
from sentry.models import (
    Activity,
    Event,
    Group,
    GroupStatus,
    Organization,
    OrganizationMember,
    Project,
    Rule,
    Team,
)
from sentry.plugins.sentry_mail.activity import emails
from sentry.utils.dates import to_datetime, to_timestamp
from sentry.utils.samples import load_data
from sentry.utils.email import inline_css
from sentry.utils.http import absolute_uri
from sentry.web.decorators import login_required
from sentry.web.helpers import render_to_response, render_to_string

logger = logging.getLogger(__name__)


def get_random(request):
    seed = request.GET.get('seed', six.text_type(time.time()))
    return Random(seed)


def make_message(random, length=None):
    if length is None:
        length = int(random.weibullvariate(8, 3))
    return ' '.join(random.choice(WORDS) for _ in range(length))


def make_culprit(random):
    def make_module_path_components(min, max):
        for _ in range(random.randint(min, max)):
            yield ''.join(random.sample(WORDS, random.randint(1, int(random.paretovariate(2.2)))))

    return '{module} in {function}'.format(
        module='.'.join(make_module_path_components(1, 4)),
        function=random.choice(WORDS)
    )


def make_group_metadata(random, group):
    return {
        'type': 'error',
        'metadata': {
            'type': '{}Error'.format(
                ''.join(word.title() for word in random.sample(WORDS, random.randint(1, 3))),
            ),
            'value': make_message(random),
        }
    }


def make_group_generator(random, project):
    epoch = to_timestamp(datetime(2016, 6, 1, 0, 0, 0, tzinfo=timezone.utc))
    for id in itertools.count(1):
        first_seen = epoch + random.randint(0, 60 * 60 * 24 * 30)
        last_seen = random.randint(first_seen, first_seen + (60 * 60 * 24 * 30))

        group = Group(
            id=id,
            project=project,
            culprit=make_culprit(random),
            level=random.choice(LOG_LEVELS.keys()),
            message=make_message(random),
            first_seen=to_datetime(first_seen),
            last_seen=to_datetime(last_seen),
            status=random.choice((
                GroupStatus.UNRESOLVED,
                GroupStatus.RESOLVED,
            )),
        )

        if random.random() < 0.8:
            group.data = make_group_metadata(random, group)

        yield group


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

    def render(self, request):
        return render_to_response('sentry/debug/mail/preview.html', {
            'preview': self,
            'format': request.GET.get('format'),
        })


class ActivityMailPreview(object):
    def __init__(self, activity):
        self.email = emails.get(activity.type)(activity)

    def get_context(self):
        context = self.email.get_base_context()
        context.update(self.email.get_context())
        return context

    def text_body(self):
        return render_to_string(self.email.get_template(), self.get_context())

    def html_body(self):
        try:
            return inline_css(render_to_string(
                self.email.get_html_template(), self.get_context()))
        except Exception:
            import traceback
            traceback.print_exc()
            raise


class ActivityMailDebugView(View):
    def get(self, request):
        org = Organization(
            id=1,
            slug='organization',
            name='My Company',
        )
        team = Team(
            id=1,
            slug='team',
            name='My Team',
            organization=org,
        )
        project = Project(
            id=1,
            organization=org,
            team=team,
            slug='project',
            name='My Project',
        )

        group = next(
            make_group_generator(
                get_random(request),
                project,
            ),
        )

        event = Event(
            id=1,
            project=project,
            group=group,
            message=group.message,
            data=load_data('python'),
            datetime=datetime(2016, 6, 13, 3, 8, 24, tzinfo=timezone.utc),
        )

        activity = Activity(
            group=event.group, project=event.project,
            **self.get_activity(request, event)
        )

        return render_to_response('sentry/debug/mail/preview.html', {
            'preview': ActivityMailPreview(activity),
            'format': request.GET.get('format'),
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

    random = get_random(request)
    group = next(
        make_group_generator(random, project),
    )

    event = Event(
        id=1,
        project=project,
        group=group,
        message=group.message,
        data=load_data(platform),
        datetime=to_datetime(
            random.randint(
                to_timestamp(group.first_seen),
                to_timestamp(group.last_seen),
            ),
        ),
    )

    rule = Rule(label="An example rule")

    interface_list = []
    for interface in six.itervalues(event.interfaces):
        body = interface.to_email_html(event)
        if not body:
            continue
        interface_list.append((interface.get_title(), mark_safe(body)))

    return MailPreview(
        html_template='sentry/emails/error.html',
        text_template='sentry/emails/error.txt',
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
    ).render(request)


@login_required
def digest(request):
    random = get_random(request)

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
    ) for i in range(1, random.randint(2, 4))}

    state = {
        'project': project,
        'groups': {},
        'rules': rules,
        'event_counts': {},
        'user_counts': {},
    }

    records = []

    event_sequence = itertools.count(1)
    group_generator = make_group_generator(random, project)

    for i in range(random.randint(1, 30)):
        group = next(group_generator)
        state['groups'][group.id] = group

        offset = timedelta(seconds=0)
        for i in range(random.randint(1, 10)):
            offset += timedelta(seconds=random.random() * 120)
            event = Event(
                id=next(event_sequence),
                event_id=uuid.uuid4().hex,
                project=project,
                group=group,
                message=group.message,
                data=load_data('python'),
                datetime=to_datetime(
                    random.randint(
                        to_timestamp(group.first_seen),
                        to_timestamp(group.last_seen),
                    ),
                )
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

            state['event_counts'][group.id] = random.randint(10, 1e4)
            state['user_counts'][group.id] = random.randint(10, 1e4)

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
    ).render(request)


@login_required
def report(request):
    from sentry.tasks import reports

    random = get_random(request)

    duration = 60 * 60 * 24 * 7
    timestamp = random.randint(
        to_timestamp(datetime(2016, 6, 1, 0, 0, 0, tzinfo=timezone.utc)),
        to_timestamp(datetime(2016, 7, 1, 0, 0, 0, tzinfo=timezone.utc)),
    )

    organization = Organization(
        id=1,
        slug='example',
        name='Example',
    )

    team = Team(
        id=1,
        slug='example',
        name='Example',
        organization=organization,
    )

    project = Project(
        id=1,
        organization=organization,
        team=team,
        slug='project',
        name='My Project',
    )

    start, stop = reports._to_interval(timestamp, duration)

    group_instances = {}

    def fetch_group_instances(id_list):
        results = {}
        for id in id_list:
            instance = group_instances.get(id)
            if instance is not None:
                results[id] = instance
        return results

    group_generator = make_group_generator(random, project)

    def make_group_id_generator():
        while True:
            group = next(group_generator)
            if random.random() < 0.95:
                group_instances[group.id] = group
            yield group.id

    group_id_sequence = make_group_id_generator()

    def build_issue_list():
        count = random.randint(0, int(random.paretovariate(0.4)))
        return count, [(
            next(group_id_sequence),
            (
                int(random.paretovariate(0.3)),
                int(random.paretovariate(0.3)),
            ),
        ) for _ in xrange(0, min(count, 5))]

    def build_report():
        daily_maximum = random.randint(1000, 10000)

        rollup = 60 * 60 * 24
        series = [(
            timestamp + (i * rollup),
            (random.randint(0, daily_maximum), random.randint(0, daily_maximum))
        ) for i in xrange(0, 7)]

        aggregates = [
            random.randint(0, daily_maximum * 7) if random.random() < 0.9 else None for _ in xrange(0, 4)
        ]

        return series, aggregates, build_issue_list()

    report = reduce(
        reports.merge_reports,
        [build_report() for _ in xrange(0, random.randint(1, 3))]
    )

    if random.random() < 0.85:
        personal = {
            'resolved': random.randint(0, 100),
            'users': int(random.paretovariate(0.2)),
        }
    else:
        personal = {
            'resolved': 0,
            'users': 0,
        }

    return MailPreview(
        html_template='sentry/emails/reports/body.html',
        text_template='sentry/emails/reports/body.txt',
        context={
            'duration': reports.durations[duration],
            'interval': {
                'start': reports.date_format(start),
                'stop': reports.date_format(stop),
            },
            'report': reports.to_context(
                report,
                fetch_group_instances,
            ),
            'organization': organization,
            'personal': personal,
            'user': request.user,
        },
    ).render(request)


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
    ).render(request)


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
    ).render(request)


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
    ).render(request)


@login_required
def confirm_email(request):
    email = request.user.emails.first()
    email.set_hash()
    email.save()
    return MailPreview(
        html_template='sentry/emails/confirm_email.html',
        text_template='sentry/emails/confirm_email.txt',
        context={
            'confirm_email': 'foo@example.com',
            'user': request.user,
            'url': absolute_uri(reverse(
                'sentry-account-confirm-email',
                args=[request.user.id, email.validation_hash]
            )),
            'is_new_user': True,
        },
    ).render(request)


@login_required
def recover_account(request):
    return MailPreview(
        html_template='sentry/emails/recover_account.html',
        text_template='sentry/emails/recover_account.txt',
        context={
            'user': request.user,
            'url': absolute_uri(reverse(
                'sentry-account-confirm-email',
                args=[request.user.id, 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX']
            )),
            'domain': get_server_hostname(),
        },
    ).render(request)
