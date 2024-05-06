import importlib.resources
import os

import click
from django.utils.crypto import get_random_string

from sentry.runner.settings import DEFAULT_SETTINGS_CONF, DEFAULT_SETTINGS_OVERRIDE


def generate_secret_key() -> str:
    chars = "abcdefghijklmnopqrstuvwxyz0123456789!@#%^&*(-_=+)"
    return get_random_string(50, chars)


def _load_config_template(path: str, version: str = "default") -> str:
    return importlib.resources.files("sentry").joinpath(f"data/config/{path}.{version}").read_text()


def _generate_settings(dev: bool = False) -> tuple[str, str]:
    """
    This command is run when ``default_path`` doesn't exist, or ``init`` is
    run and returns a string representing the default data to put into their
    settings file.
    """
    context = {
        "secret_key": generate_secret_key(),
        "debug_flag": dev,
        "mail.backend": "console" if dev else "smtp",
    }

    py = _load_config_template(DEFAULT_SETTINGS_OVERRIDE, "default") % context
    yaml = _load_config_template(DEFAULT_SETTINGS_CONF, "default") % context
    return py, yaml


@click.command()
@click.option(
    "--dev", default=False, is_flag=True, help="Use settings more conducive to local development."
)
@click.option(
    "--no-clobber", default=False, is_flag=True, help="Don't ask to overwrite existing config."
)
@click.argument("directory", required=False)
def init(dev: bool, no_clobber: bool, directory: str) -> None:
    "Initialize new configuration directory."
    from sentry.runner.settings import discover_configs

    if directory is not None:
        os.environ["SENTRY_CONF"] = directory

    directory, py, yaml = discover_configs()

    # In this case, the config is pointing directly to a file, so we
    # must maintain old behavior, and just abort
    if yaml is None and os.path.isfile(py):
        # TODO: Link to docs explaining about new behavior of SENTRY_CONF?
        raise click.ClickException(
            "Found legacy '%s' file, so aborting." % click.format_filename(py)
        )

    if yaml is None:
        raise click.ClickException("DIRECTORY must not be a file.")

    os.makedirs(directory, exist_ok=True)

    py_contents, yaml_contents = _generate_settings(dev)

    if not os.path.isfile(yaml):
        write_yaml = True
    else:
        write_yaml = not no_clobber and click.confirm(
            "File already exists at '%s', overwrite?" % click.format_filename(yaml)
        )

    if write_yaml:
        with click.open_file(yaml, "w") as fp:
            fp.write(yaml_contents)

    if not os.path.isfile(py):
        write_py = True
    else:
        write_py = not no_clobber and click.confirm(
            "File already exists at '%s', overwrite?" % click.format_filename(py)
        )

    if write_py:
        with click.open_file(py, "w") as fp:
            fp.write(py_contents)
