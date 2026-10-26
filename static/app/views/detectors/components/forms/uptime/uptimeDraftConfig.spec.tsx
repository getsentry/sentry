import {parseDetectorDraftValues} from 'sentry/views/detectors/components/forms/common/detectorDraft';
import {UPTIME_DETECTOR_DRAFT_CONFIG} from 'sentry/views/detectors/components/forms/uptime/uptimeDraftConfig';

const statusCheck = {
  id: 'status',
  op: 'status_code_check',
  operator: {cmp: 'less_than'},
  value: 300,
};

describe('UPTIME_DETECTOR_DRAFT_CONFIG', () => {
  it('keeps a nested assertion tree', () => {
    const assertion = {
      root: {
        id: 'root',
        op: 'and',
        children: [
          statusCheck,
          {
            id: 'not',
            op: 'not',
            operand: {
              id: 'header',
              op: 'header_check',
              key_op: {cmp: 'equals'},
              key_operand: {header_op: 'literal', value: 'x-cache'},
              value_op: {cmp: 'equals'},
              value_operand: {header_op: 'glob', pattern: {value: 'MISS*'}},
            },
          },
        ],
      },
    };

    const values = parseDetectorDraftValues(UPTIME_DETECTOR_DRAFT_CONFIG, {assertion});

    expect(values).toEqual({assertion});
  });

  it('drops the assertion when any node is invalid', () => {
    const values = parseDetectorDraftValues(UPTIME_DETECTOR_DRAFT_CONFIG, {
      assertion: {
        root: {id: 'root', op: 'and', children: [{...statusCheck, value: 'oops'}]},
      },
      url: 'https://example.com',
    });

    expect(values).toEqual({url: 'https://example.com'});
  });

  it('restores a cleared status code as 200', () => {
    const values = parseDetectorDraftValues(UPTIME_DETECTOR_DRAFT_CONFIG, {
      assertion: {
        root: {id: 'root', op: 'and', children: [{...statusCheck, value: null}]},
      },
    });

    expect(values.assertion?.root.children).toEqual([{...statusCheck, value: 200}]);
  });

  it('drops methods and intervals the form does not offer', () => {
    const values = parseDetectorDraftValues(UPTIME_DETECTOR_DRAFT_CONFIG, {
      intervalSeconds: 7,
      method: 'TRACE',
    });

    expect(values).toEqual({});
  });

  it('never restores headers or body', () => {
    const values = parseDetectorDraftValues(UPTIME_DETECTOR_DRAFT_CONFIG, {
      body: 'secret',
      headers: [['Authorization', 'secret']],
    });

    expect(values).toEqual({});
  });
});

describe('UPTIME_DETECTOR_DRAFT_CONFIG.redact', () => {
  it.each([
    ['https://user:secret@example.com:99999/', 'https://example.com:99999/'],
    ['user:secret@example.com/health', 'example.com/health'],
    ['https://admin:p@ssw0rd@example.com/x', 'https://example.com/x'],
    ['  https://user:secret@example.com', '  https://example.com'],
    ['https:/user:secret@example.com', 'https:/example.com'],
  ])('strips credentials from %s', (url, expected) => {
    expect(UPTIME_DETECTOR_DRAFT_CONFIG.redact!({url})).toEqual({url: expected});
  });

  it.each(['https://example.com/a@b', 'https://example.com/health?email=a@b.com'])(
    'keeps an @ after the host in %s',
    url => {
      expect(UPTIME_DETECTOR_DRAFT_CONFIG.redact!({url})).toEqual({url});
    }
  );
});
