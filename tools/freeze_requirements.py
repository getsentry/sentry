import logging

# logging is thread-safe, just using it as a dumb printer
logging.basicConfig(level=logging.INFO, format='%(message)s')
print = logging.info

import os
from threading import Thread
from subprocess import run

worker_rc = [None, None, None]

def worker(i, args):
    args_pretty = ' '.join(args)
    print(f"+ {args_pretty}")
    proc = run(args, capture_output=True)
    rc = proc.returncode
    print(f"+ {args_pretty} returned {rc}")
    if rc != 0:
        print(f"stdout: {proc.stdout}\nstderr: {proc.stderr}")
    worker_rc[i] = rc

def main() -> int:
    from .lib import gitroot

    os.chdir(gitroot())

    threads = (
        Thread(target=worker, args=(0, (
            "pip-compile", "-q",
            "requirements-base.txt",
            "-o", "requirements-frozen.txt",
        ))),
        Thread(target=worker, args=(1, (
            "pip-compile", "-q",
            "requirements-dev.txt",
            "-o", "requirements-dev-only-frozen.txt",
        ))),
        Thread(target=worker, args=(2, (
            "pip-compile", "-q",
            "requirements-base.txt",
            "requirements-dev.txt",
            "-o", "requirements-dev-frozen.txt",
        ))),
    )
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    for rc in worker_rc:
        if rc is None or rc != 0:
            return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
