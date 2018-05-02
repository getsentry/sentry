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
    'members': {
        'id': 4,
        'cue': _('Tips for inviting your team'),
        'required_targets': ['member_add'],
        'steps': [
            {
                'title': _('Fix issues faster, together'),
                'message': _('Sentry isn\'t logs. It\'s about shipping faster by immediately '
                             'alerting, triaging, and assigning issues to the right engineer.'),
                'target': 'member_add',
            },
            {
                'title': _('Status'),
                'message': _('You can enforce <a href="/settings/${orgSlug}/#require2FA">2-factor auth</a> or '
                             '<a href="/settings/${orgSlug}/auth/">SSO</a> across your organization. Status lets you see '
                             'which members haven\'t configured them yet.'),
                'target': 'member_status',
            },
            {
                'title': _('Roles'),
                'message': _('Consider having two owners, in case one person\'s out, and you '
                             'need to adjust billing or a new hire.<br><br>'
                             'Add finance as a billing member. They\'ll get access to '
                             'invoices, so they won\'t email you for receipts.'),
                'target': 'member_role',
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
                'title': _('Reduce inbox noise'),
                'message': _('Sentry, by default, alerts on every <i>new</i> issue via email. '
                             'If that\'s too noisy, sending the new issue alerts to '
                             'a service like Slack help reduce inbox noise.<br><br> Enabling '
                             '<a href="https://sentry.io/settings/account/notifications/#weeklyReports" target="_blank">'
                             'weekly reports</a> can also help you stay on top of issues without '
                             'getting overwhelmed.'),
                'target': 'alert_conditions',
            },
            {
                'title': _('Define priority alerts'),
                'message': _('Not all alerts are created equal. Create rules for frequently occuring errors or specific '
                             'tags to escalate critical issues by alerting you via email or PagerDuty.<br><br>'
                             '<a href="https://blog.sentry.io/2017/10/12/proactive-alert-rules" target="_blank">Learn more</a> '
                             'about wrangling alerts.'),
                'target': 'alert_actions',
            },
            {
                'title': _('Fine-tune your personal settings'),
                'message': _('You can control alerts at the project <em>and</em> the user level. '
                             'If you\'d like to customize your <i>personal</i> alert settings, '
                             'go to <a href="/account/settings/notifications/" target="_blank">Account Notifications</a>. '
                             'There, you can choose which project\'s alert or workflow notifications you\'d like to receive.'),
                'target': None,
            },
            {
                'title': _('What are legacy integrations?'),
                'message': _('You can see what integrations are legacy or not in '
                             '<a href="/settings/${orgSlug}/${projectSlug}/plugins/" target="_blank">integration settings</a>. '
                             'If you want an alert rule to trigger both legacy and global '
                             'integrations, you need to add both as actions. '
                             '<a href="https://help.sentry.io/hc/en-us/articles/360003063454" target="_blank">Learn more</a>.'),
                'target': None,
            },
        ],
    },
}
