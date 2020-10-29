# -*- coding: utf8 -*-

from __future__ import absolute_import, print_function

import re

# Sentry colors taken from our design system. Might not look good on all
# termianl themes tbh
COLORS = {
    "white": (255, 255, 255),
    "green": (77, 199, 13),
    "orange": (255, 119, 56),
    "red": (250, 71, 71),
}

SERVICE_COLORS = {
    "server": (108, 95, 199),
    "worker": (255, 194, 39),
    "webpack": (61, 116, 219),
    "cron": (255, 86, 124),
    "relay": (250, 71, 71),
}


def colorize_code(pattern):
    code = int(pattern.group("code"))
    method = pattern.group("method")

    style = (COLORS["red"], COLORS["white"])

    if code >= 200 and code < 300:
        style = (COLORS["green"], COLORS["white"])
    if code >= 400 and code < 500:
        style = (COLORS["orange"], COLORS["white"])
    if code >= 500:
        style = (COLORS["red"], COLORS["white"])

    return u"{bg}{fg} {code} {reset} {method:4}".format(
        bg="\x1b[48;2;%s;%s;%sm" % (style[0]),
        fg="\x1b[38;2;%s;%s;%sm" % (style[1]),
        reset="\x1b[0m",
        code=code,
        method=method,
    )


def colorize_reboot(pattern):
    return u"{bg}{fg}[ RELOADING ]{reset} {info_fg}{info}".format(
        bg="\x1b[48;2;%s;%s;%sm" % COLORS["red"],
        fg="\x1b[38;2;%s;%s;%sm" % COLORS["white"],
        info_fg="\x1b[38;2;%s;%s;%sm" % COLORS["white"],
        reset="\x1b[0m",
        info=pattern.group(0),
    )


def colorize_booted(pattern):
    return u"{bg}{fg}[ UWSGI READY ]{reset} {info_fg}{info}".format(
        bg="\x1b[48;2;%s;%s;%sm" % COLORS["green"],
        fg="\x1b[38;2;%s;%s;%sm" % COLORS["white"],
        info_fg="\x1b[38;2;%s;%s;%sm" % COLORS["white"],
        reset="\x1b[0m",
        info=pattern.group(0),
    )


def colorize_traceback(pattern):
    return u"{bg}  {reset} {info_fg}{info}".format(
        bg="\x1b[48;2;%s;%s;%sm" % COLORS["red"],
        info_fg="\x1b[38;2;%s;%s;%sm" % COLORS["red"],
        reset="\x1b[0m",
        info=pattern.group(0),
    )


def monkeypatch_honcho_write(self, message):
    name = message.name if message.name is not None else ""
    name = name.rjust(self.width)

    if isinstance(message.data, bytes):
        string = message.data.decode("utf-8", "replace")
    else:
        string = message.data

    # Colorize requests
    string = re.sub(
        r"(?P<method>GET|POST|PUT|HEAD|DELETE) (?P<code>[0-9]{3})", colorize_code, string
    )
    # Colorize reboots
    string = re.sub(r"Gracefully killing worker [0-9]+ .*\.\.\.", colorize_reboot, string)
    # Colorize reboot complete
    string = re.sub(r"WSGI app [0-9]+ \(.*\) ready in [0-9]+ seconds .*", colorize_booted, string)
    # Mark python tracebacks
    string = re.sub(r"Traceback \(most recent call last\).*", colorize_traceback, string)

    blank_color = (74, 62, 86)

    prefix = u"{name_fg}{name}{reset} {indicator_bg} {reset} ".format(
        name=name.ljust(self.width),
        name_fg="\x1b[38;2;%s;%s;%sm" % SERVICE_COLORS.get(message.name, blank_color),
        indicator_bg="\x1b[48;2;%s;%s;%sm" % SERVICE_COLORS.get(message.name, blank_color),
        reset="\x1b[0m",
    )

    for line in string.splitlines():
        self.output.write(u"{}{}\n".format(prefix, line))
