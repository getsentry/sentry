#!/usr/bin/env python

import argparse
import configparser
import hashlib
import logging
import os
import re
import subprocess
import sys
from collections import defaultdict
from typing import Any, Mapping, MutableMapping, Optional, Set

from codeowners import CodeOwners

"""
Calculate python typing progress by teams as determined by CODEOWNERS.
"""

BAR_LENGTH = 60
UNOWNED_KEY = "other"
TOTALS_KEY = "TOTAL"
CACHE_SEPARATOR = "\t"
TEAM_REGEX = re.compile(r"@\S+/\S+")
# TODO pass directories and ignores as parameters
ROOT = {"src/"}
# TODO make these regexes
IGNORE = {"src/sentry/migrations/"}

# Collect config files
BASE_DIR = os.getcwd()
config_filename = os.path.join(BASE_DIR, "mypy.ini")
codeowners_filename = os.path.join(BASE_DIR, ".github/CODEOWNERS")

logger = logging.getLogger(__name__)
logging.basicConfig(stream=sys.stdout, level=logging.INFO)


def get_source_files() -> Set[str]:
    logger.debug(f"get_source_files {config_filename}")
    config = configparser.ConfigParser()
    config.read(config_filename)
    files = config["mypy"]["files"]
    logger.debug(files)
    return {filename.strip() for filename in files.split(",")}


def flatten_directories(paths: Set[str]) -> Set[str]:
    """
    For a list of files, recursively turn the directories into lists of their
    component files while passing along non-directories.
    """
    result = set()
    for path in paths:
        if path in IGNORE:
            continue

        if os.path.isdir(path):
            next_level = {os.path.join(path, x) for x in os.listdir(path)}
            flattened = flatten_directories(next_level)
            result.update(flattened)
        elif path.endswith(".py"):
            result.add(path)
    return result


def get_all_teams(team: Optional[str] = None) -> Set[str]:
    """
    Re-read the codeowners file looking for team names. This isn't a full
    solution because it doesn't skip commented lines. I wish the codeowners
    parse did this for us.
    """
    if team:
        return {team}

    teams = set()
    with open(codeowners_filename) as f:
        for line in f.readlines():
            teams.update(TEAM_REGEX.findall(line))

    logger.debug("All teams")
    logger.debug("\n".join(teams))
    return teams


def split_files_by_codeowner(files: Set[str], codeowners: Any) -> MutableMapping[str, Set[str]]:
    """
    Given a list of filenames and a codeowners objects, split the files up by
    owner. This isn't a full solution because it doesn't handle multiple owners
    on a file.
    """
    files_by_codeowner = defaultdict(set)
    for filename in files:
        owners = codeowners.of(filename)
        logger.debug(f"{filename} {owners}")

        owners = {owner[1] for owner in owners} if owners else {UNOWNED_KEY}
        for owner in owners:
            files_by_codeowner[owner].add(filename)
    return files_by_codeowner


def load_cache(filename: Optional[str] = None) -> MutableMapping[str, int]:
    logger.debug(f"loading cache from {filename}")

    if not (filename and os.path.exists(filename)):
        logger.debug("file not found")
        return {}

    cache = {}
    with open(filename) as f:
        try:
            for line in f.readlines():
                key, value = line.split(CACHE_SEPARATOR)
                cache[key] = int(value)
        except (AttributeError, OSError, TypeError, ValueError):
            return {}
    return cache


def store_cache(cache: Mapping[str, int], filename: str) -> None:
    # TODO We don't garbage collect stale hashes so the file cache will continue
    #  to grow indefinitely.
    if not filename:
        return

    with open(filename, "w") as f:
        for key, value in cache.items():
            f.write(f"{key}{CACHE_SEPARATOR}{value}\n")


def hash_file(filename: str) -> str:
    """https://stackoverflow.com/questions/22733826"""
    func = hashlib.md5()
    with open(filename, "rb") as f:
        while True:
            block = f.read(1024 * func.block_size)
            if not block:
                break
            func.update(block)
    return func.hexdigest()


def analyze_file(file: str, cache: MutableMapping[str, int]) -> int:
    """Evan"s algorithm for grabbing LOC from a file."""
    filename = os.path.join(BASE_DIR, file)

    key = hash_file(filename)
    cached_value = cache.get(key)
    if cached_value is not None:
        logger.debug(f"cache hit {filename}")
        return cached_value

    logger.debug(f"cache size {len(cache.keys())}")
    logger.debug(f"cache miss {filename} {key}")
    proc_cmd = f"pygount {filename} --format=summary --suffix=py"
    proc = subprocess.run(proc_cmd.split(" "), capture_output=True)
    output = proc.stdout.decode("utf-8")
    value = int(output.split("\n")[-2].split()[-2])

    cache[key] = value
    return value


def total_lines(files: Set[str], cache: MutableMapping[str, int], status: str = "") -> int:
    """Gets the total lines and primes the cache."""
    total = 0
    for i, file in enumerate(files):
        total += analyze_file(file, cache)
        progress(i, len(files), status)
    return total


def analyze_files(
    files: Set[str],
    codeowners: Any,
    cache: MutableMapping[str, int],
    teams: Set[str],
    status: str = "",
) -> Mapping[str, int]:
    logger.debug(f"file count {len(files)}")
    logger.debug(f"teams: {teams}")

    # This is slow.
    total = total_lines(files, cache, status)
    files_by_codeowner = split_files_by_codeowner(files, codeowners)

    count_by_team = defaultdict(int)
    for team in teams:
        subset_of_files = files_by_codeowner.get(team, [])
        logger.debug(f"{team} {len(subset_of_files)}")
        for file in subset_of_files:
            value = analyze_file(file, cache)
            count_by_team[team] += value
            logger.debug(f"{value} {file}")

    logger.debug(count_by_team)
    count_by_team[TOTALS_KEY] = total
    return count_by_team


def get_result(
    covered_by_team: Mapping[str, int],
    not_covered_by_team: Mapping[str, int],
    team: str,
) -> float:
    covered = covered_by_team.get(team, 0)
    total = covered + not_covered_by_team.get(team, 0)
    return ((float(covered) / float(total)) * 100) if total else 0.0


def print_results(
    covered_by_team: Mapping[str, int],
    not_covered_by_team: Mapping[str, int],
    teams: Set[str],
) -> None:
    """Pretty print the results."""
    tuples = sorted(
        ((team, get_result(covered_by_team, not_covered_by_team, team)) for team in teams),
        key=lambda x: x[1],
    ) + [(TOTALS_KEY, get_result(covered_by_team, not_covered_by_team, TOTALS_KEY))]

    bar = "=" * int(BAR_LENGTH / 2)
    print(f"{bar} Python coverage by team {bar}")  # NOQA S002
    for team, percent in tuples:
        if percent:
            print(f"{team:<32} {(percent):.2f}%")  # NOQA S002


def setup_args() -> Any:
    # TODO take a config file
    parser = argparse.ArgumentParser(
        description="Generate a python typing report",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="run script in debug mode",
    )
    parser.add_argument(
        "--team",
        "-t",
        action="store",
        type=str,
        help="only run analytics on this team",
    )
    parser.add_argument(
        "--cache",
        "-c",
        action="store",
        type=str,
        help="the location of a cache file",
    )
    return parser.parse_args()


def progress(count: int, total: int, status: str = "") -> None:
    """
    https://gist.github.com/vladignatyev/06860ec2040cb497f0f3
    """
    if logger.level == logging.DEBUG:
        # progress is incompatible with logger for just don't try.
        return
    filled_len = int(round(BAR_LENGTH * count / float(total)))

    percents = round(100.0 * count / float(total), 1)
    bar = "=" * filled_len + "-" * (BAR_LENGTH - filled_len)

    sys.stdout.write(f"[{bar}] {percents}% ...{status}\r")
    sys.stdout.flush()


def main() -> None:
    args = setup_args()
    if args.verbose:
        logger.setLevel(logging.DEBUG)

    with open(codeowners_filename) as f:
        codeowners = CodeOwners("\n".join(f.readlines()))

    covered_files = flatten_directories(get_source_files())
    all_files = flatten_directories(ROOT)
    cache = load_cache(args.cache)
    teams = get_all_teams(team=args.team)

    covered = analyze_files(covered_files, codeowners, cache, teams=teams, status="mypy.ini")

    # If the team has no coverage, then don't bother getting the denominator.
    teams_with_covered_lines = {t for t in teams if covered.get(t, 0) > 0}

    not_covered = analyze_files(
        all_files - covered_files, codeowners, cache, teams=teams_with_covered_lines, status="root"
    )
    store_cache(cache, args.cache)
    print_results(covered, not_covered, teams)


if __name__ == "__main__":
    main()
