from __future__ import annotations

import select
import shutil
import subprocess
import threading
from pathlib import Path
from typing import Any

from sentry.utils import json
from sentry.utils.json import JSONDecodeError


def _find_repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "pyproject.toml").exists():
            return parent
    raise FileNotFoundError("Could not find repository root")


_REPO_ROOT = _find_repo_root()

_BINARY_CANDIDATES = [
    _REPO_ROOT / "node_modules" / ".bin" / "odiff",
    Path("/usr/local/bin/odiff"),
]


def _find_odiff_binary() -> str:
    for candidate in _BINARY_CANDIDATES:
        if candidate.exists():
            return str(candidate)
    found = shutil.which("odiff")
    if found:
        return found
    raise FileNotFoundError("odiff binary not found. Run 'pnpm install' to install odiff-bin.")


class OdiffServer:
    def __init__(self) -> None:
        self._process: subprocess.Popen[bytes] | None = None
        self._request_id = 0
        self._lock = threading.Lock()

    def __enter__(self) -> OdiffServer:
        self._start()
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def _read_json(
        self, line: bytes, process: subprocess.Popen[bytes] | None = None
    ) -> dict[str, Any]:
        if not line:
            proc = process or self._process
            stderr = proc.stderr.read() if proc and proc.stderr else b""
            raise RuntimeError(
                f"odiff server exited unexpectedly: {stderr.decode(errors='replace')}"
            )
        try:
            return json.loads(line)
        except JSONDecodeError as e:
            raise RuntimeError(f"odiff server returned invalid JSON: {line!r}") from e

    def _start(self) -> None:
        binary = _find_odiff_binary()
        proc = subprocess.Popen(
            [binary, "--server"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            start_new_session=True,
        )
        try:
            readable, _, _ = select.select([proc.stdout], [], [], 30)
            if not readable:
                raise RuntimeError("odiff server timed out waiting for ready message")
            line = proc.stdout.readline()  # type: ignore[union-attr]
            ready = self._read_json(line, proc)
            if not ready.get("ready"):
                raise RuntimeError("odiff server failed to start")
        except BaseException:
            proc.kill()
            proc.wait()
            raise
        self._process = proc

    def compare(
        self,
        base_path: str | Path,
        compare_path: str | Path,
        output_path: str | Path,
        **options: object,
    ) -> dict[str, Any]:
        with self._lock:
            if self._process is None:
                self._start()

            process = self._process
            if process is None or process.stdin is None or process.stdout is None:
                raise RuntimeError("odiff server failed to initialize")
            self._request_id += 1
            request: dict[str, object] = {
                "requestId": self._request_id,
                "base": str(base_path),
                "compare": str(compare_path),
                "output": str(output_path),
            }
            if options:
                request["options"] = options

            try:
                process.stdin.write(json.dumps(request).encode() + b"\n")
                process.stdin.flush()
            except (BrokenPipeError, OSError) as e:
                process.kill()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    pass
                self._process = None
                raise RuntimeError("odiff process died unexpectedly") from e

            readable, _, _ = select.select([process.stdout], [], [], 30)
            if not readable:
                process.kill()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    pass
                self._process = None
                raise RuntimeError("odiff server timed out after 30s")
            line = process.stdout.readline()
            try:
                response = self._read_json(line)
            except RuntimeError:
                process.kill()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    pass
                self._process = None
                raise

        if "error" in response:
            raise RuntimeError(f"odiff error: {response['error']}")

        return response

    def close(self) -> None:
        with self._lock:
            if not self._process:
                return
            proc = self._process
            self._process = None

        if proc.stdin:
            try:
                proc.stdin.close()
            except OSError:
                pass
        try:
            proc.wait(timeout=3)
            return
        except subprocess.TimeoutExpired:
            pass
        proc.terminate()
        try:
            proc.wait(timeout=5)
            return
        except subprocess.TimeoutExpired:
            pass
        proc.kill()
        proc.wait()

    def __del__(self) -> None:
        self.close()
