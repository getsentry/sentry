import html
import re
import shlex

from jinja2 import Environment, PackageLoader, StrictUndefined

from sentry.agent_handoff.installer import installer_command, pinned_installer

# Markdown labels and shell blocks are escaped for their respective contexts below.
_ENVIRONMENT = Environment(
    loader=PackageLoader("sentry", "templates"),
    autoescape=False,
    undefined=StrictUndefined,
    keep_trailing_newline=True,
)

_MARKDOWN_SPECIAL = re.compile(r"([\\`*_{}\[\]()#+.!|~>-])")


def _escape_label(value: str) -> str:
    """Keep untrusted context on one line, outside Markdown instructions or HTML."""
    single_line = " ".join(value.split())
    printable = "".join(character for character in single_line if character.isprintable())
    return _MARKDOWN_SPECIAL.sub(r"\\\1", html.escape(printable, quote=False))


def _code_block(value: str, language: str = "bash") -> str:
    # Minted codes are opaque; keep even unexpected backticks inside their code block.
    fence = "`" * max(3, max((len(run) + 1 for run in re.findall(r"`+", value)), default=0))
    return f"{fence}{language}\n{value}\n{fence}"


def render_agent_runbook(
    *,
    organization_slug: str,
    organization_name: str,
    user_email: str,
    sentry_url: str,
    client_id: str,
    setup_code: str,
    flow_instructions: str,
) -> str:
    """Render a private guide from already-authorized context and minted credentials."""
    instance_environment = (
        f"SENTRY_HOST={shlex.quote(sentry_url)} SENTRY_URL={shlex.quote(sentry_url)}"
    )
    setup_environment = (
        f"{instance_environment} SENTRY_CLIENT_ID={shlex.quote(client_id)} "
        f"SENTRY_SETUP_CODE={shlex.quote(setup_code)}"
    )
    auth_status = _code_block(f"{instance_environment} sentry auth status --fresh --json")
    pinned = pinned_installer()
    installer = _code_block(installer_command(setup_environment, pinned))
    bootstrap = _code_block(
        f"{setup_environment} sentry auth bootstrap --url {shlex.quote(sentry_url)}"
    )

    return _ENVIRONMENT.get_template("sentry/agent_handoff/runbook.md").render(
        {
            "sentry_url": _escape_label(sentry_url),
            "user_email": _escape_label(user_email),
            "organization_name": _escape_label(organization_name),
            "organization_slug": _escape_label(organization_slug),
            "auth_status": auth_status,
            "installer": installer,
            "installer_verified": pinned is not None,
            "bootstrap": bootstrap,
            "flow_instructions": flow_instructions,
        },
    )


def render_claim_runbook(*, claim_url: str) -> str:
    command = (
        f"curl -sS -X POST {shlex.quote(claim_url)} --data-urlencode 'handoff_code=HANDOFF_CODE'"
    )
    return _ENVIRONMENT.get_template("sentry/agent_handoff/claim.md").render(
        claim_command=_code_block(command),
    )
