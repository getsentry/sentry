from __future__ import absolute_import

from .base import ActivityEmail


class NoteActivityEmail(ActivityEmail):
    def get_context(self):
        return {}

    def get_template(self):
        return "sentry/emails/activity/note.txt"

    def get_html_template(self):
        return "sentry/emails/activity/note.html"

    def get_category(self):
        return "note_activity_email"
