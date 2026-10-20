# PAR-2: Local servers can bind under the network guard

Status is accepted.

## Only a worker installs the guard

`pytest_runtest_protocol` calls `network_blocked()` only when `_PYTEST_PARALLEL_WORKER` is `1` and the test has no `enable_network` marker.

The coordinator sets that variable in each worker. The controller does not. `--serial` stays in the controller and keeps the normal socket API.

Mark a test with `@pytest.mark.enable_network` when that test must use the network. The marker skips the guard for that test only.

## Local bind and the local hostname are allowed

An `AF_UNIX` socket is allowed.

A loopback host is allowed. That includes `localhost` and an IPv4-mapped loopback address.

`bind`, `listen`, and `accept` may use an unspecified address. `0.0.0.0` and `::` are unspecified.

The guarded resolvers are `getaddrinfo`, `gethostbyname`, `gethostbyname_ex`, `gethostbyaddr`, and `getnameinfo`.

A resolver call is allowed when the host is `None`, empty, loopback, unspecified, or the local hostname.

`getaddrinfo` may parse numeric IPv4 and IPv6 literals. This does not allow socket connections to those addresses.

When `DJANGO_LIVE_TEST_SERVER_ADDRESS` is set, its exact host may also be resolved and bound. The guard tracks the successfully bound socket and its active port for the current test. For this exception, only that socket may listen or accept, and socket traffic to that active endpoint is allowed. Other ports on the configured host stay blocked. Accepted connections may use their socket for the rest of the test.

The local hostname is the string from `socket.gethostname()`. The guard also accepts that name's first label. The comparison is case-insensitive. A trailing dot on the queried name is ignored.

The guard does not look at `AI_PASSIVE`. An empty host is allowed without that flag.

## Non-loopback connect and external lookup stay blocked

`connect` and `connect_ex` raise `PermissionError` when the address is not loopback, the local hostname, or an active Django live test server endpoint.

`sendto` and `sendmsg` raise `PermissionError` when the explicit address is outside that set.

A resolver call for any other host raises `PermissionError`.

Passing the local hostname to `connect` is allowed. After `connect`, the guard caches `getpeername()`. If that peer is a non-loopback IP, the next `send` is blocked.

`connect` to an unspecified address stays blocked.

## These alternatives lost

Requiring `enable_network` for every local server lost. The marker disables the guard for the whole test, so outbound `connect` calls would be allowed too.

Allowing every `getaddrinfo` call lost. A test could resolve names outside the host.

Allowing an empty host only with `AI_PASSIVE` lost. Libraries pass `None` or `""` without that flag.

Refusing `0.0.0.0` and `::` lost. Local servers bind to those addresses and do not connect out.

Refusing `socket.gethostname()` lost. Tests resolve that name for a service on this machine.
