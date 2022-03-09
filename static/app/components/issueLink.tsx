import * as React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import Count from 'sentry/components/count';
import EventOrGroupTitle from 'sentry/components/eventOrGroupTitle';
import EventAnnotation from 'sentry/components/events/eventAnnotation';
import EventMessage from 'sentry/components/events/eventMessage';
import {Hovercard} from 'sentry/components/hovercard';
import Link from 'sentry/components/links/link';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {Group} from 'sentry/types';
import {getMessage} from 'sentry/utils/events';

type Props = {
  card: boolean;
  children: React.ReactNode;
  issue: Group;
  orgId: string;
  to: string;
};

const IssueLink = ({children, orgId, issue, to, card = true}: Props) => {
  if (!card) {
    return <Link to={to}>{children}</Link>;
  }

  const message = getMessage(issue);

  const className = classNames({
    isBookmarked: issue.isBookmarked,
    hasSeen: issue.hasSeen,
    isResolved: issue.status === 'resolved',
  });

  const streamPath = `/organizations/${orgId}/issues/`;

  const hovercardBody = (
    <div className={className}>
      <Section>
        <Title>
          <EventOrGroupTitle data={issue} />
        </Title>

        <HovercardEventMessage
          level={issue.level}
          levelIndicatorSize="9px"
          message={message}
          annotations={
            <React.Fragment>
              {issue.logger && (
                <EventAnnotation>
                  <Link
                    to={{
                      pathname: streamPath,
                      query: {query: `logger:${issue.logger}`},
                    }}
                  >
                    {issue.logger}
                  </Link>
                </EventAnnotation>
              )}
              {issue.annotations.map((annotation, i) => (
                <EventAnnotation key={i} dangerouslySetInnerHTML={{__html: annotation}} />
              ))}
            </React.Fragment>
          }
        />
      </Section>

      <Grid>
        <div>
          <GridHeader>{t('First Seen')}</GridHeader>
          <StyledTimeSince date={issue.firstSeen} />
        </div>
        <div>
          <GridHeader>{t('Last Seen')}</GridHeader>
          <StyledTimeSince date={issue.lastSeen} />
        </div>
        <div>
          <GridHeader>{t('Occurrences')}</GridHeader>
          <Count value={issue.count} />
        </div>
        <div>
          <GridHeader>{t('Users Affected')}</GridHeader>
          <Count value={issue.userCount} />
        </div>
      </Grid>
    </div>
  );

  return (
    <Hovercard body={hovercardBody} header={issue.shortId}>
      <Link to={to}>{children}</Link>
    </Hovercard>
  );
};

export default IssueLink;

const Title = styled('h3')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0 0 ${space(0.5)};
  ${overflowEllipsis};

  em {
    font-style: normal;
    font-weight: 400;
    color: ${p => p.theme.gray300};
    font-size: 90%;
  }
`;

const Section = styled('section')`
  margin-bottom: ${space(2)};
`;

const Grid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
`;
const HovercardEventMessage = styled(EventMessage)`
  font-size: 12px;
`;

const GridHeader = styled('h5')`
  color: ${p => p.theme.gray300};
  font-size: 11px;
  margin-bottom: ${space(0.5)};
  text-transform: uppercase;
`;

const StyledTimeSince = styled(TimeSince)`
  color: inherit;
`;
