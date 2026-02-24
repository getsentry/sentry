# Docker Security Reference

## Overview

Container security involves the Dockerfile, image composition, runtime configuration, and orchestration. Misconfigurations can lead to container escapes, privilege escalation, or exposure of sensitive data.

---

## Dockerfile Security

### Running as Root

```dockerfile
# VULNERABLE: Running as root (default)
FROM node:18
COPY . /app
CMD ["node", "app.js"]  # Runs as root

# SAFE: Non-root user
FROM node:18
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
WORKDIR /app
COPY --chown=appuser:appgroup . .
USER appuser
CMD ["node", "app.js"]

# SAFE: Using numeric UID (more portable)
USER 1000:1000
```

### Base Image Issues

```dockerfile
# VULNERABLE: Using latest tag (unpredictable)
FROM node:latest
FROM ubuntu:latest

# VULNERABLE: Using untrusted/unverified base image
FROM randomuser/myimage

# SAFE: Pinned versions with digest
FROM node:18.19.0-alpine@sha256:abc123...
FROM python:3.11.7-slim-bookworm

# SAFE: Official images from verified publishers
FROM docker.io/library/node:18.19.0-alpine
```

### Sensitive Data in Images

```dockerfile
# VULNERABLE: Secrets in build args visible in history
ARG DB_PASSWORD
RUN echo $DB_PASSWORD > /config

# VULNERABLE: Copying secrets into image
COPY .env /app/.env
COPY secrets.json /app/
COPY id_rsa /root/.ssh/

# VULNERABLE: Secrets in environment variables
ENV API_KEY=sk-12345
ENV DB_PASSWORD=mysecret

# SAFE: Mount secrets at runtime
# docker run -v /secrets:/secrets:ro myimage
# Or use Docker secrets in Swarm/K8s
```

### Build-Time Secrets

```dockerfile
# SAFE: Multi-stage build to exclude secrets
FROM node:18 AS builder
# Use build-time secret (Docker BuildKit)
RUN --mount=type=secret,id=npm_token \
    NPM_TOKEN=$(cat /run/secrets/npm_token) npm install

FROM node:18-alpine
COPY --from=builder /app/node_modules /app/node_modules
# Secret not in final image

# Build with: docker build --secret id=npm_token,src=.npmrc .
```

### Package Installation

```dockerfile
# VULNERABLE: Not cleaning up package manager cache
RUN apt-get update && apt-get install -y curl wget
# Leaves cache, increases image size and attack surface

# VULNERABLE: Installing unnecessary packages
RUN apt-get install -y vim nano curl wget git ssh

# SAFE: Minimal installation with cleanup
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# SAFE: Using minimal base images
FROM alpine:3.19
FROM gcr.io/distroless/nodejs18
FROM scratch  # Empty base image
```

### COPY vs ADD

```dockerfile
# VULNERABLE: ADD can auto-extract and fetch URLs
ADD https://example.com/file.tar.gz /app/  # Downloads from URL
ADD archive.tar.gz /app/  # Auto-extracts

# SAFE: COPY is more explicit
COPY archive.tar.gz /app/
RUN tar -xzf /app/archive.tar.gz && rm /app/archive.tar.gz
```

### Exposed Ports

```dockerfile
# CHECK: Are all exposed ports necessary?
EXPOSE 22  # FLAG: SSH in container usually unnecessary
EXPOSE 3306  # FLAG: Database port exposed
EXPOSE 80 443 8080 9090 5000  # CHECK: Multiple ports

# SAFE: Only expose what's needed
EXPOSE 8080
```

---

## Image Scanning

### Vulnerability Patterns

```bash
# Scan for vulnerabilities
docker scan myimage
trivy image myimage
grype myimage

# Check for secrets in image
trufflehog docker --image myimage
# Or manually inspect layers
docker history --no-trunc myimage
```

### High-Risk Packages

```dockerfile
# FLAG: Packages that increase attack surface
RUN apt-get install -y \
    openssh-server \  # SSH access
    sudo \            # Privilege escalation
    netcat \          # Network tools
    nmap \            # Network scanning
    gcc make \        # Compilers (should be in build stage only)
    python3-pip       # Package managers (install deps, then remove)
```

---

## Runtime Security

### Privileged Mode

```bash
# VULNERABLE: Running privileged (full host access)
docker run --privileged myimage

# VULNERABLE: Dangerous capabilities
docker run --cap-add=ALL myimage
docker run --cap-add=SYS_ADMIN myimage
docker run --cap-add=NET_ADMIN myimage

# SAFE: Drop all capabilities, add only needed
docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE myimage

# SAFE: Read-only root filesystem
docker run --read-only myimage

# SAFE: No new privileges
docker run --security-opt=no-new-privileges myimage
```

### Volume Mounts

```bash
# VULNERABLE: Mounting sensitive host paths
docker run -v /:/host myimage           # Entire host filesystem
docker run -v /etc:/etc myimage         # Host config files
docker run -v /var/run/docker.sock:/var/run/docker.sock  # Docker socket

# VULNERABLE: Writable mounts of sensitive paths
docker run -v /etc/passwd:/etc/passwd myimage

# SAFE: Specific paths, read-only where possible
docker run -v /app/data:/data:ro myimage
docker run -v myvolume:/app/data myimage  # Named volume
```

### Docker Socket Access

```bash
# CRITICAL: Docker socket mount = root on host
docker run -v /var/run/docker.sock:/var/run/docker.sock myimage
# Container can create privileged containers, access host

# If required, use read-only and restrict with authz plugin
# Or use Docker API proxy with limited permissions
```

### Network Security

```bash
# VULNERABLE: Host network mode
docker run --network=host myimage  # No network isolation

# SAFE: User-defined networks with isolation
docker network create --internal internal-net  # No external access
docker run --network=internal-net myimage

# SAFE: Restrict inter-container communication
docker network create --driver=bridge --opt com.docker.network.bridge.enable_icc=false isolated
```

### Resource Limits

```bash
# VULNERABLE: No resource limits (DoS risk)
docker run myimage

# SAFE: Set memory and CPU limits
docker run --memory=512m --cpus=1 myimage

# SAFE: Limit processes
docker run --pids-limit=100 myimage
```

---

## Docker Compose Security

### Secrets Management

```yaml
# VULNERABLE: Secrets in environment
services:
  app:
    environment:
      - DB_PASSWORD=mysecret
      - API_KEY=sk-12345

# SAFE: Use secrets
services:
  app:
    secrets:
      - db_password
    environment:
      - DB_PASSWORD_FILE=/run/secrets/db_password

secrets:
  db_password:
    external: true  # Or file: ./secrets/db_password
```

### Privilege Restrictions

```yaml
# SAFE: Security options in compose
services:
  app:
    image: myimage
    user: "1000:1000"
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    tmpfs:
      - /tmp
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1'
```

### Network Isolation

```yaml
# SAFE: Internal networks for backend services
services:
  frontend:
    networks:
      - public
      - internal

  backend:
    networks:
      - internal  # Not accessible from outside

  database:
    networks:
      - internal

networks:
  public:
  internal:
    internal: true  # No external access
```

---

## .dockerignore

### Required Exclusions

```dockerignore
# SAFE: Exclude sensitive files
.env
.env.*
*.pem
*.key
id_rsa*
secrets/
credentials/
.git/
.gitignore
.dockerignore
Dockerfile
docker-compose*.yml
*.log
node_modules/
__pycache__/
.pytest_cache/
coverage/
.nyc_output/
```

### Missing .dockerignore

```bash
# FLAG: No .dockerignore may copy secrets into image
# Check if .env, keys, or credentials are copied
```

---

## Registry Security

### Image Pull Policy

```yaml
# VULNERABLE: Always pulling latest
image: myregistry/myimage:latest

# VULNERABLE: No digest verification
image: myregistry/myimage:1.0

# SAFE: Pinned with digest
image: myregistry/myimage@sha256:abc123...
```

### Private Registry Auth

```bash
# VULNERABLE: Credentials in plain text
docker login -u user -p password registry.example.com

# SAFE: Use credential helpers
# ~/.docker/config.json
{
  "credHelpers": {
    "gcr.io": "gcloud",
    "*.dkr.ecr.*.amazonaws.com": "ecr-login"
  }
}
```

---

## Grep Patterns for Dockerfiles

```bash
# Running as root
grep -rn "^USER" Dockerfile || echo "No USER directive - runs as root"

# Secrets in environment
grep -rn "^ENV.*PASSWORD\|^ENV.*SECRET\|^ENV.*KEY\|^ENV.*TOKEN" Dockerfile

# Secrets in build args
grep -rn "^ARG.*PASSWORD\|^ARG.*SECRET\|^ARG.*KEY" Dockerfile

# Latest tags
grep -rn "FROM.*:latest\|FROM.*@" Dockerfile | grep -v "@sha256"

# Privileged instructions
grep -rn "^ADD\|EXPOSE 22\|apt-get install.*ssh" Dockerfile

# Missing cleanup
grep -rn "apt-get install" Dockerfile | grep -v "rm -rf"
```

---

## Testing Checklist

- [ ] Container runs as non-root user
- [ ] Base image is pinned with digest
- [ ] No secrets in image layers (ENV, ARG, COPY)
- [ ] Multi-stage build for secrets/build tools
- [ ] Minimal base image (alpine, distroless)
- [ ] Package manager cache cleaned
- [ ] .dockerignore excludes sensitive files
- [ ] No --privileged or dangerous capabilities
- [ ] No Docker socket mount
- [ ] Resource limits configured
- [ ] Network isolation configured
- [ ] Image scanned for vulnerabilities
- [ ] Read-only root filesystem where possible

---

## References

- [Docker Security Best Practices](https://docs.docker.com/develop/security-best-practices/)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)
- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
