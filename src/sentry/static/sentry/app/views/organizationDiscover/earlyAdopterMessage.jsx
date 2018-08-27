import React from 'react';
import styled from 'react-emotion';

import Alert from 'app/components/alert';
import Link from 'app/components/link';
import {tct} from 'app/locale';

export default class EarlyAdopterMessage extends React.Component {
  render() {
    return (
      <StyledAlert type="info" icon="icon-circle-exclamation" system={false}>
        {tct(
          'This is an alpha release and may change in the future. Please email any feedback to [email:feedback-discover@sentry.io]. Thanks for being an early adopter!',
          {
            email: <Link href="mailto:feedback-discover@sentry.io" />,
          }
        )}
      </StyledAlert>
    );
  }
}

const StyledAlert = styled(Alert)`
  padding: ${p => p.theme.grid}px ${p => p.theme.grid * 2}px;
  margin: 0;
  border-radius: 0;
`;
