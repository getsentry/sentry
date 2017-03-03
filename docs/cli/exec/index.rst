`sentry exec [FILE]`
--------------------

Execute a script.

Also compatible with hashbang `#!/usr/bin/env sentry exec`

For convenience, the following preample is attached to scripts:


  from sentry.runner import configure; configure()
  from django.conf import settings
  from sentry.models import *

Examples:


  $ sentry exec -c 'print(Project.objects.count())'
  $ echo 'print(Project.objects.count())' | sentry exec
  $ sentry exec something.py

Note: All scripts are assumed utf-8.

Options
```````

- ``-c TEXT``: Read script from string.
- ``--help``: print this help page.
