import click

from sentry.runner.decorators import configuration


def create_key_value_generator(data, newline_separator, kv_separator):
    return (line.split(kv_separator) for line in data.split(newline_separator) if line)


@click.group()
def configoptions():
    "Manages Sentry options."


@configoptions.command()
@click.option("--key", "-k", required=True, help="The key of the option to fetch.")
@configuration
def fetch(key):
    "Fetches the option for the given key."
    click.echo(get(key))


@configoptions.command()
@configuration
def list():
    "Fetches all options."
    from sentry import options

    for opt in options.all():
        # click.echo(f"{opt.name} ({opt.type}) = {options.get(opt.name)}")
        click.echo(f"{opt.name}: {options.get(opt.name)}")


@configoptions.command()
@click.argument("filename", required=True)
@click.option(
    "--dryrun",
    is_flag=True,
    default=False,
    required=False,
    help="Output exactly what changes would be made and in which order.",
)
@configuration
def patch(filename, dryrun):
    "Updates, gets, and deletes options that are each subsectioned in the given file."
    import yaml

    if dryrun:
        click.echo("Dryrun flag on. ")
    with open(filename) as stream:
        configmap_data = yaml.safe_load(stream)
        data = configmap_data.get("data", {}).get("options-patch.yaml", "")

        keysToFetch = data.get("fetch", {})
        keysToFetch = (line for line in keysToFetch.split("\n") if line)

        keysToUpdate = data.get("update", {})
        keysToUpdate = (line.split(": ") for line in keysToUpdate.split("\n") if line)

        keysToDelete = data.get("delete", {})
        keysToDelete = keysToFetch = (line for line in keysToDelete.split("\n") if line)

        for key in keysToFetch:
            click.echo(get(key, dryrun))

        for key, val in keysToUpdate.items():
            click.echo(set(key, dryrun))

        for key in keysToDelete:
            click.echo(delete(key, dryrun))


@configoptions.command()
@click.argument("filename", required=True)
@click.option(
    "--dryrun",
    is_flag=True,
    default=False,
    required=False,
    help="Output exactly what changes would be made and in which order.",
)
@configuration
def strict(filename, dryrun):
    "Deletes everything not in the uploaded file, and applies all of the changes in the file."
    import yaml

    from sentry import options

    if dryrun:
        click.echo("Dryrun flag on. ")

    with open(filename) as stream:
        configmap_data = yaml.safe_load(stream)
        data = configmap_data.get("data", {}).get("options-strict.yaml", "")

        kv_generator = create_key_value_generator(data, "\n", ": ")
        db_keys = (opt.name for opt in options.all())
        for key in db_keys:
            if key not in kv_generator:
                click.echo(delete(key, dryrun))
                click.echo(f"Successfully deleted: {key} (dry run:{dryrun})")

        kv_generator = create_key_value_generator(data, "\n", ": ")
        for line in kv_generator:
            key = line[0]
            val = ""
            if len(line) > 1:
                val = line[1]
            success = set(key, val, dryrun)
            if success:
                click.echo(f"Successfully updated: {key} = {val} (dry run:{dryrun})")
            else:
                click.echo(f"Failed to update: {key} = {val} (dry run:{dryrun})")


def get(key, dryrun=False):
    from sentry import options
    from sentry.options.manager import UnknownOption

    try:
        opt = options.lookup_key(key)
        click.echo(f"Fetched Key: {opt.name} ({opt.type}) = {options.get(opt.name)}")
        return opt
    except UnknownOption:
        click.echo("unknown option: %s" % key)
        return None


def set(key, val, dryrun=False):
    from sentry import options
    from sentry.options.manager import UnknownOption

    success = False
    try:
        opt = options.lookup_key(key)

    except UnknownOption:
        click.echo(f"Unknown Option: {key}")
        if not dryrun:
            try:
                options.register(key)
                options.set(key, val)
                click.echo(f"Registered a new key: {key} = {val}")
            except Exception:
                click.echo(f"Failed to register option: {key} = {val}")

    else:
        if not dryrun:
            try:
                options.set(key, val)
                success = True
                click.echo(f"Updated key: {opt.name} ({opt.type}) = {options.get(opt.name)}")
            except Exception:
                click.echo(
                    f"Failed to update key: {opt.name} ({opt.type}) = {options.get(opt.name)}"
                )

    return success


def delete(key, dryrun=False):
    from sentry import options
    from sentry.options.manager import UnknownOption

    try:
        options.lookup_key(key)
        if not dryrun:
            options.delete(key)
        return f"Deleted key: {key}"
    except UnknownOption:
        return "unknown option: %s" % key


def test():
    pass
