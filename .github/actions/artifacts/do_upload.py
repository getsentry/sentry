#!/usr/bin/env python3

import os
import subprocess
from threading import Thread


def run_command(command: list[str], log_file: str):
    with open(log_file, "wb") as f:
        subprocess.run(command, stdout=f, stderr=f, shell=True, check=True)


def run_command_in_thread(command: list[str], log_file: str) -> Thread:
    thread = Thread(target=run_command, args=(command, log_file))
    thread.start()
    return thread


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
        "--commit-sha",
        input_commit_sha,
        "--plugin",
        "noop",
        "--flag",
        input_type,
    ]

    upload_coverage_cmd = [*codecov_base_cmd, "upload-process", *upload_flags]
    for file in input_files:
        upload_coverage_cmd += ["--file", file]

    upload_coverage_log_file = "coverage-upload.log"
    upload_coverage_thread = run_command_in_thread(upload_coverage_cmd, upload_coverage_log_file)

    upload_test_results_cmd = [
        *codecov_base_cmd,
        "do-upload",
        "--report-type",
        "test_results",
        *upload_flags,
    ]
    for file in input_test_result_files:
        upload_test_results_cmd += ["--file", file]

    upload_test_results_log_file = "do-upload.log"
    upload_test_results_thread = run_command_in_thread(
        upload_test_results_cmd, upload_test_results_log_file
    )

    upload_coverage_thread.join()
    upload_test_results_thread.join()

    # so that the logs are not interleaved when printed
    with open(upload_coverage_log_file) as f:
        print(f.read())
    with open(upload_test_results_log_file) as f:
        print(f.read())


if __name__ == "__main__":
    main()
