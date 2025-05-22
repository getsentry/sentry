import styled from '@emotion/styled';

import CodecovQueryParamsProvider from 'sentry/components/codecov/container/codecovParamsProvider';
import {DatePicker} from 'sentry/components/codecov/datePicker/datePicker';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {space} from 'sentry/styles/space';
import {Summaries} from 'sentry/views/codecov/tests/summaries/summaries';

export default function TestsPage() {
  return (
    <LayoutGap>
      <p>Test Analytics</p>
      <CodecovQueryParamsProvider>
        <PageFilterBar condensed>
          <DatePicker />
        </PageFilterBar>
      </CodecovQueryParamsProvider>
      {/* TODO: Conditionally show these if the branch we're in is the main branch */}
      <Summaries />
    </LayoutGap>
  );
}

const LayoutGap = styled('div')`
  display: grid;
  gap: ${space(2)};
`;
