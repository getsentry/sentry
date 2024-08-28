#!/usr/bin/env python3

import glob
import itertools
import os
from subprocess import Popen


def run_command(command: list[str], log_file: str):
    with open(log_file, "wb") as f:
        return Popen(command, stdout=f, stderr=f)


def get_files(input_files: list[str]) -> list[str]:
    """
    this function expands the globs specified in the input file then
    filters for paths that are actually files
    """
    glob_expanded_files = [glob.glob(file, recursive=True) for file in input_files]
    flattened_glob_matches = list(itertools.chain.from_iterable(glob_expanded_files))
    filtered_glob_matches = [file for file in flattened_glob_matches if os.path.isfile(file)]
    return filtered_glob_matches


def main():
    """
    First we get the arguments passed to the upload artifacts action via the env vars,
    then we build the command for uploading coverage, run it in a thread, and build the
    command for uploading test results and run it in a thread. We wait for both commands
    to finish running then print their logs sequentially.

    When we run the commands we're piping their stdout and stderr to a file so we can print the
    contents of the files sequentially. We don't want the output of each command to be interleaved.

    --plugin noop is passed to both commands, we don't need the CLI plugins because we're already
    generating the coverage files ourselves.
    """
    input_token = os.getenv("INPUT_TOKEN")
    input_commit_sha = os.getenv("INPUT_COMMIT_SHA")
    input_type = os.getenv("INPUT_TYPE")
    input_files = os.getenv("INPUT_FILES", "").split(",")
    input_test_result_files = os.getenv("INPUT_TEST_RESULT_FILES", "").split(",")

    codecov_base_cmd = ["./codecov", "--verbose"]

    upload_flags = [
        "-t",
        input_token,
        "--plugin",
        "noop",
        "--flag",
        input_type,
    ]

    if input_commit_sha:
        upload_flags += ["--commit-sha", input_commit_sha]

    upload_coverage_cmd = [*codecov_base_cmd, "upload-process", *upload_flags]

    coverage_files = get_files(input_files)
    for file in coverage_files:
        upload_coverage_cmd += ["--file", file]

    upload_coverage_log_file = "coverage-upload.log"

    test_result_files = get_files(input_test_result_files)

    upload_test_results_cmd = [
        *codecov_base_cmd,
        "do-upload",
        "--report-type",
        "test_results",
        *upload_flags,
    ]
    for file in test_result_files:
        upload_test_results_cmd += ["--file", file]

    upload_test_results_log_file = "upload-test-results.log"

    # so that the logs are not interleaved when printed
    jobs = [
        run_command(upload_test_results_cmd, upload_test_results_log_file),
        run_command(upload_coverage_cmd, upload_coverage_log_file),
    ]
    tail_args = ("tail", "-f", "--sleep-interval", "3")
    for job in jobs:
        tail_args += ("--pid", str(job.pid))
    tail_args += (
        upload_coverage_log_file,
        upload_test_results_log_file,
    )

    # wait, while showing un-interleaved logs
    jobs.append(Popen(tail_args))

    return_codes = []

    for job in jobs:
        job.wait()

    if any(return_codes):
        raise Exception("Error uploading to codecov")


if __name__ == "__main__":
    main()
