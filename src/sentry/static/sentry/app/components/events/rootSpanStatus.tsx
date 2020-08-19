import React from 'react';
import styled from '@emotion/styled';

import {Event, SentryTransactionEvent} from 'app/types';
import {TraceContextType} from 'app/components/events/interfaces/spans/types';
import {SectionHeading} from 'app/components/charts/styles';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  event: Event;
};

class RootSpanStatus extends React.Component<Props> {
  getTransactionEvent(): SentryTransactionEvent | undefined {
    const {event} = this.props;

    if (event.type === 'transaction') {
      return event as SentryTransactionEvent;
    }

    return undefined;
  }

  getRootSpanStatus(): string {
    const event = this.getTransactionEvent();

    const DEFAULT = '\u2014';

    if (!event) {
      return DEFAULT;
    }

    const traceContext: TraceContextType | undefined = event?.contexts?.trace;

    return traceContext?.status ?? DEFAULT;
  }

  render() {
    const event = this.getTransactionEvent();

    if (!event) {
      return null;
    }

    return (
      <Container>
        <Header>
          <SectionHeading>{t('Status')}</SectionHeading>
        </Header>
        <div>{this.getRootSpanStatus()}</div>
      </Container>
    );
  }
}

const Container = styled('div')`
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(4)};
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
`;

export default RootSpanStatus;
