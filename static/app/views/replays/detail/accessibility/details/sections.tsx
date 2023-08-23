import {Fragment, MouseEvent} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import type {SpanFrame} from 'sentry/utils/replays/types';
import {
  keyValueTableOrNotFound,
  SectionItem,
} from 'sentry/views/replays/detail/accessibility/details/components';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

export type SectionProps = {
  item: unknown;
  projectId: string;
  startTimestampMs: number;
};

function DisplayString(props) {
  const {text} = props;

  return (
    <div>
      {text.split('\n').map((line, index) => (
        <React.Fragment key={index}>
          {line}
          <br />
        </React.Fragment>
      ))}
    </div>
  );
}

export function GeneralSection({item, startTimestampMs}: SectionProps) {
  const {setCurrentTime} = useReplayContext();

  // TODO[replay]: what about:
  // `requestFrame?.data?.request?.size` vs. `requestFrame?.data?.requestBodySize`

  const data = {
    [t('Type')]: item.id,
    [t('Help')]: <a href={item.helpUrl}>{item.description}</a>,
    [t('Impact')]: item.impact,
    [t('Path')]: item.element,

    [t('Timestamp')]: (
      <TimestampButton
        format="mm:ss.SSS"
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          setCurrentTime(item.offsetMs);
        }}
        startTimestampMs={startTimestampMs}
        timestampMs={item.timestampMs}
      />
    ),
    [t('Extended Summary')]: <DisplayString text={item.failureSummary} />,
  };

  return (
    <Fragment>
      <SectionItem title={t('DOM Element')}>
        <CodeSnippet language="html" hideCopyButton>
          {beautify.html(item.element, {indent_size: 2})}
        </CodeSnippet>
      </SectionItem>
      <SectionItem title={t('General')}>
        {keyValueTableOrNotFound(data, t('Missing request details'))}
      </SectionItem>
    </Fragment>
  );
}

const OverflowFluidHeight = styled(FluidHeight)`
  overflow: auto;
`;
