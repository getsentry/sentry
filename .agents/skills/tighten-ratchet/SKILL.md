---
name: tighten-ratchet
description: Tighten a ratchet ceiling after the count has decreased. Use when a ratchet check says "can be tightened", or when asked to "tighten ratchet", "update ratchet ceiling", or "lock in ratchet progress".
---

# Tighten a Ratchet

When a ratchet's match count drops below its ceiling, the check fails asking you to tighten it.

## Steps

### 1. Get the current count

Run check to see which ratchets need tightening:

```bash
python -m tools.ratchet check
```

Or test a specific ratchet's pattern directly:

```bash
python -m tools.ratchet test '<pattern>' '<file_glob>'
```

### 2. Update the ceiling in `tools/ratchet.py`

Find the ratchet in the `RATCHETS` list and set `ceiling=<current_count>`.

### 3. Verify

```bash
python -m tools.ratchet check -v <ratchet-id>
```

The output should show `OK`.
