from django.utils.safestring import mark_safe

from sentry.models import Event, Group, Project, Team
from sentry.utils.samples import load_data
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
        return render_to_string(self.html_template, self.context)


def new_event(request):
    team = Team(
        slug='example',
    )
    project = Project(
        slug='example',
        team=team,
    )
    group = Group(
        project=project,
        message='This is an example event.',
    )

    event = Event(
        project=project,
        group=group,
        message=group.message,
        data=load_data('python'),
    )

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
            'group': group,
            'event': event,
            'link': '#link',
            'interfaces': interface_list,
            'settings_link': '#settings-link',
        },
    )

    return render_to_response('sentry/debug/mail/preview.html', {
        'preview': preview,
    })
