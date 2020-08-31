#!/usr/bin/env python2.7
from __future__ import absolute_import

import click
import docker
import json
import os
import six
import zlib
from datetime import datetime
from contextlib import contextmanager
from sentry.runner.commands.devservices import get_docker_client, get_or_create
from sentry.utils.apidocs import MockUtils, iter_scenarios, iter_endpoints, get_sections
from sentry.utils.integrationdocs import sync_docs
from sentry.conf.server import SENTRY_DEVSERVICES
from subprocess import Popen

HERE = os.path.abspath(os.path.dirname(__file__))
OUTPUT_PATH = "/usr/src/output"
SENTRY_CONFIG = os.environ["SENTRY_CONF"] = os.path.join(HERE, "sentry.conf.py")
os.environ["SENTRY_SKIP_BACKEND_VALIDATION"] = "1"

client = get_docker_client()

# Use a unique network and namespace for our apidocs
namespace = "apidocs"

# Define our set of containers we want to run
APIDOC_CONTAINERS = ["postgres", "redis", "clickhouse", "snuba", "relay"]
devservices_settings = {
    container_name: SENTRY_DEVSERVICES[container_name] for container_name in APIDOC_CONTAINERS
}

apidoc_containers_overrides = {
    "postgres": {"environment": {"POSTGRES_DB": "sentry_api_docs"}, "volumes": None},
    "redis": {"volumes": None},
    "clickhouse": {"ports": None, "volumes": None, "only_if": None},
    "snuba": {
        "pull": None,
        "command": ["devserver", "--no-workers"],
        "environment": {
            "CLICKHOUSE_HOST": namespace + "_clickhouse",
            "DEFAULT_BROKERS": None,
            "REDIS_HOST": namespace + "_redis",
        },
        "volumes": None,
        "only_if": None,
    },
    "relay": {"pull": None, "volumes": None, "only_if": None, "with_devserver": None},
}


def deep_merge(defaults, overrides):
    """
    Deep merges two dictionaries.

    If the value is None in `overrides`, that key-value pair will not show up in the final result.
    """
    merged = {}
    for key in defaults:
        if isinstance(defaults[key], dict):
            if key not in overrides:
                merged[key] = defaults[key]
            elif overrides[key] is None:
                continue
            elif isinstance(overrides[key], dict):
                merged[key] = deep_merge(defaults[key], overrides[key])
            else:
                raise Exception("Types must match")
        elif key in overrides and overrides[key] is None:
            continue
        elif key in overrides:
            merged[key] = overrides[key]
        else:
            merged[key] = defaults[key]
    return merged


@contextmanager
def apidoc_containers():
    network = get_or_create(client, "network", namespace)

    containers = deep_merge(devservices_settings, apidoc_containers_overrides)

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

    yield

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

    # Remove our network that we created.
    click.secho("> Removing '%s' network" % network.name, err=True, fg="red")
    network.remove()


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
    from sentry.utils.apidocs import Runner

    runner = Runner(scenario_ident, func, **vars)
    report("scenario", 'Running scenario "%s"' % scenario_ident)
    func(runner)
    return runner.to_json()


@click.command()
@click.option("--output-path", type=click.Path())
@click.option("--output-format", type=click.Choice(["json", "markdown", "both"]), default="both")
def cli(output_path, output_format):
    global OUTPUT_PATH
    if output_path is not None:
        OUTPUT_PATH = os.path.abspath(output_path)

    with apidoc_containers():
        from sentry.runner import configure

        configure()

        sentry = Popen(
            [
                "sentry",
                "--config=" + SENTRY_CONFIG,
                "run",
                "web",
                "-w",
                "1",
                "--bind",
                "127.0.0.1:9000",
            ]
        )

        from django.core.management import call_command

        call_command(
            "migrate",
            interactive=False,
            traceback=True,
            verbosity=0,
            migrate=True,
            merge=True,
            ignore_ghost_migrations=True,
        )

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

        # HACK: the scenario in ProjectDetailsEndpoint#put requires our integration docs to be in place
        # so that we can validate the platform. We create the docker container that runs generator.py
        # with SENTRY_LIGHT_BUILD=1, which doesn't run `sync_docs` and `sync_docs` requires sentry
        # to be configured, which we do in this file. So, we need to do the sync_docs here.
        sync_docs(quiet=True)

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

        if output_format in ("json", "both"):
            output_json(sections, scenario_map, section_mapping)
        if output_format in ("markdown", "both"):
            output_markdown(sections, scenario_map, section_mapping)

    if sentry is not None:
        report("sentry", "Shutting down sentry server")
        sentry.kill()
        sentry.wait()


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

    # With nested URLs, we can have groups of URLs that are nested under multiple base URLs. We only want
    # them to show up once in the index.md. So, keep a set of endpoints we have already processed
    # to avoid duplication.
    processed_endpoints = set()

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

            if path not in processed_endpoints:
                links.append({"title": endpoint["title"], "path": path})
                processed_endpoints.add(path)
        dump_index_markdown(section, title, links)


def dump_json(path, data):
    path = os.path.join(OUTPUT_PATH, "json", path)
    try:
        os.makedirs(os.path.dirname(path))
    except OSError:
        pass
    with open(path, "w") as f:
        for line in json.dumps(data, indent=2, sort_keys=True).splitlines():
            f.write(line.rstrip() + "\n")


def dump_index_markdown(section, title, links):
    from sentry.web.helpers import render_to_string

    path = os.path.join(OUTPUT_PATH, "markdown", section, "index.md")
    try:
        os.makedirs(os.path.dirname(path))
    except OSError:
        pass
    with open(path, "w") as f:
        contents = render_to_string("sentry/apidocs/index.md", dict(title=title, links=links))
        f.write(contents)


def dump_markdown(path, data):
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


if __name__ == "__main__":
    cli()
