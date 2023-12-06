import {MetricType, MRI} from 'sentry/types';
import {ParsedMRI, UseCase} from 'sentry/types/metrics';
import {getUseCaseFromMRI, parseField, parseMRI, toMRI} from 'sentry/utils/metrics/mri';

describe('parseMRI', () => {
  it('should handle falsy values', () => {
    expect(parseMRI('')).toEqual(null);
    expect(parseMRI()).toEqual(null);
    expect(parseMRI(null)).toEqual(null);
    expect(parseMRI(undefined)).toEqual(null);
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

  it.each(['transactions', 'custom'])(
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

  it.each(['sessions', 'spans'])(
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
  it('should return the correct mri and op from field', () => {
    const field = 'op(c:test/project)';

    const result = parseField(field);

    expect(result).toEqual({
      mri: 'c:test/project',
      op: 'op',
    });
  });

  it('should do nothing for already formatted field', () => {
    const field = 'sum(my-metric)';

    const result = parseField(field);

    expect(result?.mri).toBe('my-metric');
    expect(result?.op).toBe('sum');
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
