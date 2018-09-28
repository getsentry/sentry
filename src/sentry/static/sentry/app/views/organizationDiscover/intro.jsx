import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Box, Flex} from 'grid-emotion';

import {tct, t} from 'app/locale';

import ExternalLink from 'app/components/externalLink';
import Link from 'app/components/link';
import Panel from 'app/components/panels/panel';

export default class Intro extends React.Component {
  static propTypes = {
    updateQuery: PropTypes.func.isRequired,
  };

  getExampleQueries() {
    return [
      {
        description: t('Last 10 event IDs'),
        query: {
          fields: ['event_id'],
          aggregations: [],
          conditions: [],
          limit: 10,
          orderby: '-timestamp',
        },
      },
      {
        description: t('Events by project ID'),
        query: {
          fields: ['project_id'],
          aggregations: [['count()', null, 'count']],
          conditions: [],
          limit: 1000,
          orderby: '-count',
        },
      },
      {
        description: t('Top exception types'),
        query: {
          fields: ['exception_stacks.type'],
          aggregations: [['count()', null, 'count']],
          conditions: [['exception_stacks.type', 'IS NOT NULL', null]],
          limit: 1000,
          orderby: '-count',
        },
      },
    ];
  }

  render() {
    return (
      <IntroContainer>
        <IntroBody>
          <Box w={500}>
            <TextBlock>
              {tct(
                `Welcome to [discover:Discover]. Discover lets you query raw
              event data in Sentry.`,
                {
                  discover: <strong />,
                }
              )}
            </TextBlock>
            <TextBlock>
              {t(
                `Getting started? Try running one of the example queries below.
              Select the query you want to make, then click "Run Query".`
              )}
              <ul>
                {this.getExampleQueries().map(({query, description}, idx) => (
                  <li key={idx}>
                    <Link onClick={() => this.props.updateQuery(query)}>
                      {description}
                    </Link>
                  </li>
                ))}
              </ul>
            </TextBlock>
            <TextBlock>
              {tct(
                `To learn more about how to use the query builder, see the
              [docs:docs].`,
                {docs: <ExternalLink href="https://docs.sentry.io/product/discover/" />}
              )}
            </TextBlock>
          </Box>
        </IntroBody>
      </IntroContainer>
    );
  }
}

const IntroContainer = styled(Panel)`
  width: 100%;
  height: 100%;
`;

const IntroBody = styled(Flex)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray5};
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
`;

const TextBlock = styled('div')`
  margin: 0 0 20px;
`;
