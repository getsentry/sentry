from __future__ import absolute_import, print_function

import logging

from django.utils.safestring import mark_safe

from sentry.models import Activity, Event, Group, Project, Rule, Team
from sentry.utils.samples import load_data
from sentry.utils.email import inline_css
from sentry.web.decorators import login_required
from sentry.web.helpers import render_to_response, render_to_string


# TODO(dcramer): use https://github.com/disqus/django-mailviews
class MailPreview(object):
    def __init__(self, html_template, text_template, context):
        self.html_template = html_template
        self.text_template = text_template
        self.context = context

    def text_body(self):
        return render_to_string(self.text_template, self.context)

    def html_body(self):
        return inline_css(render_to_string(self.html_template, self.context))


@login_required
def new_event(request):
    team = Team(
        id=1,
        slug='example',
        name='Example',
    )
    project = Project(
        id=1,
        slug='example',
        name='Example',
        team=team,
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

    preview = MailPreview(
        html_template='sentry/emails/error.html',
        text_template='sentry/emails/error.html',
        context={
            'rule': rule,
            'group': group,
            'event': event,
            'link': 'http://example.com/link',
            'interfaces': interface_list,
            'tags': event.get_tags(),
        },
    )

    return render_to_response('sentry/debug/mail/preview.html', {
        'preview': preview,
    })


@login_required
def new_note(request):
    team = Team(
        id=1,
        slug='example',
        name='Example',
    )
    project = Project(
        id=1,
        slug='example',
        name='Example',
        team=team,
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

    preview = MailPreview(
        html_template='sentry/emails/new_note.html',
        text_template='sentry/emails/new_note.txt',
        context={
            'text': note.data['text'],
            'author': note.user,
            'date': note.datetime,
            'group': group,
            'link': group.get_absolute_url(),
        },
    )

    return render_to_response('sentry/debug/mail/preview.html', {
        'preview': preview,
    })
