import type {MetricType, MRI, ParsedMRI, UseCase} from 'sentry/types/metrics';
import {
  formatMRI,
  getUseCaseFromMRI,
  isExtractedCustomMetric,
  parseField,
  parseMRI,
  toMRI,
} from 'sentry/utils/metrics/mri';

describe('parseMRI', () => {
  it('should handle falsy values', () => {
    expect(parseMRI('')).toBeNull();
    expect(parseMRI()).toBeNull();
    expect(parseMRI(null)).toBeNull();
    expect(parseMRI(undefined)).toBeNull();
  });

  it.each(['c', 'd', 'e', 'g', 's'])(
    'should correctly parse a valid MRI string - metric type %s',
    metricType => {
      const mri: MRI = `${metricType as MetricType}:custom/xyz@test`;
      const parsedMRI = {
        type: metricType,
        name: 'xyz',
        unit: 'test',
        useCase: 'custom',
      };
      expect(parseMRI(mri)).toEqual(parsedMRI);
    }
  );

  it.each(['spans', 'transactions', 'custom'])(
    'should correctly parse a valid MRI string - use case %s',
    useCase => {
      const mri: MRI = `c:${useCase as UseCase}/xyz@test`;
      const parsedMRI = {
        type: 'c',
        name: `xyz`,
        unit: 'test',
        useCase,
      };
      expect(parseMRI(mri)).toEqual(parsedMRI);
    }
  );

  it.each(['sessions'])(
    'should correctly parse a valid MRI string - use case %s',
    useCase => {
      const mri: MRI = `c:${useCase as UseCase}/xyz@test`;
      const parsedMRI = {
        type: 'c',
        name: `${useCase}.xyz`,
        unit: 'test',
        useCase,
      };
      expect(parseMRI(mri)).toEqual(parsedMRI);
    }
  );

  it.each(['foo', 'foo_bar', 'foo_9-bar', '12-!foo][]312bar'])(
    'should correctly parse a valid MRI string - name %s',
    name => {
      const mri: MRI = `c:custom/${name}@test`;
      const parsedMRI = {
        type: 'c',
        name,
        unit: 'test',
        useCase: 'custom',
      };
      expect(parseMRI(mri)).toEqual(parsedMRI);
    }
  );

  it.each(['ms', 'none', 'KiB'])(
    'should correctly parse a valid MRI string - name %s',
    unit => {
      const mri: MRI = `c:custom/foo@${unit}`;
      const parsedMRI = {
        type: 'c',
        name: 'foo',
        unit,
        useCase: 'custom',
      };
      expect(parseMRI(mri)).toEqual(parsedMRI);
    }
  );

  it.each([
    ['d:transactions/duration@millisecond', 'transaction.duration'],
    ['d:spans/duration@millisecond', 'span.duration'],
    ['d:spans/exclusive_time@millisecond', 'span.exclusive_time'],
    ['g:spans/self_time@millisecond', 'span.self_time'],
  ])('should remap certain mri names', (mri, name) => {
    expect(parseMRI(mri)?.name).toEqual(name);
  });
});

describe('getUseCaseFromMRI', () => {
  it('should return "custom" for mri containing "custom/"', () => {
    const mri = 'd:custom/sentry.events.symbolicator.query_task@second';

    const result = getUseCaseFromMRI(mri);

    expect(result).toBe('custom');
  });

  it('should return "transactions" for mri containing "transactions/"', () => {
    const mri = 'd:transactions/duration@second';

    const result = getUseCaseFromMRI(mri);

    expect(result).toBe('transactions');
  });

  it('should return undefined for invalid mris', () => {
    const mri = 'foobar';

    const result = getUseCaseFromMRI(mri);

    expect(result).toBeUndefined();
  });
});

describe('parseField', () => {
  it('should return the correct mri and aggregation from field', () => {
    const field = 'aggregation(c:test/project)';

    const result = parseField(field);

    expect(result).toEqual({
      mri: 'c:test/project',
      aggregation: 'aggregation',
    });
  });

  it('should do nothing for already formatted field', () => {
    const field = 'sum(my-metric)';

    const result = parseField(field);

    expect(result?.mri).toBe('my-metric');
    expect(result?.aggregation).toBe('sum');
  });

  it('should return null mri invalid field', () => {
    const field = 'invalid-field';

    const result = parseField(field);

    expect(result).toBeNull();
  });
});

describe('toMRI', () => {
  it.each(['c', 'd', 'e', 'g', 's'])(
    'should correctly parse a valid MRI string - metric type %s',
    metricType => {
      const mri = `${metricType as MetricType}:custom/xyz@test`;

      const parsedMRI: ParsedMRI = {
        type: metricType as MetricType,
        name: 'xyz',
        unit: 'test',
        useCase: 'custom',
      };

      expect(toMRI(parsedMRI)).toEqual(mri);
    }
  );

  it.each(['sessions', 'transactions', 'custom'])(
    'should correctly parse a valid MRI string - use case %s',
    useCase => {
      const mri: MRI = `c:${useCase as UseCase}/xyz@test`;
      const parsedMRI: ParsedMRI = {
        type: 'c',
        name: 'xyz',
        unit: 'test',
        useCase: useCase as UseCase,
      };
      expect(toMRI(parsedMRI)).toEqual(mri);
    }
  );

  it.each(['foo', 'foo_bar', 'foo_9-bar', '12-!foo][]312bar'])(
    'should correctly parse a valid MRI string - name %s',
    name => {
      const mri: MRI = `c:custom/${name}@test`;
      const parsedMRI: ParsedMRI = {
        type: 'c',
        name,
        unit: 'test',
        useCase: 'custom',
      };
      expect(toMRI(parsedMRI)).toEqual(mri);
    }
  );

  it.each(['ms', 'none', 'KiB'])(
    'should correctly parse a valid MRI string - name %s',
    unit => {
      const mri: MRI = `c:custom/foo@${unit}`;
      const parsedMRI: ParsedMRI = {
        type: 'c',
        name: 'foo',
        unit,
        useCase: 'custom',
      };
      expect(toMRI(parsedMRI)).toEqual(mri);
    }
  );
});

describe('formatMRI', () => {
  it('returns the metric name', () => {
    expect(formatMRI('c:custom/foo@none')).toBe('foo');
    expect(formatMRI('c:custom/bar@ms')).toBe('bar');
    expect(formatMRI('d:transactions/baz@ms')).toBe('baz');
  });
});

describe('isExtractedCustomMetric', () => {
  it('should return true if the metric name is prefixed', () => {
    expect(isExtractedCustomMetric({mri: 'c:custom/span_attribute_123@none'})).toBe(true);
    expect(isExtractedCustomMetric({mri: 's:custom/span_attribute_foo@none'})).toBe(true);
    expect(isExtractedCustomMetric({mri: 'g:custom/span_attribute_baz@none'})).toBe(true);
  });

  it('should return false if the metric name is not prefixed', () => {
    expect(isExtractedCustomMetric({mri: 'c:custom/12span_attribute_@none'})).toBe(false);
    expect(isExtractedCustomMetric({mri: 's:custom/foo@none'})).toBe(false);
    expect(isExtractedCustomMetric({mri: 'd:custom/_span_attribute_@none'})).toBe(false);
    expect(isExtractedCustomMetric({mri: 'g:custom/span_attributebaz@none'})).toBe(false);
  });
});
