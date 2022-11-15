#!/usr/bin/env python3

import asyncio
import logging
import os
import unittest


async def run_cmd(
    cmd: str,
    retries=3,
    timeout=5,
    run=True,
    with_cmd_stdout=False,
    with_cmd_stderr=False,
):
    """
    Provides functionality to run any command asynchronously.
    It returns the exit code of the command and prints stderr in case if
    there was an error.

    Parameters
    ----------
    cmd: str
        the command to run
    retries: int, optional
        the number of tries the command will be run before giving up
    timeout: int, optional
        the number of seconds to wait between the retries
    run: boolean, optional
        if the command should be actually run
    with_stdout: boolean, optional
        if True it will print the stdout of the executed command
    with_stderr: boolean, optional
        if True it will print the stderr of the executed command
    """
    if run:
        proc = await asyncio.subprocess.create_subprocess_shell(
            cmd=cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await proc.communicate()

        if with_cmd_stdout and stdout:
            logging.info(f"[stdout]\n{stdout.decode()}")

        if proc.returncode != 0:
            if with_cmd_stderr and stderr:
                logging.info(f"[stderr]\n{stderr.decode()}")

            # Run command again if there are some retries left
            if retries > 0:
                logging.info(f"Trying {cmd!r} {retries} more time(s)...")
                await asyncio.sleep(timeout)
                return await run_cmd(cmd, retries=retries - 1)
        else:
            logging.info(f"{cmd!r}\t[OK]")

        return (proc.returncode, cmd)
    else:
        return (0, None)


async def main():
    """
    Main function.
    """

    logging.basicConfig(level=logging.INFO, format="%(asctime)s: %(message)s")

    # HEALTH CHECKS
    postgres_healthcheck = "docker exec sentry_postgres pg_isready -U postgres"
    kafka_healthcheck = "docker exec sentry_kafka kafka-topics --zookeeper 127.0.0.1:2181 --list"

    results = await asyncio.gather(
        # Postgres check runs always
        run_cmd(postgres_healthcheck),
        # Kafka check is run only if the kafka needed
        run_cmd(kafka_healthcheck, run=True if os.getenv("NEED_KAFKA") else False),
    )

    failed = [c for (r, c) in filter(lambda r: r[0] != 0, results)]

    if failed:
        # Print the status
        for fail in failed:
            logging.info(f"{fail!r}\t\t[FAIL]")

        exit(1)


# Run main.
if __name__ == "__main__":
    asyncio.run(main())


# Tests
class HealthCheckTests(unittest.IsolatedAsyncioTestCase):
    async def test_cmd_run_fail(self):
        result, cmd = await run_cmd("i_dont_exist", retries=0)
        self.assertNotEqual(result, 0, "Non existing command returned error.")

    async def test_cmd_run(self):
        result, cmd = await run_cmd("ls -la .")
        self.assertEqual(result, 0, "Running command should succeed.")
