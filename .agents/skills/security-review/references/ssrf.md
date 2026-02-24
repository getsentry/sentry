# Server-Side Request Forgery (SSRF) Prevention Reference

## Overview

SSRF vulnerabilities allow attackers to induce the server-side application to make HTTP requests to an arbitrary domain of the attacker's choosing. This can be used to:

- Access internal services not exposed to the internet
- Read cloud metadata (AWS, GCP, Azure credentials)
- Scan internal networks
- Bypass firewalls and access controls
- Exploit internal services with known vulnerabilities

## Attack Scenarios

### Cloud Metadata Access (AWS)

```bash
# Attacker provides URL:
http://169.254.169.254/latest/meta-data/iam/security-credentials/role-name

# Server fetches and returns AWS credentials:
{
  "AccessKeyId": "ASIA...",
  "SecretAccessKey": "...",
  "Token": "..."
}
```

### Internal Service Access

```bash
# Attacker provides URL:
http://localhost:8080/admin/delete-all
http://internal-service.local/sensitive-data

# Server makes request to internal service that trusts localhost
```

### Port Scanning

```bash
# Attacker probes internal network:
http://192.168.1.1:22    # SSH
http://192.168.1.1:3306  # MySQL
http://192.168.1.1:6379  # Redis
```

---

## Prevention Strategies

### 1. Input Validation (Allowlist)

**Preferred when target hosts are known.**

```python
# VULNERABLE: No validation
def fetch_url(url):
    return requests.get(url).content

# SAFE: Allowlist of permitted domains
ALLOWED_DOMAINS = {'api.example.com', 'cdn.example.com'}

def fetch_url(url):
    parsed = urlparse(url)

    # Validate scheme
    if parsed.scheme not in ('http', 'https'):
        raise ValueError("Invalid URL scheme")

    # Validate domain against allowlist
    if parsed.hostname not in ALLOWED_DOMAINS:
        raise ValueError("Domain not allowed")

    return requests.get(url).content
```

### 2. Block Internal Networks (Denylist)

**Additional defense layer when allowlist isn't practical.**

```python
import ipaddress
import socket

BLOCKED_RANGES = [
    ipaddress.ip_network('127.0.0.0/8'),      # Loopback
    ipaddress.ip_network('10.0.0.0/8'),       # Private
    ipaddress.ip_network('172.16.0.0/12'),    # Private
    ipaddress.ip_network('192.168.0.0/16'),   # Private
    ipaddress.ip_network('169.254.0.0/16'),   # Link-local (metadata)
    ipaddress.ip_network('0.0.0.0/8'),        # Current network
    ipaddress.ip_network('100.64.0.0/10'),    # Shared address space
    ipaddress.ip_network('192.0.0.0/24'),     # IETF Protocol
    ipaddress.ip_network('192.0.2.0/24'),     # Documentation
    ipaddress.ip_network('198.51.100.0/24'),  # Documentation
    ipaddress.ip_network('203.0.113.0/24'),   # Documentation
    ipaddress.ip_network('224.0.0.0/4'),      # Multicast
    ipaddress.ip_network('240.0.0.0/4'),      # Reserved
]

def is_internal_ip(ip_str):
    try:
        ip = ipaddress.ip_address(ip_str)
        return any(ip in network for network in BLOCKED_RANGES)
    except ValueError:
        return True  # Invalid IP, block it

def validate_url(url):
    parsed = urlparse(url)

    # Validate scheme
    if parsed.scheme not in ('http', 'https'):
        raise ValueError("Invalid URL scheme")

    # Resolve hostname to IP
    hostname = parsed.hostname
    if not hostname:
        raise ValueError("Invalid URL")

    # Check for IP address directly in URL
    try:
        ip = ipaddress.ip_address(hostname)
        if is_internal_ip(str(ip)):
            raise ValueError("Internal IP addresses not allowed")
    except ValueError:
        # It's a hostname, resolve it
        try:
            ip = socket.gethostbyname(hostname)
            if is_internal_ip(ip):
                raise ValueError("Domain resolves to internal IP")
        except socket.gaierror:
            raise ValueError("Could not resolve hostname")

    return True
```

### 3. Disable Redirects

```python
# VULNERABLE: Follows redirects (can bypass IP checks)
response = requests.get(url, allow_redirects=True)
# Attacker: http://attacker.com/redirect -> http://169.254.169.254/

# SAFE: Don't follow redirects automatically
response = requests.get(url, allow_redirects=False)

# If redirects needed, validate each location
def safe_fetch(url, max_redirects=5):
    for _ in range(max_redirects):
        validate_url(url)  # Validate before each request
        response = requests.get(url, allow_redirects=False)

        if response.status_code in (301, 302, 303, 307, 308):
            url = response.headers.get('Location')
            if not url:
                raise ValueError("Redirect without Location")
            continue

        return response

    raise ValueError("Too many redirects")
```

### 4. DNS Rebinding Protection

```python
import socket
import time

def safe_fetch_with_dns_pinning(url):
    parsed = urlparse(url)
    hostname = parsed.hostname

    # Resolve DNS and pin the IP
    ip = socket.gethostbyname(hostname)

    # Validate IP is not internal
    if is_internal_ip(ip):
        raise ValueError("Internal IP not allowed")

    # Make request directly to IP with Host header
    # This prevents DNS rebinding attacks
    modified_url = url.replace(hostname, ip)
    headers = {'Host': hostname}

    response = requests.get(
        modified_url,
        headers=headers,
        allow_redirects=False,
        verify=True  # Still verify TLS with original hostname
    )

    return response
```

### 5. Cloud Metadata Protection

#### AWS IMDSv2

```bash
# Require IMDSv2 (token-based) - mitigates SSRF
aws ec2 modify-instance-metadata-options \
    --instance-id i-1234567890abcdef0 \
    --http-tokens required \
    --http-endpoint enabled
```

```python
# With IMDSv2, attacker would need two requests:
# 1. PUT to get token (SSRF usually only does GET)
# 2. GET with token in header

# Block metadata IP regardless
if '169.254.169.254' in url or '169.254.170.2' in url:
    raise ValueError("Metadata endpoints not allowed")
```

#### GCP

```python
# Block GCP metadata
BLOCKED_HOSTS = [
    'metadata.google.internal',
    'metadata.google.com',
    '169.254.169.254'
]
```

#### Azure

```python
# Block Azure metadata
BLOCKED_HOSTS = [
    '169.254.169.254',
    'management.azure.com'
]
```

---

## Framework-Specific Mitigations

### Python (requests)

```python
from urllib.parse import urlparse
import requests

class SafeRequests:
    @staticmethod
    def get(url, **kwargs):
        validate_url(url)
        kwargs['allow_redirects'] = False
        kwargs['timeout'] = (5, 30)  # Connect and read timeout
        return requests.get(url, **kwargs)
```

### Node.js

```javascript
const axios = require('axios');
const url = require('url');
const dns = require('dns').promises;

async function safeFetch(targetUrl) {
    const parsed = new URL(targetUrl);

    // Validate scheme
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid scheme');
    }

    // Resolve and check IP
    const addresses = await dns.lookup(parsed.hostname);
    if (isInternalIP(addresses.address)) {
        throw new Error('Internal IP not allowed');
    }

    return axios.get(targetUrl, {
        maxRedirects: 0,
        timeout: 30000
    });
}
```

### Java

```java
public class SafeURLConnection {
    private static final Set<String> ALLOWED_PROTOCOLS = Set.of("http", "https");

    public static URLConnection openConnection(String urlString) throws IOException {
        URL url = new URL(urlString);

        if (!ALLOWED_PROTOCOLS.contains(url.getProtocol())) {
            throw new SecurityException("Protocol not allowed");
        }

        InetAddress address = InetAddress.getByName(url.getHost());
        if (isInternalIP(address)) {
            throw new SecurityException("Internal IP not allowed");
        }

        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(30000);

        return connection;
    }
}
```

---

## Common Bypass Techniques to Block

### URL Encoding

```python
# Bypasses:
http://169.254.169.254/  # Normal
http://169%2e254%2e169%2e254/  # URL encoded dots
http://0251.0376.0251.0376/  # Octal
http://0xa9fea9fe/  # Hex
http://2852039166/  # Decimal

# Defense: Normalize and decode URL before validation
from urllib.parse import unquote

def normalize_url(url):
    return unquote(url)
```

### DNS Rebinding

```python
# Attack: Domain initially resolves to public IP, then internal IP
# First request: attacker.com -> 1.2.3.4 (passes validation)
# DNS changes: attacker.com -> 192.168.1.1
# Second request goes to internal IP

# Defense: Pin DNS resolution and re-validate
```

### IPv6

```python
# Bypasses:
http://[::1]/  # localhost
http://[::ffff:127.0.0.1]/  # IPv4-mapped IPv6
http://[0:0:0:0:0:ffff:169.254.169.254]/

# Defense: Check both IPv4 and IPv6 ranges
BLOCKED_RANGES.extend([
    ipaddress.ip_network('::1/128'),        # IPv6 loopback
    ipaddress.ip_network('fc00::/7'),       # IPv6 private
    ipaddress.ip_network('fe80::/10'),      # IPv6 link-local
])
```

### Alternate Representations

```python
# localhost alternatives:
localhost
127.0.0.1
127.0.0.2  # Any 127.x.x.x is loopback
2130706433  # Decimal for 127.0.0.1
0x7f000001  # Hex
0177.0.0.1  # Octal
127.1       # Short form
```

---

## Grep Patterns for Detection

```bash
# URL fetching functions
grep -rn "requests\.get\|requests\.post\|urllib\.request\|urlopen\|fetch\|axios" --include="*.py" --include="*.js"

# URL from user input
grep -rn "request\.args\|request\.form\|request\.json\|req\.query\|req\.body" --include="*.py" --include="*.js" | grep -i "url"

# Potential SSRF sinks
grep -rn "curl_exec\|file_get_contents\|fopen\|readfile" --include="*.php"

# Missing validation
grep -rn "requests\.get(url\|fetch(url" --include="*.py" --include="*.js"
```

---

## Testing Checklist

- [ ] User-controlled URLs validated against allowlist
- [ ] Internal IP ranges blocked (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- [ ] Cloud metadata IPs blocked (169.254.169.254)
- [ ] IPv6 internal addresses blocked
- [ ] URL redirects not followed blindly
- [ ] DNS rebinding protected against
- [ ] URL encoding/alternate representations handled
- [ ] IMDSv2 required (AWS environments)
- [ ] Timeouts configured to prevent DoS

---

## References

- [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
- [CWE-918: Server-Side Request Forgery](https://cwe.mitre.org/data/definitions/918.html)
- [AWS IMDSv2 Documentation](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/configuring-instance-metadata-service.html)
- [PortSwigger SSRF Guide](https://portswigger.net/web-security/ssrf)
