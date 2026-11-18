import html
import re
import shlex
from collections.abc import Mapping

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


def _code_block(value: str, language: str = "bash") -> str:
    fence = "`" * max(3, max((len(run) + 1 for run in re.findall(r"`+", value)), default=0))
    return f"{fence}{language}\n{value}\n{fence}"


def _quote_powershell(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _powershell_command(command: str, environment: Mapping[str, str]) -> str:
    lines = [
        *(f"$env:{name} = {_quote_powershell(value)}" for name, value in environment.items()),
        command,
    ]
    return _code_block("\n".join(lines), "powershell")


def render_claim_runbook(*, sentry_url: str) -> str:
    # The CLI claims against sentry.io unless told otherwise, so other instances must name
    # themselves or their codes would be sent to the wrong host.
    setup_variables = {
        **({} if sentry_url.rstrip("/") == "https://sentry.io" else {"SENTRY_HOST": sentry_url}),
        "SENTRY_HANDOFF": "HANDOFF_CODE",
    }
    setup_environment = " ".join(
        f"{name}={shlex.quote(value)}" for name, value in setup_variables.items()
    )
    return MARKDOWN_JINJA_ENV.get_template("sentry/agent_handoff/claim.md").render(
        unix_installer=_code_block(
            f"curl -fsSL https://cli.sentry.dev/install | {setup_environment} bash"
        ),
        windows_installer=_powershell_command(
            "irm https://cli.sentry.dev/install.ps1 | iex", setup_variables
        ),
    )
