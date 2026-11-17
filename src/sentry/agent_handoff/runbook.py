import html
import re

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


def render_claim_runbook() -> str:
    return MARKDOWN_JINJA_ENV.get_template("sentry/agent_handoff/claim.md").render()
