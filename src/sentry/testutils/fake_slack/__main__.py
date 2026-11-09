import argparse
import sys
from pathlib import Path

from sentry.testutils.fake_slack.server import FakeSlack, make_server, viewer_url


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a fake Slack Web API for local development.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8099)
    parser.add_argument("--state-file", type=Path, default=Path(".artifacts/fake-slack.json"))
    parser.add_argument(
        "--public-url",
        help="Viewer URL used in message links. Defaults to $FAKE_SLACK_PUBLIC_URL or "
        "http://localhost:<port>.",
    )
    args = parser.parse_args()

    slack = FakeSlack(args.state_file, args.public_url or viewer_url(args.port))
    server = make_server(args.host, args.port, slack)
    sys.stdout.write(f"Fake Slack is running at {slack.public_url}\n")
    sys.stdout.flush()
    server.serve_forever()


if __name__ == "__main__":
    main()
