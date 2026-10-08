import {describeInvalidEmbed} from './invalidEmbedReport';
import {SEER_EMBED_SCHEMAS} from './schemas';

function reportFor(name: keyof typeof SEER_EMBED_SCHEMAS, data: unknown) {
  const {schema} = SEER_EMBED_SCHEMAS[name];
  const parsed = schema.safeParse(data);
  if (parsed.success) {
    throw new Error(`expected ${name} to fail validation`);
  }
  return describeInvalidEmbed(name, schema, data, parsed.error.issues);
}

describe('describeInvalidEmbed', () => {
  it('names the fields and the value that arrived', () => {
    const report = reportFor('spansQuery', {
      mode: 'aggregate',
      start: '2026-09-22',
      end: '2026-09-23',
    });

    expect(report.title).toBe('[SeerEmbed] spansQuery: invalid props (start, end)');
    expect(report.invalidFields).toBe('start,end');
    expect(report.failures).toEqual([
      'start: expected datetime format, received "2026-09-22"',
      'end: expected datetime format, received "2026-09-23"',
    ]);
    expect(report.unexpectedKeys).toEqual([]);
  });

  it('points out keys the agent sent under another spelling', () => {
    const report = reportFor('trace', {trace_id: '4a7fe3cd9c6f4402a21a9f8b59d1d317'});

    expect(report.title).toBe('[SeerEmbed] trace: invalid props (traceId)');
    expect(report.failures).toEqual(['traceId: expected string, received missing']);
    expect(report.unexpectedKeys).toEqual(['trace_id']);
    expect(report.likelyRenames).toEqual(['trace_id -> traceId']);
  });

  it('lists unexpected keys even when no rename matches', () => {
    const report = reportFor('event', {event_id: 'efae0baac11e4a44986616c070d1f60d'});

    expect(report.failures).toEqual([
      'id: Invalid input, received missing',
      'issueId: Invalid input, received missing',
    ]);
    expect(report.receivedKeys).toEqual(['event_id']);
    expect(report.unexpectedKeys).toEqual(['event_id']);
    expect(report.likelyRenames).toEqual([]);
  });

  it('labels non-string values with their type', () => {
    expect(reportFor('trace', {traceId: 42}).failures).toEqual([
      'traceId: expected string, received number 42',
    ]);
    expect(reportFor('trace', {traceId: ['a']}).failures).toEqual([
      'traceId: expected string, received array(1)',
    ]);
  });

  it('truncates long values', () => {
    const [failure] = reportFor('spansQuery', {start: 'x'.repeat(200)}).failures;

    expect(failure).toBe(`start: expected datetime format, received "${'x'.repeat(79)}…`);
  });

  it('describes a body that is not an object', () => {
    const report = reportFor('trace', undefined);

    expect(report.title).toBe('[SeerEmbed] trace: invalid props ((root))');
    expect(report.failures).toEqual(['(root): expected object, received missing']);
    expect(report.receivedKeys).toEqual([]);
  });

  it('fingerprints by cause so different mistakes group separately', () => {
    expect(reportFor('trace', {trace_id: 'abc'}).fingerprint).toEqual([
      'seer-embed-invalid-props',
      'trace',
      'traceId:missing',
    ]);
    expect(reportFor('trace', {traceId: 42}).fingerprint).toEqual([
      'seer-embed-invalid-props',
      'trace',
      'traceId:invalid_type',
    ]);
    expect(reportFor('spansQuery', {start: 'nope'}).fingerprint).toEqual([
      'seer-embed-invalid-props',
      'spansQuery',
      'start:invalid_format',
    ]);
  });
});
