import pathlib
import sys

import click


@click.command(
    name="execfile", context_settings=dict(ignore_unknown_options=True, allow_extra_args=True)
)
@click.argument("filename", required=True)
def execfile(filename):
    """Execute a script.

    This is very similar to `exec`, with the following differences:

    - The following header is implicitly executed before the script, regardless
      of whether the script itself does something similar:

         from sentry.runner import configure; configure()
         from django.conf import settings
         from sentry.models import *

    - No support for the -c option.

    - Exceptions are not wrapped, line numbers match in any reported exception and the
      script.

    - __file__ is set to the filename of the script.
    """
    filename = pathlib.Path(filename)
    preamble = "\n".join(
        [
            "from sentry.runner import configure; configure()",
            "from django.conf import settings",
            "from sentry.models import *",
        ]
    )
    script_globals = {"__name__": "__main__", "__file__": str(filename)}
    preamble_code = compile(preamble, filename, "exec")
    exec(preamble_code, script_globals, script_globals)
    sys.argv = sys.argv[1:]
    script_code = compile(filename.read_text(), filename, "exec")
    exec(script_code, script_globals, script_globals)
