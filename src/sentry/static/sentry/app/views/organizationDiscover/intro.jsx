import React from 'react';
import styled from 'react-emotion';
import {Box, Flex} from 'grid-emotion';

import {tct} from 'app/locale';

import ExternalLink from 'app/components/externalLink';

export default class Intro extends React.Component {
  render() {
    return (
      <IntroContainer
        style={{width: '100%', height: '100%'}}
        align="center"
        justify="center"
      >
        <Box w={500}>
          <p>
            {tct(
              `Welcome to [discover:Discover]. Discover lets you query raw
              event data in Sentry.`,
              {
                discover: <strong />,
              }
            )}
          </p>
          <p>
            {tct(
              `Getting started? Try selecting [projectId:projectId] under
              Summarize, and [count:count] under Aggregations. Click "Run Query"
              to get the total count of events by project over the last 2 weeks.`,
              {
                projectId: <code />,
                count: <code />,
              }
            )}
          </p>
          <p>
            {tct(
              `To learn more about how to use the query builder, see the
              [docs:docs].`,
              {docs: <ExternalLink href="" />}
            )}
          </p>
        </Box>
      </IntroContainer>
    );
  }
}

const IntroContainer = styled(Flex)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray5};
`;
