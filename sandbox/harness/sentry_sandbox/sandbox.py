"""Core sandbox lifecycle management.

A Sandbox wraps a Docker Compose stack (agent + postgres + redis) and
provides methods to execute commands, copy files, and manage the lifecycle.

Usage:
    from sentry_sandbox import Sandbox

    # Context manager (recommended)
    with Sandbox.create(tag="nightly") as sb:
        result = sb.exec("pytest -xvs tests/sentry/api/test_base.py")
        print(result.exit_code, result.stdout)

    # Manual lifecycle
    sb = Sandbox.create(tag="nightly")
    sb.start()
    result = sb.exec("pytest -xvs tests/sentry/api/test_base.py")
    sb.destroy()
"""

from __future__ import annotations

import dataclasses
import logging
import os
import shutil
import subprocess
import tempfile
import time
import uuid

logger = logging.getLogger(__name__)

# Default paths
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
_COMPOSE_FILE = os.path.join(_REPO_ROOT, "sandbox", "runtime", "docker-compose.sandbox.yml")

# Default resource limits
DEFAULT_CPUS = "4"
DEFAULT_MEMORY = "4g"
DEFAULT_TTL_SECONDS = 30 * 60  # 30 minutes


@dataclasses.dataclass(frozen=True)
class ExecResult:
    """Result of executing a command in a sandbox."""

    exit_code: int
    stdout: str
    stderr: str
    duration_seconds: float

    @property
    def success(self) -> bool:
        return self.exit_code == 0


@dataclasses.dataclass
class SandboxConfig:
    """Configuration for a sandbox instance."""

    agent_image_tag: str = "nightly"
    postgres_image_tag: str = "nightly"
    cpus: str = DEFAULT_CPUS
    memory: str = DEFAULT_MEMORY
    ttl_seconds: int = DEFAULT_TTL_SECONDS
    network_isolated: bool = False
    workspace_overlay: str | None = None
    compose_file: str = _COMPOSE_FILE


class Sandbox:
    """Manages a Sentry development sandbox.

    A sandbox is a Docker Compose stack with:
    - agent: Sentry codebase with Python/Node deps
    - postgres: Pre-migrated Postgres with all 4 databases
    - redis: Redis for caching and Celery broker
    """

    def __init__(self, sandbox_id: str, config: SandboxConfig) -> None:
        self._id = sandbox_id
        self._config = config
        self._started = False
        self._start_time: float | None = None

    @property
    def id(self) -> str:
        return self._id

    @property
    def is_running(self) -> bool:
        return self._started

    @classmethod
    def create(
        cls,
        tag: str = "nightly",
        postgres_tag: str | None = None,
        cpus: str = DEFAULT_CPUS,
        memory: str = DEFAULT_MEMORY,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
        network_isolated: bool = False,
        workspace_overlay: str | None = None,
        compose_file: str = _COMPOSE_FILE,
    ) -> Sandbox:
        """Create a new sandbox instance.

        Args:
            tag: Docker image tag for both agent and postgres images.
            postgres_tag: Override postgres image tag (defaults to `tag`).
            cpus: CPU limit per container (e.g., "4").
            memory: Memory limit per container (e.g., "4g").
            ttl_seconds: Maximum sandbox lifetime in seconds.
            network_isolated: If True, sandbox has no external network access.
            workspace_overlay: Local directory to overlay on the agent's /workspace.
            compose_file: Path to the Docker Compose file.
        """
        sandbox_id = f"sandbox-{uuid.uuid4().hex[:8]}"
        config = SandboxConfig(
            agent_image_tag=tag,
            postgres_image_tag=postgres_tag or tag,
            cpus=cpus,
            memory=memory,
            ttl_seconds=ttl_seconds,
            network_isolated=network_isolated,
            workspace_overlay=workspace_overlay,
            compose_file=compose_file,
        )
        return cls(sandbox_id, config)

    def __enter__(self) -> Sandbox:
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.destroy()

    def _compose_env(self) -> dict[str, str]:
        """Environment variables for Docker Compose."""
        env = {
            **os.environ,
            "SANDBOX_ID": self._id,
            "AGENT_IMAGE_TAG": self._config.agent_image_tag,
            "POSTGRES_IMAGE_TAG": self._config.postgres_image_tag,
            "SANDBOX_CPUS": self._config.cpus,
            "SANDBOX_MEMORY": self._config.memory,
            "SANDBOX_NETWORK_ISOLATED": str(self._config.network_isolated).lower(),
        }
        if self._config.workspace_overlay:
            env["WORKSPACE_OVERLAY"] = self._config.workspace_overlay
        return env

    def _compose_cmd(self, *args: str) -> list[str]:
        """Build a docker compose command."""
        return [
            "docker", "compose",
            "-f", self._config.compose_file,
            "-p", self._id,
            *args,
        ]

    def _run_compose(self, *args: str, check: bool = True, capture: bool = False) -> subprocess.CompletedProcess:
        """Run a docker compose command."""
        cmd = self._compose_cmd(*args)
        logger.debug("Running: %s", " ".join(cmd))
        return subprocess.run(
            cmd,
            env=self._compose_env(),
            capture_output=capture,
            text=True,
            check=check,
        )

    def start(self) -> None:
        """Start the sandbox (pull images and bring up services)."""
        if self._started:
            return

        logger.info("Starting sandbox %s...", self._id)
        self._start_time = time.monotonic()

        # Pull images first for better error messages
        self._run_compose("pull", "--quiet")

        # Start all services
        self._run_compose("up", "-d", "--wait")

        self._started = True
        elapsed = time.monotonic() - self._start_time
        logger.info("Sandbox %s started in %.1fs", self._id, elapsed)

    def exec(
        self,
        command: str,
        *,
        timeout: int | None = None,
        workdir: str | None = None,
        env: dict[str, str] | None = None,
    ) -> ExecResult:
        """Execute a command inside the agent container.

        Args:
            command: Shell command to run (passed to bash -c).
            timeout: Timeout in seconds (default: None = no timeout).
            workdir: Working directory inside the container.
            env: Additional environment variables.

        Returns:
            ExecResult with exit code, stdout, stderr, and duration.
        """
        if not self._started:
            raise RuntimeError("Sandbox not started. Call start() or use as context manager.")

        self._check_ttl()

        cmd = self._compose_cmd("exec", "-T")

        if workdir:
            cmd.extend(["-w", workdir])

        if env:
            for key, value in env.items():
                cmd.extend(["-e", f"{key}={value}"])

        cmd.extend(["agent", "bash", "-c", command])

        logger.debug("Exec in %s: %s", self._id, command)
        start = time.monotonic()

        try:
            result = subprocess.run(
                cmd,
                env=self._compose_env(),
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            duration = time.monotonic() - start
            return ExecResult(
                exit_code=result.returncode,
                stdout=result.stdout,
                stderr=result.stderr,
                duration_seconds=duration,
            )
        except subprocess.TimeoutExpired as e:
            duration = time.monotonic() - start
            return ExecResult(
                exit_code=-1,
                stdout=e.stdout.decode() if e.stdout else "",
                stderr=f"Command timed out after {timeout}s",
                duration_seconds=duration,
            )

    def copy_in(self, container_path: str, local_path: str) -> None:
        """Copy a local file into the agent container.

        Args:
            container_path: Destination path inside the container (relative to /workspace).
            local_path: Source path on the local filesystem.
        """
        if not self._started:
            raise RuntimeError("Sandbox not started.")

        container_name = f"{self._id}-agent"
        full_path = f"/workspace/{container_path}" if not container_path.startswith("/") else container_path

        subprocess.run(
            ["docker", "cp", local_path, f"{container_name}:{full_path}"],
            check=True,
        )
        logger.debug("Copied %s -> %s:%s", local_path, self._id, full_path)

    def copy_out(self, container_path: str, local_path: str) -> None:
        """Copy a file from the agent container to the local filesystem.

        Args:
            container_path: Source path inside the container (relative to /workspace).
            local_path: Destination path on the local filesystem.
        """
        if not self._started:
            raise RuntimeError("Sandbox not started.")

        container_name = f"{self._id}-agent"
        full_path = f"/workspace/{container_path}" if not container_path.startswith("/") else container_path

        subprocess.run(
            ["docker", "cp", f"{container_name}:{full_path}", local_path],
            check=True,
        )
        logger.debug("Copied %s:%s -> %s", self._id, full_path, local_path)

    def read_file(self, container_path: str) -> str:
        """Read a file from the agent container.

        Args:
            container_path: Path inside the container (relative to /workspace).

        Returns:
            File contents as a string.
        """
        result = self.exec(f"cat {container_path}")
        if not result.success:
            raise FileNotFoundError(f"Could not read {container_path}: {result.stderr}")
        return result.stdout

    def write_file(self, container_path: str, content: str) -> None:
        """Write content to a file in the agent container.

        Args:
            container_path: Path inside the container (relative to /workspace).
            content: File content to write.
        """
        with tempfile.NamedTemporaryFile(mode="w", suffix=".tmp", delete=False) as f:
            f.write(content)
            tmp_path = f.name

        try:
            self.copy_in(container_path, tmp_path)
        finally:
            os.unlink(tmp_path)

    def destroy(self) -> None:
        """Stop and remove the sandbox."""
        if not self._started:
            return

        logger.info("Destroying sandbox %s...", self._id)
        self._run_compose("down", "-v", "--remove-orphans", check=False)
        self._started = False
        logger.info("Sandbox %s destroyed", self._id)

    def _check_ttl(self) -> None:
        """Check if the sandbox has exceeded its TTL."""
        if self._start_time is None:
            return
        elapsed = time.monotonic() - self._start_time
        if elapsed > self._config.ttl_seconds:
            raise TimeoutError(
                f"Sandbox {self._id} has exceeded TTL of {self._config.ttl_seconds}s "
                f"(running for {elapsed:.0f}s). Destroy and create a new one."
            )

    def logs(self, service: str = "agent", tail: int = 100) -> str:
        """Get logs from a service in the sandbox."""
        result = self._run_compose("logs", "--tail", str(tail), service, capture=True, check=False)
        return result.stdout
