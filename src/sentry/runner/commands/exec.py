import sys

import click

# If this changes, make sure to also update in the `__doc__`
SCRIPT_TEMPLATE = """\
%(header)s

try:
    %(body)s
except Exception:
    import traceback
    traceback.print_exc()
    raise ScriptError('Failed to execute script {!r}'.format(%(filename)r))
"""


@click.command(
    name="exec", context_settings=dict(ignore_unknown_options=True, allow_extra_args=True)
)
@click.option("-c", default="", help="Read script from string.")
@click.argument("file", default=None, required=False)
def exec_(c, file):
    """
    Execute a script.

    Also compatible with hashbang `#!/usr/bin/env sentry exec`

    For convenience, the following example is attached to scripts:

    \b
      from sentry.runner import configure; configure()
      from django.conf import settings
      from sentry.models import *

    Examples:

    \b
      $ sentry exec -c 'print(Project.objects.count())'
      $ echo 'print(Project.objects.count())' | sentry exec
      $ sentry exec something.py

    Note: All scripts are assumed utf-8.
    """
    # Can't have both a file and command, when passing both
    # -c takes priority and rest is ignored. This mimics
    # `python -c` behavior.
    if c and file:
        file = None

    # If we specify neither, read from stdin
    if not (c or file):
        file = "-"

    if file:
        if file == "-":
            file = "<string>"
            c = click.get_text_stream("stdin").read()
        else:
            try:
                with open(file, "rb") as fp:
                    c = fp.read().decode("utf8")
            except OSError as e:
                raise click.ClickException(str(e))
    else:
        file = "<string>"

    header = []

    if "from __future__" in c:
        body = []
        state = 0

        for line in c.splitlines():
            if line.startswith("from __future__"):
                state = 1
            elif line and not line.startswith(("#", '"', "'")) and state == 1:
                state = 2
            if state == 2:
                body.append(line)
            else:
                header.append(line)
        body = "\n".join(body)
    else:
        header = []
        body = c

    if "from sentry.runner import configure" not in c:
        header.extend(
            [
                "from sentry.runner import configure; configure()",
                "from django.conf import settings",
                "from sentry.models import *",
            ]
        )

    header.append("class ScriptError(Exception): pass")

    script = SCRIPT_TEMPLATE % {
        # Need to reindent the code to fit inside the `try` block
        "body": body.replace("\n", "\n" + (" " * 4)),
        "header": "\n".join(header),
        "filename": file,
    }

    # Chop off `exec` from `sys.argv` so scripts can handle
    # this as expected.
    sys.argv = sys.argv[1:]

    # globals context
    g = {
        # Inject `__name__ = '__main__' for scripts
        "__name__": "__main__",
        "__file__": "<script>",
    }
    # we use globals as locals due to:
    # http://stackoverflow.com/a/2906198/154651
    exec(compile(script, file, "exec"), g, g)
