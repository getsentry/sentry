import {IncomingMessage, ServerResponse} from 'node:http';
import {Socket} from 'node:net';
import {PassThrough} from 'node:stream';

import packageJson from '../package.json';

import {
  createHostCheckMiddleware,
  createHostCheckUpgrade,
  isAllowedHost,
} from './dev-server-host-check.ts';

const allowedHosts = [
  '.sentry.dev',
  '.dev.getsentry.net',
  '.localhost',
  '127.0.0.1',
  '.docker.internal',
];

describe('development server host validation', () => {
  it.each([
    'localhost',
    'localhost:7999',
    'org.localhost:7999',
    'sentry.dev',
    'org.sentry.dev:7999',
    'dev.getsentry.net',
    'org.dev.getsentry.net:7999',
    'ORG.DEV.GETSENTRY.NET:7999',
    'host.docker.internal:7999',
    '127.0.0.1:7999',
    '192.0.2.1:7999',
    '[::1]:7999',
    '[2001:db8::1]:7999',
  ])('allows %s', host => {
    expect(isAllowedHost(host, allowedHosts)).toBe(true);
  });

  it.each([
    undefined,
    '',
    'attacker.invalid',
    'dev.getsentry.net.attacker.invalid:7999',
    'notdev.getsentry.net:7999',
    'localhost.attacker.invalid',
    'dev.getsentry.net/attacker.invalid',
    'dev.getsentry.net\\attacker.invalid',
    'attacker.invalid@dev.getsentry.net',
    'dev.getsentry.net?attacker.invalid',
    'dev.getsentry.net#attacker.invalid',
    '%64ev.getsentry.net',
    ' dev.getsentry.net',
    'dev.getsentry.net:invalid',
    'dev.getsentry.net:65536',
  ])('rejects %s', host => {
    expect(isAllowedHost(host, allowedHosts)).toBe(false);
  });

  it('requires opting in to the ngrok hostname', () => {
    const host = 'example.ngrok-free.app:7999';
    expect(isAllowedHost(host, allowedHosts)).toBe(false);
    expect(isAllowedHost(host, [...allowedHosts, '.example.ngrok-free.app'])).toBe(true);
  });

  it('allows the configured listening hostname without allowing suffix lookalikes', () => {
    expect(
      isAllowedHost('custom.invalid:7999', [...allowedHosts, 'custom.invalid'])
    ).toBe(true);
    expect(
      isAllowedHost('custom.invalid.attacker.invalid', [
        ...allowedHosts,
        'custom.invalid',
      ])
    ).toBe(false);
  });

  it('passes allowed HTTP requests to the next middleware', () => {
    const request = new IncomingMessage(new Socket());
    request.headers = {host: 'org.dev.getsentry.net:7999'};
    const response = new ServerResponse(request);
    const end = jest.spyOn(response, 'end').mockReturnValue(response);
    const next = jest.fn();

    createHostCheckMiddleware(allowedHosts)(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(end).not.toHaveBeenCalled();
  });

  it('returns 403 without forwarding disallowed HTTP requests', () => {
    const request = new IncomingMessage(new Socket());
    request.headers = {host: 'attacker.invalid:7999'};
    const response = new ServerResponse(request);
    const end = jest.spyOn(response, 'end').mockReturnValue(response);
    const next = jest.fn();

    createHostCheckMiddleware(allowedHosts)(request, response, next);

    expect(response.statusCode).toBe(403);
    expect(end).toHaveBeenCalledWith('Invalid Host header');
    expect(next).not.toHaveBeenCalled();
  });

  it('validates HTTP/2 authority instead of a conflicting Host header', () => {
    const request = new IncomingMessage(new Socket());
    request.headers = {':authority': 'attacker.invalid:7999', host: 'localhost:7999'};
    const response = new ServerResponse(request);
    jest.spyOn(response, 'end').mockReturnValue(response);
    const next = jest.fn();

    createHostCheckMiddleware(allowedHosts)(request, response, next);

    expect(response.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects ambiguous authority headers', () => {
    const request = new IncomingMessage(new Socket());
    request.headers = {':authority': ['localhost', 'attacker.invalid']};
    const response = new ServerResponse(request);
    jest.spyOn(response, 'end').mockReturnValue(response);
    const next = jest.fn();

    createHostCheckMiddleware(allowedHosts)(request, response, next);

    expect(response.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('leaves allowed WebSocket upgrade sockets open', () => {
    const request = new IncomingMessage(new Socket());
    request.headers = {host: 'localhost:7999'};
    const socket = new PassThrough();

    createHostCheckUpgrade(allowedHosts)(request, socket);

    expect(socket.destroyed).toBe(false);
    socket.destroy();
  });

  it('destroys disallowed WebSocket upgrade sockets', () => {
    const request = new IncomingMessage(new Socket());
    request.headers = {host: 'attacker.invalid:7999'};
    const socket = new PassThrough();

    createHostCheckUpgrade(allowedHosts)(request, socket);

    expect(socket.destroyed).toBe(true);
  });

  it('keeps the SSL plugin available in production-only installs', () => {
    expect(packageJson.dependencies).toHaveProperty('@rsbuild/plugin-basic-ssl');
    expect(packageJson.devDependencies).not.toHaveProperty('@rsbuild/plugin-basic-ssl');
  });
});
