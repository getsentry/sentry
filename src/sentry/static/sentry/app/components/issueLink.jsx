import {Link} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Count from 'app/components/count';
import EventAnnotation from 'app/components/events/eventAnnotation';
import EventMessage from 'app/components/events/eventMessage';
import EventOrGroupTitle from 'app/components/eventOrGroupTitle';
import Hovercard from 'app/components/hovercard';
import TimeSince from 'app/components/timeSince';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

export default class IssueLink extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    issue: PropTypes.object.isRequired,
    to: PropTypes.string.isRequired,
    card: PropTypes.bool,
  };

  static defaultProps = {
    card: true,
  };

  getMessage(data) {
    const metadata = data.metadata;
    switch (data.type) {
      case 'error':
        return metadata.value;
      case 'csp':
        return metadata.message;
      default:
        return data.culprit || '';
    }
  }

  renderBody() {
    const {issue, orgId} = this.props;
    const message = this.getMessage(issue);

    const className = classNames({
      isBookmarked: issue.isBookmarked,
      hasSeen: issue.hasSeen,
      isResolved: issue.status === 'resolved',
    });

    const streamPath = `/organizations/${orgId}/issues/`;

    return (
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
                {issue.annotations.map((annotation, i) => {
                  return (
                    <EventAnnotation
                      key={i}
                      dangerouslySetInnerHTML={{__html: annotation}}
                    />
                  );
                })}
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
  }

  render() {
    const {card, issue, to} = this.props;
    if (!card) {
      return <Link to={to}>{this.props.children}</Link>;
    }

    return (
      <Hovercard body={this.renderBody()} header={issue.shortId}>
        <Link to={to}>{this.props.children}</Link>
      </Hovercard>
    );
  }
}

const Title = styled('h3')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0 0 ${space(0.5)};
  ${overflowEllipsis};

  em {
    font-style: normal;
    font-weight: 400;
    color: ${p => p.theme.gray2};
    font-size: 90%;
  }
`;

const Section = styled('section')`
  margin-bottom: ${space(2)};
`;

const Grid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-gap: ${space(2)};
`;
const HovercardEventMessage = styled(EventMessage)`
  font-size: 12px;
`;

const GridHeader = styled('h5')`
  color: ${p => p.theme.gray2};
  font-size: 11px;
  margin-bottom: ${space(0.5)};
  text-transform: uppercase;
`;

const StyledTimeSince = styled(TimeSince)`
  color: inherit;
`;
