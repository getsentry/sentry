import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ContextCard} from 'sentry/components/events/contexts/contextCard';
import {
  getWERContextData,
  type WERContext,
} from 'sentry/components/events/contexts/knownContext/wer';

const REPORT_ID = '3ea2a4b8-2ab3-4f69-9f0b-baa5c60847b8';
const MOCK_WER_CONTEXT: WERContext = {
  type: 'default',
  report_id: REPORT_ID,
  extra_data: 'something',
};

describe('WERContext', () => {
  it('formats known values and preserves additional data', () => {
    expect(getWERContextData({data: MOCK_WER_CONTEXT})).toEqual([
      {key: 'report_id', subject: 'Report ID', value: REPORT_ID},
      {
        key: 'extra_data',
        subject: 'extra_data',
        value: 'something',
        meta: undefined,
      },
    ]);
  });

  it('renders Windows Error Reporting details', () => {
    render(<ContextCard type="default" alias="wer" value={MOCK_WER_CONTEXT} />);

    expect(screen.getByText('Windows Error Reporting')).toBeInTheDocument();
    expect(screen.getByRole('img')).toBeInTheDocument();
    expect(screen.getByText('Report ID')).toBeInTheDocument();
    expect(screen.getByText(REPORT_ID)).toBeInTheDocument();
  });
});
