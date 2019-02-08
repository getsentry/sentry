from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _


# Guide Schema
# id (text, required): unique id
# cue (text):  The text used to prompt the user to initiate the guide.
# required_targets (list): An empty list will cause the guide to be shown regardless
#                          of page/targets presence.
# steps (list): List of steps

# Step Schema
# title (text, required): Title text. Tone should be active.
# message (text, optional): Message text. Should help illustrate how to do a task, not
#                           just literally what the button does.
# target (text, optional): step is tied to an anchor target. If the anchor doesn't exist,
#                          the step will not be shown. if the anchor exists but is of type
#                         "invisible", it will not be pinged but will be scrolled to.
#                          otherwise the anchor will be pinged and scrolled to. If you'd like
#                          your step to show always or have a step is not tied to a specific
#                          element but you'd still like it to be shown, set this as None.
# guide_type (text, optional): "guide" or "tip" (defaults to guide). If it's a tip, the cue won't
#     be shown, and you should also specify the fields "cta_text" and "cta_link", which would
#     replace the "Was this guide useful" message at the end with the CTA and a dismiss button.
# cta_text (text, conditional): CTA button text on the last step of a tip. Must be present if
#     guide_type = tip.
# cta_link (text, conditional): Where the CTA button points to. Must be present if guide_type = tip.

GUIDES = {
    'issue': {
        'id': 1,
        'cue': _('Get a tour of the issue page'),
        'required_targets': ['exception'],
        'steps': [
            {
                'title': _('Stacktrace'),
                'message': _(
                    'See the sequence of function calls that led to the error, and in some cases '
                    'global/local variables for each stack frame.'),
                'target': 'exception',
            },
            {
                'title': _('Breadcrumbs'),
                'message': _(
                    'Breadcrumbs are a trail of events that happened prior to the error. They\'re '
                    'similar to traditional logs but can record more rich structured data. '
                    'When Sentry is used with web frameworks, breadcrumbs are automatically '
                    'captured for events like database calls and network requests.'),
                'target': 'breadcrumbs',
            },
            {
                'title': _('Tags'),
                'message': _(
                    'Tags are arbitrary key-value pairs you can send with an event. Events can be '
                    'filtered by tags, allowing you to do things like search for all events from '
                    'a specific machine, browser or release. The sidebar on the right shows you '
                    'the distribution of tags for all events in this event group.'),
                'target': 'tags',
            },
            {
                'title': _('Resolve'),
                'message': _(
                    'Resolving an issue removes it from the default dashboard view of unresolved '
                    'issues. You can ask Sentry to <a href="/settings/account/notifications/" target="_blank"> '
                    'alert you</a> when a resolved issue re-occurs.'),
                'target': 'resolve',
            },
            {
                'title': _('Issue Number'),
                'message': _(
                    'This is a unique identifier for the issue and can be included in a commit '
                    'message to tell Sentry to resolve the issue when the commit gets deployed. '
                    'See <a href="https://docs.sentry.io/learn/releases/" target="_blank">Releases</a> '
                    'to learn more.'),
                'target': 'issue_number',
            },
            {
                'title': _('Issue Tracking'),
                'message': _(
                    'Create issues in your project management tool from within Sentry. See a list '
                    'of all integrations <a href="https://docs.sentry.io/integrations/" target="_blank">here</a>.'),
                'target': 'issue_tracking',
            },
            {
                'title': _('Ignore, Delete and Discard'),
                'message': _(
                    'Ignoring an issue silences notifications and removes it from your feeds. '
                    'Deleting an issue deletes its data and causes a new issue to be created if it '
                    'happens again. Delete & Discard (available on the medium plan and higher) '
                    'deletes most of the issue\'s data and discards future events matching the '
                    'issue before they reach your stream. This is useful to permanently ignore '
                    'errors you don\'t care about.'),
                'target': 'ignore_delete_discard',
            },
            {
                'title': _('Owners'),
                'message': _(
                    'Define users or teams that are responsible for specific paths or URLS so '
                    'that notifications can be routed to the correct owner. Learn more '
                    '<a href="https://docs.sentry.io/learn/issue-owners/" target="_blank">here</a>.'),
                'target': 'owners',
            },
        ],
    },
    'releases': {
        'id': 2,
        'cue': _('What are releases?'),
        'required_targets': ['releases'],
        'steps': [
            {
                'title': _('Releases'),
                'message': _('A release is a specific version of your code deployed to an '
                             'environment. When you tell Sentry about your releases, it can '
                             'predict which commits caused an error and who might be a likely '
                             'owner.'),
                'target': 'releases',
            },
            {
                'title': _('Releases'),
                'message': _('Sentry does this by tying together commits in the release, files '
                             'touched by those commits, files observed in the stacktrace, and '
                             'authors of those files. Learn more about releases '
                             '<a href="https://docs.sentry.io/learn/releases/" target="_blank">here</a>.'),
                'target': 'releases',
            },
        ]
    },

    'event_issue': {
        'id': 3,
        'cue': _('Learn about the issue stream'),
        'required_targets': ['issues'],
        'steps': [
            {
                'title': _('Events'),
                'message': _(
                    'When your application throws an error, that error is captured by Sentry as an event.'),
                'target': 'events',
            },
            {
                'title': _('Issues'),
                'message': _(
                    'Individual events are then automatically rolled up and grouped into Issues with other similar events. '
                    'A single issue can represent anywhere from one to thousands of individual events, depending on how many '
                    'times a specific error is thrown. '),
                'target': 'issues',
            },
            {
                'title': _('Users'),
                'message': _(
                    'Sending user data to Sentry will unlock a number of features, primarily the ability to drill '
                    'down into the number of users affected by an issue. '
                    'Learn how easy it is to '
                    '<a href="https://docs.sentry.io/learn/context/#capturing-the-user" target="_blank">set this up </a>today.'),
                'target': 'users',
            },
        ]
    },
    # Ideally, this would only be sent if the organization has never
    # customized alert rules (as per FeatureAdoption)
    'alert_rules': {
        'id': 5,
        'cue': _('Tips for alert rules'),
        'required_targets': ['alert_conditions'],
        'steps': [
            {
                'title': _('Reduce Inbox Noise'),
                'message': _('Sentry, by default, alerts on every new issue via email. '
                             'If that\'s too noisy, send the alerts to a service like Slack to '
                             'reduce inbox noise.<br><br> Enabling <a href="https://sentry.io/settings/account/notifications/#weeklyReports" target="_blank">'
                             'weekly reports</a> can also help you stay on top of issues without '
                             'getting overwhelmed.'),
                'target': 'alert_conditions',
            },
            {
                'title': _('Prioritize Alerts'),
                'message': _('Not all alerts are equally important. Send the important ones to a '
                             'service like PagerDuty. <a href="https://blog.sentry.io/2017/10/12/proactive-alert-rules" target="_blank">Learn more</a> '
                             'about prioritizing alerts.'),
                'target': 'alert_actions',
            },
            {
                'title': _('Fine-tune notifications'),
                'message': _('You can control alerts both at the project and the user level. '
                             'Go to <a href="/account/settings/notifications/" target="_blank">Account Notifications</a> '
                             'to choose which project\'s alert or workflow notifications you\'d like to receive.'),
                'target': None,
            },
        ],
    },
    'alert_reminder_1': {
        'id': 6,
        'guide_type': 'tip',
        'required_targets': ['project_details'],
        'steps': [
            {
                'title': _('Alert Rules'),
                'message': _('This project received ${numEvents} events in the last 30 days but doesn\'t have '
                             'custom alerts. Customizing alerts gives you more control over how you get '
                             'notified of issues. Learn more <a href="https://sentry.io/_/resources/customer-success/alert-rules/?referrer=assistant" target="_blank">here</a>.'),
                'target': 'project_details',
            },
        ],
        'cta_text': _('Customize Alerts'),
        'cta_link': '/settings/${orgSlug}/projects/${projectSlug}/alerts/rules/',
    },
}
