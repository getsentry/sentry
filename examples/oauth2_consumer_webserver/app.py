import json  # noqa
import os

import markupsafe
from flask import Flask, redirect, request, session, url_for
from flask_oauth import OAuth

BASE_URL = os.environ.get("BASE_URL", "http://dev.getsentry.net:8000")
CLIENT_ID = os.environ.get("CLIENT_ID")
CLIENT_SECRET = os.environ.get("CLIENT_SECRET")
REDIRECT_URI = "/authorized"

SECRET_KEY = "development key"
DEBUG = True

app = Flask(__name__)
app.debug = DEBUG
app.secret_key = SECRET_KEY
oauth = OAuth()

sentry = oauth.remote_app(
    "sentry",
    base_url=BASE_URL,
    authorize_url=f"{BASE_URL}/oauth/authorize/",
    request_token_url=None,
    request_token_params={
        "scope": "project:releases event:read org:read org:write",
        "response_type": "code",
    },
    access_token_url=f"{BASE_URL}/oauth/token/",
    access_token_method="POST",
    access_token_params={"grant_type": "authorization_code"},
    consumer_key=CLIENT_ID,
    consumer_secret=CLIENT_SECRET,
)


@app.route("/")
def index():
    access_token = session.get("access_token")
    if access_token is None:
        return ("<h1>Who are you?</h1>" '<p><a href="{}">Login with Sentry</a></p>').format(
            url_for("login")
        )

    from urllib.error import HTTPError, URLError
    from urllib.request import Request, urlopen

    headers = {"Authorization": f"Bearer {access_token}"}
    req = Request(f"{BASE_URL}/api/0/organizations/", None, headers)
    try:
        res = urlopen(req)
    except HTTPError as e:
        if e.code == 401:
            # Unauthorized - bad token
            session.pop("access_token", None)
            return redirect(url_for("login"))
        return markupsafe.Markup("{}\n{}").format(e.code, e.reason)
    except URLError as e:
        return markupsafe.Markup("{}").format(e)

    return markupsafe.Markup("<h1>Hi, {}!</h1>" "<pre>{}</pre>").format(
        json.loads(session["user"])["email"], json.dumps(json.loads(res.read()), indent=2)
    )


@app.route("/login")
def login():
    callback = url_for("authorized", _external=True)
    return sentry.authorize(callback=callback)


@app.route(REDIRECT_URI)
@sentry.authorized_handler
def authorized(resp):
    if "error" in request.args:
        return markupsafe.Markup(
            "<h1>Error</h1>" "<p>{}</p>" '<p><a href="{}">Try again</a></p>'
        ).format(request.args["error"], url_for("login"))

    access_token = resp["access_token"]
    session["access_token"] = access_token
    session["user"] = json.dumps(resp["user"])
    return redirect(url_for("index"))


@sentry.tokengetter
def get_access_token():
    return session.get("access_token")


def main():
    app.run()


if __name__ == "__main__":
    main()
