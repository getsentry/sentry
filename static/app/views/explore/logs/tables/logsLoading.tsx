import {Fragment, type CSSProperties} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {FileSize} from 'sentry/components/fileSize';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {TableStatus} from 'sentry/views/explore/components/table';
import {EmptyStateText} from 'sentry/views/explore/tables/tracesTable/styles';

type Props = Partial<ProgressIndicatorProps>;

export function LogsLoading({bytesScanned, estimatedTotalBytes}: Props) {
  return (
    <TableStatus>
      <Stack align="center">
        <EmptyStateText size="md" textAlign="center">
          <StyledLoadingIndicator margin="1em auto" />
          {bytesScanned ? (
            <Fragment>
              {t('Searching for a needle in a haystack. This could take a while.')}
              <br />
              <ProgressIndicator
                bytesScanned={bytesScanned}
                estimatedTotalBytes={estimatedTotalBytes}
              />
            </Fragment>
          ) : null}
        </EmptyStateText>
      </Stack>
    </TableStatus>
  );
}

interface ProgressIndicatorProps {
  bytesScanned: number;
  estimatedTotalBytes?: number;
}

function ProgressIndicator({
  bytesScanned,
  estimatedTotalBytes: estimatedTotalBytes,
}: ProgressIndicatorProps) {
  return estimatedTotalBytes ? (
    <span>
      {tct('[bytesScanned] of [estimatedTotal] scanned', {
        bytesScanned: <FileSize bytes={bytesScanned} base={2} />,
        estimatedTotal: <FileSize bytes={estimatedTotalBytes} base={2} />,
      })}
    </span>
  ) : (
    <span>
      {tct('[bytesScanned] scanned', {
        bytesScanned: <FileSize bytes={bytesScanned} base={2} />,
      })}
    </span>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)<{
  margin: CSSProperties['margin'];
}>`
  ${p => p.margin && `margin: ${p.margin}`};
`;
