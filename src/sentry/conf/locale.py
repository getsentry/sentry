import os
import json
import sentry


with open(os.path.join(os.path.dirname(sentry.__file__),
                       'locale', 'catalogs.json'), 'r') as f:
    CATALOGS = json.load(f)['supported_locales']
