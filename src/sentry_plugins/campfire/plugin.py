# -*- coding: utf-8 -*-
"""
    campfire.plugin
    ~~~~~~~~~~~~~~~~~~~~~~

    This module enables Campfire notifications from Sentry
"""
from django import forms

from sentry.plugins.bases import notify
from sentry_plugins.camplight import Request, Campfire

import sentry


class CampfireOptionsForm(notify.NotificationConfigurationForm):
    url = forms.URLField(
        required=True, label="Campfire URL", help_text="e.g. https://your-subdomain.campfirenow.com"
    )
    token = forms.CharField(required=True, label="API Token")
    rooms = forms.CharField(
        required=True, help_text="Rooms to send notifications to, separated by comma"
    )
    sound = forms.CharField(
        initial="rimshot",
        help_text="Sound to play (e.g. rimshot, greatjob, tada, etc.). Defaults to rimshot.",
    )
    play_sound = forms.BooleanField(required=False)


class CampfirePlugin(notify.NotificationPlugin):
    title = "Campfire"
    slug = "campfire"
    description = "Send Campfire notifications"
    version = sentry.VERSION
    author = "Mustafa Khattab"
    author_url = "https://github.com/mkhattab/sentry-campfire"
    resource_links = [
        ("Bug Tracker", "https://github.com/mkhattab/sentry-campfire/issues"),
        ("Source", "https://github.com/mkhattab/sentry-campfire"),
    ]

    project_conf_form = CampfireOptionsForm

    def is_configured(self, project, **kwargs):
        return all(self.get_option(k, project) for k in ("url", "token", "rooms"))

    def notify_users(self, group, event, fail_silently=False, **kwargs):
        link = group.get_absolute_url()
        message = "[%s] %s (%s)" % (dict(event.get_tags()).get("server_name"), event.title, link)

        self.send_notification(event.project, message)

    def send_notification(self, project, message):
        url = self.get_option("url", project)
        token = self.get_option("token", project)
        rooms = self.get_option("rooms", project)
        play_sound = self.get_option("play_sound", project)
        sound = self.get_option("sound", project)

        # The appended slash causes a 404 error
        req = Request(url.strip("/"), token)
        campfire = Campfire(req)

        for r in rooms.split(","):
            if r:
                room = campfire.room(r)
                room.speak(message)
                if play_sound:
                    room.play(sound)
