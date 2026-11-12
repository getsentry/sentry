import type {IncomingMessage} from 'node:http';
import {isIP} from 'node:net';
import type {Duplex} from 'node:stream';
import {URL} from 'node:url';

import type {Connect} from '@rsbuild/core';

export function isAllowedHost(
  header: string | undefined,
  allowedHosts: readonly string[]
) {
  if (!header || /[\s/\\?#@%]/.test(header)) {
    return false;
  }

  let hostname: string;
  try {
    hostname = new URL(`http://${header}`).hostname;
  } catch {
    return false;
  }

  const ipAddress = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
  if (isIP(ipAddress)) {
    return true;
  }

  return allowedHosts.some(allowedHost => {
    const normalizedHost = allowedHost.toLowerCase();
    return (
      hostname === normalizedHost ||
      (normalizedHost.startsWith('.') &&
        (hostname === normalizedHost.slice(1) || hostname.endsWith(normalizedHost)))
    );
  });
}

function getRequestHost(request: IncomingMessage) {
  const header = request.headers[':authority'] ?? request.headers.host;
  return typeof header === 'string' ? header : undefined;
}

export function createHostCheckMiddleware(
  allowedHosts: readonly string[]
): Connect.NextHandleFunction {
  return (request, response, next) => {
    if (isAllowedHost(getRequestHost(request), allowedHosts)) {
      next();
      return;
    }

    response.statusCode = 403;
    response.end('Invalid Host header');
  };
}

export function createHostCheckUpgrade(allowedHosts: readonly string[]) {
  return (request: IncomingMessage, socket: Duplex) => {
    if (!isAllowedHost(getRequestHost(request), allowedHosts)) {
      socket.destroy();
    }
  };
}
