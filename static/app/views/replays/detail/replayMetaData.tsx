import {Fragment} from 'react';
import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import Placeholder from 'sentry/components/placeholder';
import ContextIcon from 'sentry/components/replays/contextIcon';
import ErrorCount from 'sentry/components/replays/errorCount';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  replayRecord: ReplayRecord | undefined;
};

function ReplayMetaData({replayRecord}: Props) {
  const {pathname, query} = useLocation();

  const errorsTabHref = {
    pathname,
    query: {
      ...query,
      t_main: 'console',
      f_c_logLevel: 'issue',
      f_c_search: undefined,
    },
  };

  return (
    <KeyMetrics>
      <KeyMetricLabel>{t('OS')}</KeyMetricLabel>
      <KeyMetricData>
        <ContextIcon
          name={replayRecord?.os.name ?? ''}
          version={replayRecord?.os.version ?? undefined}
        />
      </KeyMetricData>

      <KeyMetricLabel>{t('Browser')}</KeyMetricLabel>
      <KeyMetricData>
        <ContextIcon
          name={replayRecord?.browser.name ?? ''}
          version={replayRecord?.browser.version ?? undefined}
        />
      </KeyMetricData>

      <KeyMetricLabel>{t('Start Time')}</KeyMetricLabel>
      <KeyMetricData>
        {replayRecord ? (
          <Fragment>
            <IconCalendar color="gray300" />
            <TimeSince date={replayRecord.started_at} unitStyle="regular" />
          </Fragment>
        ) : (
          <HeaderPlaceholder />
        )}
      </KeyMetricData>
      <KeyMetricLabel>{t('Errors')}</KeyMetricLabel>
      {replayRecord ? (
        <StyledLink to={errorsTabHref}>
          <ErrorCount countErrors={replayRecord.count_errors} />
        </StyledLink>
      ) : (
        <HeaderPlaceholder />
      )}
    </KeyMetrics>
  );
}

export const HeaderPlaceholder = styled(
  (props: React.ComponentProps<typeof Placeholder>) => (
    <Placeholder width="80px" height="19px" {...props} />
  )
)`
  background-color: ${p => p.theme.background};
`;

const KeyMetrics = styled('dl')`
  display: grid;
  grid-template-rows: max-content 1fr;
  grid-template-columns: repeat(4, max-content);
  grid-auto-flow: column;
  gap: 0 ${space(3)};
  align-items: center;
  color: ${p => p.theme.gray300};
  margin: 0;
`;

const KeyMetricLabel = styled('dt')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const KeyMetricData = styled('dd')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: normal;
  display: flex;
  align-items: center;
  gap: ${space(1)};
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const StyledLink = styled(Link)`
  display: flex;
  gap: ${space(1)};
`;

export default ReplayMetaData;
