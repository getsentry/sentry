import React from 'react';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import Alert from 'app/components/alert';
import Link from 'app/components/link';
import {t} from 'app/locale';

export default class EarlyAdopterMessage extends React.Component {
  render() {
    return (
      <StyledAlert type="info" icon="icon-labs">
        <Flex justify="space-between">
          {t('Sentry Discover is alpha software. Thanks for being an early adopter.')}
          <Link href="mailto:feedback-discover@sentry.io">
            {t('feedback-discover@sentry.io')}
          </Link>
        </Flex>
      </StyledAlert>
    );
  }
}

const StyledAlert = styled(Alert)`
  padding: ${p => p.theme.grid}px ${p => p.theme.grid * 2}px;
  margin: 0;
  align-items: center;
`;
