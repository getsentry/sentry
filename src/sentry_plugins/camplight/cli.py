# -*- coding: utf-8 -*-

"""
camplight.cli
~~~~~~~~~~~~~

This module implements the command-line interface to the Campfire API.

"""

import sys
import os
import optparse

from .api import *
from .exceptions import *


def die(msg):
    sys.exit("error: %s" % msg)


def main(argv=None):
    usage = "Usage: %prog [options] <command> [args]"
    parser = optparse.OptionParser(usage=usage)
    parser.add_option(
        "-u", "--url", help="set Campfire URL", default=os.environ.get("CAMPFIRE_URL")
    )
    parser.add_option(
        "-t",
        "--token",
        help="set API token for authentication",
        default=os.environ.get("CAMPFIRE_TOKEN"),
    )
    parser.add_option(
        "-r", "--room", help="set Campfire room", default=os.environ.get("CAMPFIRE_ROOM")
    )
    parser.add_option(
        "-v",
        "--verbose",
        help="be more verbose",
        action="store_true",
        default=os.environ.get("CAMPFIRE_VERBOSE"),
    )
    opts, args = parser.parse_args(argv)

    if not opts.url:
        die("Campfire URL missing")
    if not opts.token:
        die("API token missing")
    if len(args) < 1:
        die("too few arguments")

    verbose = sys.stderr if opts.verbose else None
    request = Request(opts.url, opts.token, verbose)
    campfire = Campfire(request)

    cmd = args.pop(0)
    if cmd in ("account", "rooms", "user", "presence", "search"):
        func = getattr(campfire, cmd)
    elif cmd in (
        "status",
        "recent",
        "transcript",
        "uploads",
        "join",
        "leave",
        "lock",
        "unlock",
        "speak",
        "paste",
        "play",
        "set-name",
        "set-topic",
    ):
        if opts.room is None:
            die("Campfire room missing")
        try:
            room = campfire.room(opts.room)
        except (RequestException, CamplightException) as e:
            die("%s: %s" % (e.__class__.__name__, e))
        func = getattr(room, cmd.replace("-", "_"))
    else:
        die("invalid command")

    try:
        data = func(*args)
    except TypeError:
        die("invalid arguments")
    except (RequestException, CamplightException) as e:
        die("%s: %s" % (e.__class__.__name__, e))

    if data:
        # HACK re-encode json for pretty output
        import json

        print (json.dumps(data, indent=4))
