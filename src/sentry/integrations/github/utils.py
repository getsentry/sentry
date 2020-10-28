from __future__ import absolute_import

import calendar
import datetime
import jwt
import time

from sentry import options


def get_jwt(github_id=None, github_private_key=None):
    if github_id is None:
        github_id = options.get("github-app.id")
    if github_private_key is None:
        github_private_key = options.get("github-app.private-key")
    exp = datetime.datetime.utcnow() + datetime.timedelta(minutes=10)
    exp = calendar.timegm(exp.timetuple())
    # Generate the JWT
    payload = {
        # issued at time
        "iat": int(time.time()),
        # JWT expiration time (10 minute maximum)
        "exp": exp,
        # Integration's GitHub identifier
        "iss": github_id,
    }
    return jwt.encode(payload, github_private_key, algorithm="RS256")
