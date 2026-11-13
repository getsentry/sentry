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


def _escape_label(value: str) -> str:
    """Keep untrusted context on one line, outside Markdown instructions or HTML."""
    single_line = " ".join(value.split())
    printable = "".join(character for character in single_line if character.isprintable())
    return _MARKDOWN_SPECIAL.sub(r"\\\1", html.escape(printable, quote=False))


def _code_block(value: str, language: str = "bash") -> str:
    # Minted codes are opaque; keep even unexpected backticks inside their code block.
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
    instance_variables = (
        {}
        if sentry_url.rstrip("/") in ("sentry.io", "https://sentry.io")
        else {
            "SENTRY_HOST": sentry_url,
            "SENTRY_URL": sentry_url,
            "SENTRY_CLIENT_ID": client_id,
        }
    )
    setup_variables = {
        **instance_variables,
        "SENTRY_SETUP_CODE": setup_code,
    }
    instance_environment = " ".join(
        f"{name}={shlex.quote(value)}" for name, value in instance_variables.items()
    )
    setup_environment = " ".join(
        f"{name}={shlex.quote(value)}" for name, value in setup_variables.items()
    )
    unix_auth_status = _code_block(
        " ".join(filter(None, (instance_environment, "sentry auth status --fresh --json")))
    )
    unix_installer = _code_block(
        f"curl -fsSL https://cli.sentry.dev/install | {setup_environment} bash"
    )
    unix_bootstrap = _code_block(
        f"{setup_environment} sentry auth bootstrap --url {shlex.quote(sentry_url)}"
    )

    return MARKDOWN_JINJA_ENV.get_template("sentry/agent_handoff/runbook.md").render(
        {
            "sentry_url": _escape_label(sentry_url),
            "user_email": _escape_label(user_email),
            "organization_name": _escape_label(organization_name),
            "organization_slug": _escape_label(organization_slug),
            "unix_auth_status": unix_auth_status,
            "unix_installer": unix_installer,
            "unix_bootstrap": unix_bootstrap,
            "windows_auth_status": _powershell_command(
                "sentry auth status --fresh --json", instance_variables
            ),
            "windows_installer": _powershell_command(
                "irm https://cli.sentry.dev/install.ps1 | iex",
                setup_variables,
            ),
            "windows_bootstrap": _powershell_command(
                f"sentry auth bootstrap --url {_quote_powershell(sentry_url)}",
                setup_variables,
            ),
            "flow_instructions": flow_instructions,
        },
    )


def render_claim_runbook(*, claim_url: str) -> str:
    unix_claim_command = (
        f"curl -sS -X POST {shlex.quote(claim_url)} --data-urlencode 'handoff_code=HANDOFF_CODE'"
    )
    windows_claim_command = "\n".join(
        [
            "try {",
            f"  irm -Method Post {_quote_powershell(claim_url)} `",
            "    -ContentType 'application/x-www-form-urlencoded' `",
            "    -Body @{handoff_code = 'HANDOFF_CODE'}",
            "} catch { $_.ErrorDetails.Message }",
        ]
    )
    return MARKDOWN_JINJA_ENV.get_template("sentry/agent_handoff/claim.md").render(
        unix_claim_command=_code_block(unix_claim_command),
        windows_claim_command=_code_block(windows_claim_command, "powershell"),
    )


def render_ip_mismatch_runbook() -> str:
    return MARKDOWN_JINJA_ENV.get_template("sentry/agent_handoff/ip_mismatch.md").render()
