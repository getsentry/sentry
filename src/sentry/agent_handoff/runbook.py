import html
import re
import shlex

from jinja2 import Environment, PackageLoader, StrictUndefined

# Markdown labels and shell blocks are escaped for their respective contexts below.
MARKDOWN_JINJA_ENV = Environment(
    loader=PackageLoader("sentry", "templates"),
    autoescape=False,
    undefined=StrictUndefined,
    keep_trailing_newline=True,
)

_MARKDOWN_SPECIAL = re.compile(r"([\\`*_{}\[\]()#+.!|~>-])")


def escape_label(value: str) -> str:
    """Keep untrusted context on one line, outside Markdown instructions or HTML."""
    single_line = " ".join(value.split())
    printable = "".join(character for character in single_line if character.isprintable())
    return _MARKDOWN_SPECIAL.sub(r"\\\1", html.escape(printable, quote=False))


def _quote_powershell(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def render_claim_runbook(*, sentry_url: str) -> str:
    # The CLI claims against sentry.io unless told otherwise, so other instances must name
    # themselves or their codes would be sent to the wrong host.
    is_saas = sentry_url.rstrip("/") == "https://sentry.io"
    return MARKDOWN_JINJA_ENV.get_template("sentry/agent_handoff/claim.md").render(
        unix_host="" if is_saas else f"SENTRY_HOST={shlex.quote(sentry_url)} ",
        windows_host="" if is_saas else f"$env:SENTRY_HOST = {_quote_powershell(sentry_url)}\n",
    )
