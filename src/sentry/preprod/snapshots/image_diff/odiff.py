from __future__ import annotations

import platform
import select
import shutil
import subprocess
import threading
from pathlib import Path

from sentry.preprod.snapshots.image_diff.types import OdiffResponse
from sentry.utils import json

ODIFF_PLATFORM_SUFFIXES = {
    ("arm64", "Darwin"): "macos-arm64",
    ("aarch64", "Darwin"): "macos-arm64",
    ("x86_64", "Darwin"): "macos-x64",
    ("x86_64", "Linux"): "linux-x64",
    ("aarch64", "Linux"): "linux-arm64",
    ("arm64", "Linux"): "linux-arm64",
}


def _find_odiff_binary() -> str:
    suffix = ODIFF_PLATFORM_SUFFIXES.get((platform.machine(), platform.system()))

    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "pyproject.toml").exists():
            if suffix:
                raw = parent / "node_modules" / "odiff-bin" / "raw_binaries" / f"odiff-{suffix}"
                if raw.exists():
                    return str(raw)
            break

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
        with self._lock:
            if self._process is None:
                self._start()
        return self

    def __exit__(self, *args: object) -> None:
        self.close()

    def _read_response(self, line: bytes) -> OdiffResponse:
        if not line:
            raise RuntimeError("odiff server exited unexpectedly")
        return OdiffResponse.parse_obj(json.loads(line))

    def _kill_process(self) -> None:
        proc = self._process
        self._process = None
        if proc is None:
            return
        proc.kill()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass

    def _start(self) -> None:
        binary = _find_odiff_binary()
        proc = subprocess.Popen(
            [binary, "--server"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        try:
            readable, _, _ = select.select([proc.stdout], [], [], 30)
            if not readable:
                raise RuntimeError("odiff server timed out waiting for ready message")
            line = proc.stdout.readline()  # type: ignore[union-attr]
            ready = json.loads(line)
            if not ready.get("ready"):
                raise RuntimeError("odiff server failed to start")
        except BaseException:
            proc.kill()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass
            raise
        self._process = proc

    def compare(
        self,
        base_path: str | Path,
        compare_path: str | Path,
        output_path: str | Path,
        **options: object,
    ) -> OdiffResponse:
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
                self._kill_process()
                raise RuntimeError("odiff process died unexpectedly") from e

            readable, _, _ = select.select([process.stdout], [], [], 30)
            if not readable:
                self._kill_process()
                raise RuntimeError("odiff server timed out after 30s")
            line = process.stdout.readline()
            try:
                response = self._read_response(line)
            except RuntimeError:
                self._kill_process()
                raise

        if response.error:
            raise RuntimeError(f"odiff error: {response.error}")

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
        if proc.stdout:
            try:
                proc.stdout.close()
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
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            pass
