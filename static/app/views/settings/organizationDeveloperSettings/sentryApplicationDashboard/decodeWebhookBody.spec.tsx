import {decodeWebhookBody} from 'sentry/views/settings/organizationDeveloperSettings/sentryApplicationDashboard/decodeWebhookBody';

describe('decodeWebhookBody', () => {
  it('parses a plain JSON body', () => {
    const body = JSON.stringify({action: 'created'});
    expect(decodeWebhookBody(body)).toEqual({
      parsed: {action: 'created'},
      raw: body,
      maybeTruncated: false,
    });
  });

  it('parses a double-encoded JSON body', () => {
    const body = JSON.stringify(JSON.stringify({action: 'created'}));
    expect(decodeWebhookBody(body)).toEqual({
      parsed: {action: 'created'},
      raw: body,
      maybeTruncated: false,
    });
  });

  it('parses a JSON array body', () => {
    const body = JSON.stringify([1, 2]);
    expect(decodeWebhookBody(body)).toEqual({
      parsed: [1, 2],
      raw: body,
      maybeTruncated: false,
    });
  });

  it('returns unparseable text raw', () => {
    expect(decodeWebhookBody('Unauthorized')).toEqual({
      parsed: null,
      raw: 'Unauthorized',
      maybeTruncated: false,
    });
  });

  it('flags a body that reached the size cap regardless of its last character', () => {
    const body = `${'x'.repeat(1023)}"`;
    expect(decodeWebhookBody(body)).toEqual({
      parsed: null,
      raw: body,
      maybeTruncated: true,
    });
  });

  it('unescapes a double-encoded body truncated before its closing quote', () => {
    const body = JSON.stringify(JSON.stringify({action: 'created'})).slice(0, 20);
    expect(decodeWebhookBody(body)).toEqual({
      parsed: null,
      raw: '{"action":"creat',
      maybeTruncated: true,
    });
  });

  it('unescapes a double-encoded body truncated mid-escape', () => {
    const body = '"{\\"action\\":\\"created\\';
    expect(decodeWebhookBody(body)).toEqual({
      parsed: null,
      raw: '{"action":"created',
      maybeTruncated: true,
    });
  });

  it('unescapes a double-encoded body truncated mid-unicode-escape', () => {
    const body = '"caf\\u00e9 \\u00';
    expect(decodeWebhookBody(body)).toEqual({
      parsed: null,
      raw: 'café ',
      maybeTruncated: true,
    });
  });

  it('unwraps a double-encoded body whose inner text is not JSON', () => {
    expect(decodeWebhookBody(JSON.stringify('Unauthorized'))).toEqual({
      parsed: null,
      raw: 'Unauthorized',
      maybeTruncated: false,
    });
  });

  it('returns non-object JSON scalars as raw text', () => {
    expect(decodeWebhookBody('42')).toEqual({
      parsed: null,
      raw: '42',
      maybeTruncated: false,
    });
  });

  it('handles an empty body', () => {
    expect(decodeWebhookBody('')).toEqual({
      parsed: null,
      raw: '',
      maybeTruncated: false,
    });
  });

  it('measures the size cap against the stored body, not the decoded one', () => {
    // 1060 characters stored, 1012 decoded.
    const body = JSON.stringify('Internal Server Error\n'.repeat(46));
    expect(decodeWebhookBody(body).maybeTruncated).toBe(true);
  });
});
