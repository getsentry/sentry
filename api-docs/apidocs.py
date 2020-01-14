#!/usr/bin/env python2.7
from __future__ import absolute_import

import click
import docker
import json
import os
from six.moves.urllib.parse import urlparse
from sentry.runner.commands.devservices import get_docker_client, get_or_create
from sentry.conf.server import SENTRY_DEVSERVICES
from subprocess import Popen

HERE = os.path.abspath(os.path.dirname(__file__))
OUTPUT_PATH = os.path.join(HERE, "cache")
SENTRY_CONFIG = os.environ["SENTRY_CONF"] = os.path.join(HERE, "sentry.apidocs.conf.py")
os.environ["SENTRY_SKIP_BACKEND_VALIDATION"] = "1"
HOST = urlparse("https://127.0.0.1").netloc
# No sentry or django imports before this point

client = get_docker_client()

# Use a unique network and namespace for our apidocs
namespace = "apidocs"
network = get_or_create(client, "network", namespace)


# Define our set of containers we want to run
containers = {
    "postgres": {
        "image": SENTRY_DEVSERVICES["postgres"]["image"],
        "ports": {"5432/tcp": ("127.0.0.1", 5433)},
        "environment": {"POSTGRES_DB": "sentry_api_docs"},
    },
    "redis": {
        "image": SENTRY_DEVSERVICES["redis"]["image"],
        "ports": {"6379/tcp": ("127.0.0.1", 12355)},
        "command": ["redis-server", "--appendonly", "no"],
    },
    "clickhouse": {
        "image": "yandex/clickhouse-server:19.11",
        "ulimits": [{"name": "nofile", "soft": 262144, "hard": 262144}],
    },
    "snuba": {
        "image": "getsentry/snuba:latest",
        "ports": {"1218/tcp": ("127.0.0.1", 1219)},
        "command": ["devserver", "--no-workers"],
        "environment": {
            "PYTHONUNBUFFERED": "1",
            "SNUBA_SETTINGS": "docker",
            "DEBUG": "1",
            "CLICKHOUSE_HOST": namespace + "_clickhouse",
            "CLICKHOUSE_PORT": "9000",
            "CLICKHOUSE_HTTP_PORT": "8123",
            "REDIS_HOST": namespace + "_redis",
            "REDIS_PORT": "6379",
            "REDIS_DB": "1",
        },
    },
}


# Massage our list into some shared settings instead of repeating
# it for each definition.
for name, options in containers.items():
    options["network"] = namespace
    options["detach"] = True
    options["name"] = namespace + "_" + name
    containers[name] = options

# Pull all of our unique images once.
pulled = set()

for name, options in containers.items():
    if options["image"] not in pulled:
        click.secho("> Pulling image '%s'" % options["image"], err=True, fg="green")
        client.images.pull(options["image"])
        pulled.add(options["image"])


# Run each of our containers, if found running already, delete first
# and create new. We never want to reuse.
for name, options in containers.items():

    try:
        container = client.containers.get(options["name"])
    except docker.errors.NotFound:
        pass
    else:
        container.stop()
        container.remove()

    click.secho("> Creating '%s' container" % options["name"], err=True, fg="yellow")
    client.containers.run(**options)

from sentry.runner import configure

configure()

sentry = Popen(
    ["sentry", "--config=" + SENTRY_CONFIG, "run", "web", "-w", "1", "--bind", "127.0.0.1:12356"]
)

# Fair game from here
from django.core.management import call_command

call_command("migrate", interactive=False, traceback=True, verbosity=0)

import zlib
import six

from datetime import datetime
from sentry.utils.apidocs import MockUtils, Runner, iter_scenarios, iter_endpoints, get_sections
from sentry.web.helpers import render_to_string


def color_for_string(s):
    colors = ("red", "green", "yellow", "blue", "cyan", "magenta")
    return colors[zlib.crc32(s) % len(colors)]


def report(category, message, fg=None):
    if fg is None:
        fg = color_for_string(category)
    click.echo(
        "[%s] %s: %s"
        % (six.text_type(datetime.utcnow()).split(".")[0], click.style(category, fg=fg), message)
    )


def run_scenario(vars, scenario_ident, func):
    runner = Runner(scenario_ident, func, **vars)
    report("scenario", 'Running scenario "%s"' % scenario_ident)
    func(runner)
    return runner.to_json()


def output_json(sections, scenarios, section_mapping):
    report("docs", "Generating JSON documents")

    for id, scenario in scenarios.items():
        dump_json("scenarios/%s.json" % id, scenario)

    section_listings = {}
    for section, title in sections.items():
        entries = {}
        for endpoint in section_mapping.get(section, []):
            entries[endpoint["endpoint_name"]] = endpoint["title"]
            dump_json("endpoints/%s.json" % endpoint["endpoint_name"], endpoint)

        section_listings[section] = {"title": title, "entries": entries}
    dump_json("sections.json", {"sections": section_listings})


def output_markdown(sections, scenarios, section_mapping):
    report("docs", "Generating markdown documents")
    for section, title in sections.items():
        i = 0
        links = []
        for endpoint in section_mapping.get(section, []):
            i += 1
            path = u"{}/{}.md".format(section, endpoint["endpoint_name"])
            auth = ""
            if len(endpoint["params"].get("auth", [])):
                auth = endpoint["params"]["auth"][0]["description"]
            payload = dict(
                title=endpoint["title"],
                sidebar_order=i,
                description="\n".join(endpoint["text"]).strip(),
                warning=endpoint["warning"],
                method=endpoint["method"],
                api_path=endpoint["path"],
                query_parameters=endpoint["params"].get("query"),
                path_parameters=endpoint["params"].get("path"),
                parameters=endpoint["params"].get("param"),
                authentication=auth,
                example_request=format_request(endpoint, scenarios),
                example_response=format_response(endpoint, scenarios),
            )
            dump_markdown(path, payload)

            links.append({"title": endpoint["title"], "path": path})
        dump_index_markdown(section, title, links)


def dump_json(path, data):
    OUTPUT_PATH = "/tmp/src/output"
    path = os.path.join(OUTPUT_PATH, "json", path)
    try:
        os.makedirs(os.path.dirname(path))
    except OSError:
        pass
    with open(path, "w") as f:
        for line in json.dumps(data, indent=2, sort_keys=True).splitlines():
            f.write(line.rstrip() + "\n")


def dump_index_markdown(section, title, links):
    OUTPUT_PATH = "/tmp/src/output"
    path = os.path.join(OUTPUT_PATH, "markdown", section, "index.md")
    try:
        os.makedirs(os.path.dirname(path))
    except OSError:
        pass
    with open(path, "w") as f:
        contents = render_to_string("sentry/apidocs/index.md", dict(title=title, links=links))
        f.write(contents)


def dump_markdown(path, data):
    OUTPUT_PATH = "/tmp/src/output"
    path = os.path.join(OUTPUT_PATH, "markdown", path)
    try:
        os.makedirs(os.path.dirname(path))
    except OSError:
        pass
    with open(path, "w") as f:
        template = u"""---
# This file is automatically generated from the API using `sentry/api-docs/generator.py.`
# Do not manually edit this file.
{}
---
"""
        contents = template.format(json.dumps(data, sort_keys=True, indent=2))
        f.write(contents)


def find_first_scenario(endpoint, scenario_map):
    for scene in endpoint["scenarios"]:
        if scene not in scenario_map:
            continue
        try:
            return scenario_map[scene]["requests"][0]
        except IndexError:
            return None
    return None


def format_request(endpoint, scenario_map):
    scene = find_first_scenario(endpoint, scenario_map)
    if not scene:
        return ""
    request = scene["request"]
    lines = [
        u"{} {} HTTP/1.1".format(request["method"], request["path"]),
        "Host: sentry.io",
        "Authorization: Bearer <token>",
    ]
    lines.extend(format_headers(request["headers"]))
    if request["data"]:
        lines.append("")
        lines.append(json.dumps(request["data"], sort_keys=True, indent=2))
    return "\n".join(lines)


def format_response(endpoint, scenario_map):
    scene = find_first_scenario(endpoint, scenario_map)
    if not scene:
        return ""
    response = scene["response"]
    lines = [u"HTTP/1.1 {} {}".format(response["status"], response["reason"])]
    lines.extend(format_headers(response["headers"]))
    if response["data"]:
        lines.append("")
        lines.append(json.dumps(response["data"], sort_keys=True, indent=2))
    return "\n".join(lines)


def format_headers(headers):
    """Format headers into a list."""
    return [u"{}: {}".format(key, value) for key, value in headers.items()]


utils = MockUtils()
report("org", "Creating user and organization")
user = utils.create_user("john@interstellar.invalid")
org = utils.create_org("The Interstellar Jurisdiction", owner=user)
report("auth", "Creating api token")
api_token = utils.create_api_token(user)

report("org", "Creating team")
team = utils.create_team("Powerful Abolitionist", org=org)
utils.join_team(team, user)

projects = []
for project_name in "Pump Station", "Prime Mover":
    report("project", 'Creating project "%s"' % project_name)
    project = utils.create_project(project_name, teams=[team], org=org)
    release = utils.create_release(project=project, user=user)
    report("event", 'Creating event for "%s"' % project_name)

    event1 = utils.create_event(project=project, release=release, platform="python")
    event2 = utils.create_event(project=project, release=release, platform="java")
    projects.append({"project": project, "release": release, "events": [event1, event2]})

vars = {
    "org": org,
    "me": user,
    "api_token": api_token,
    "teams": [{"team": team, "projects": projects}],
}

scenario_map = {}
report("docs", "Collecting scenarios")
for scenario_ident, func in iter_scenarios():
    scenario = run_scenario(vars, scenario_ident, func)
    scenario_map[scenario_ident] = scenario

section_mapping = {}
report("docs", "Collecting endpoint documentation")
for endpoint in iter_endpoints():
    report("endpoint", 'Collecting docs for "%s"' % endpoint["endpoint_name"])

    section_mapping.setdefault(endpoint["section"], []).append(endpoint)
sections = get_sections()

output_format = "both"
if output_format in ("json", "both"):
    output_json(sections, scenario_map, section_mapping)
if output_format in ("markdown", "both"):
    output_markdown(sections, scenario_map, section_mapping)


# Delete all of our containers now. If it's not running, do nothing.
for name, options in containers.items():
    try:
        container = client.containers.get(options["name"])
    except docker.errors.NotFound:
        pass
    else:
        click.secho("> Removing '%s' container" % container.name, err=True, fg="red")
        container.stop()
        container.remove()

if sentry is not None:
    report("sentry", "Shutting down sentry server")
    sentry.kill()
    sentry.wait()

# Remove our network that we created.
click.secho("> Removing '%s' network" % network.name, err=True, fg="red")
network.remove()
