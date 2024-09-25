import os
import select
import subprocess
import sys
import time

from sentry.services.http import PYUWSGI_PROG


def test_wsgi_init():
    os.environ["UWSGI_HTTP_SOCKET"] = "127.0.0.1:9001"
    os.environ["UWSGI_MODULE"] = "sentry.wsgi:application"
    os.environ["TEST_WARMUP"] = "1"
    cmd = (
        sys.executable,
        "-c",
        PYUWSGI_PROG,
    )

    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    def read_pipes(pipes, timeout=0.1):
        readable, _, _ = select.select(pipes, [], [], timeout)
        output = []
        for pipe in readable:
            line = pipe.readline()
            if line:
                output.append(line)
        return output

    # Wait for up to 10 seconds for the server to start
    start_time = time.time()
    output = []
    while time.time() - start_time < 10:
        new_output = read_pipes([process.stdout, process.stderr])
        output.extend(new_output)

        if "warmup complete" in "".join(output).lower():
            break

        time.sleep(0.1)
    else:
        raise AssertionError("WSGI server did not start within the timeout period")

    full_output = "".join(output)
    assert "warmup complete" in full_output

    process.kill()
    process.wait()

    if process.stdout:
        process.stdout.close()
    if process.stderr:
        process.stderr.close()
