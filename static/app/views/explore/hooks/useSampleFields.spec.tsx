import {act, render} from 'sentry-test/reactTestingLibrary';

import {useSampleFields} from 'sentry/views/explore/hooks/useSampleFields';

describe('useSampleFields', function () {
  it('allows changing sample fields', function () {
    let sampleFields, setSampleFields;

    function TestPage() {
      [sampleFields, setSampleFields] = useSampleFields();
      return null;
    }

    render(<TestPage />, {disableRouterMocks: true});

    expect(sampleFields).toEqual([
      'id',
      'project',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
    ]); // default

    act(() => setSampleFields(['foo', 'bar']));
    expect(sampleFields).toEqual(['foo', 'bar']);

    act(() => setSampleFields([]));
    expect(sampleFields).toEqual([
      'id',
      'project',
      'span.op',
      'span.description',
      'span.duration',
      'timestamp',
    ]); // default
  });
});
