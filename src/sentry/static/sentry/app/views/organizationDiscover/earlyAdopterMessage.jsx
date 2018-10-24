import React from 'react';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';
import theme from 'app/utils/theme';

import Alert from 'app/components/alert';
import Link from 'app/components/link';
import {t} from 'app/locale';

export default class EarlyAdopterMessage extends React.Component {
  render() {
    return (
      <StyledAlert type="info" icon="icon-labs">
        <StyledAlertText>
          {t('Sentry Discover is alpha software. Thanks for being an early adopter.')}
          <StyledLink href="mailto:feedback-discover@sentry.io">
            {t('feedback-discover@sentry.io')}
          </StyledLink>
        </StyledAlertText>
      </StyledAlert>
    );
  }
}

const StyledAlert = styled(Alert)`
  padding: ${p => p.theme.grid}px ${p => p.theme.grid * 2}px;
  margin: 0;
  align-items: center;
`;

const StyledAlertText = styled(Flex)`
  justify-content: space-between;
  @media (max-width: ${theme.breakpoints[2]}) {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
`;

const StyledLink = styled(Link)`
  width: fit-content;
`;
