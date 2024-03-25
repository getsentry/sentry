import os

import click


@click.command()
@click.option(
    "--dev", default=False, is_flag=True, help="Use settings more conducive to local development."
)
@click.option(
    "--noclobber", default=False, is_flag=True, help="Don't ask to overwrite existing config."
)
@click.argument("directory", required=False)
@click.pass_context
def init(ctx, dev, noclobber, directory):
    "Initialize new configuration directory."
    from sentry.runner.settings import discover_configs, generate_settings

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

    py_contents, yaml_contents = generate_settings(dev)

    if not os.path.isfile(yaml):
        write_yaml = True
    else:
        write_yaml = not noclobber and click.confirm(
            "File already exists at '%s', overwrite?" % click.format_filename(yaml)
        )

    if write_yaml:
        with click.open_file(yaml, "w") as fp:
            fp.write(yaml_contents)

    if not os.path.isfile(py):
        write_py = True
    else:
        write_py = not noclobber and click.confirm(
            "File already exists at '%s', overwrite?" % click.format_filename(py)
        )

    if write_py:
        with click.open_file(py, "w") as fp:
            fp.write(py_contents)
