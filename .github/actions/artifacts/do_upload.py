#!/usr/bin/env python3

import glob
import itertools
import os
from subprocess import Popen


def run_command(command: list[str], log_file: str):
    with open(log_file, "wb") as f:
        return Popen(command, stdout=f, stderr=f)


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

    glob_expanded_coverage_files = [glob.glob(file, recursive=True) for file in input_files]
    coverage_files = list(itertools.chain.from_iterable(glob_expanded_coverage_files))

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
    for file in coverage_files:
        upload_coverage_cmd += ["--file", file]

    upload_coverage_log_file = "coverage-upload.log"

    glob_expanded_test_result_files = [
        glob.glob(file, recursive=True) for file in input_test_result_files
    ]
    test_result_files = list(itertools.chain.from_iterable(glob_expanded_test_result_files))

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
