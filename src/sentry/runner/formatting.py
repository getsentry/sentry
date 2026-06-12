from __future__ import annotations

import re
import sys
from typing import IO, TYPE_CHECKING, cast

if TYPE_CHECKING:
    import honcho.printer

_ANSI_RE = re.compile(r"\x1b\[[0-9;]*m")


class TeeStream:
    """Mirror writes to a console stream verbatim and a log file with ANSI stripped."""

    def __init__(self, console: IO[str], log_file: IO[str]) -> None:
        self._console = console
        self._log_file = log_file

    def write(self, s: str) -> int:
        self._console.write(s)
        self._log_file.write(_ANSI_RE.sub("", s))
        self._log_file.flush()
        return len(s)

    def flush(self) -> None:
        self._console.flush()
        self._log_file.flush()

    def isatty(self) -> bool:
        # Delegate so honcho keeps coloring the console; the file copy is stripped above.
        return self._console.isatty()


# Sentry colors taken from our design system. Might not look good on all
# terminal themes tbh
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


def colorize_code(pattern: re.Match[str]) -> str:
    code = int(pattern.group("code"))
    method = pattern.group("method")

    style = (COLORS["red"], COLORS["white"])

    if code >= 200 and code < 300:
        style = (COLORS["green"], COLORS["white"])
    if code >= 400 and code < 500:
        style = (COLORS["orange"], COLORS["white"])
    if code >= 500:
        style = (COLORS["red"], COLORS["white"])

    return "{bg}{fg} {code} {reset} {method:4}".format(
        bg="\x1b[48;2;%s;%s;%sm" % (style[0]),
        fg="\x1b[38;2;%s;%s;%sm" % (style[1]),
        reset="\x1b[0m",
        code=code,
        method=method,
    )


def colorize_reboot(pattern: re.Match[str]) -> str:
    return "{bg}{fg}[ RELOADING ]{reset} {info_fg}{info}".format(
        bg="\x1b[48;2;%s;%s;%sm" % COLORS["red"],
        fg="\x1b[38;2;%s;%s;%sm" % COLORS["white"],
        info_fg="\x1b[38;2;%s;%s;%sm" % COLORS["white"],
        reset="\x1b[0m",
        info=pattern.group(0),
    )


def colorize_booted(pattern: re.Match[str]) -> str:
    return "{bg}{fg}[ UWSGI READY ]{reset} {info_fg}{info}".format(
        bg="\x1b[48;2;%s;%s;%sm" % COLORS["green"],
        fg="\x1b[38;2;%s;%s;%sm" % COLORS["white"],
        info_fg="\x1b[38;2;%s;%s;%sm" % COLORS["white"],
        reset="\x1b[0m",
        info=pattern.group(0),
    )


def colorize_traceback(pattern: re.Match[str]) -> str:
    return "{bg}  {reset} {info_fg}{info}".format(
        bg="\x1b[48;2;%s;%s;%sm" % COLORS["red"],
        info_fg="\x1b[38;2;%s;%s;%sm" % COLORS["red"],
        reset="\x1b[0m",
        info=pattern.group(0),
    )


def get_honcho_printer(
    *, prefix: bool, pretty: bool, output: IO[str] | TeeStream | None = None
) -> honcho.printer.Printer:
    import honcho.printer

    class SentryPrinter(honcho.printer.Printer):
        def write(self, message: honcho.printer.Message) -> None:
            if not pretty:
                super().write(message)
                return

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
            string = re.sub(
                r"WSGI app [0-9]+ \(.*\) ready in [0-9]+ seconds .*", colorize_booted, string
            )
            # Mark python tracebacks
            string = re.sub(r"Traceback \(most recent call last\).*", colorize_traceback, string)

            blank_color = (74, 62, 86)

            prefix = "{name_fg}{name}{reset} {indicator_bg} {reset} ".format(
                name=name.ljust(self.width),
                name_fg="\x1b[38;2;%s;%s;%sm" % SERVICE_COLORS.get(name, blank_color),
                indicator_bg="\x1b[48;2;%s;%s;%sm" % SERVICE_COLORS.get(name, blank_color),
                reset="\x1b[0m",
            )

            for line in string.splitlines():
                self.output.write(f"{prefix}{line}\n")

    return SentryPrinter(
        prefix=prefix, output=cast("IO[str]", output) if output is not None else sys.stdout
    )
