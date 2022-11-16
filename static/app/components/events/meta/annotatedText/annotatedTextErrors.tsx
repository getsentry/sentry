import {Fragment} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Tooltip from 'sentry/components/tooltip';
import {IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import {MetaError} from 'sentry/types';

function formatErrorKind(kind: string) {
  return capitalize(kind.replace(/_/g, ' '));
}

function ErrorMessage({error}: {error?: MetaError}) {
  if (Array.isArray(error)) {
    if (!error[0] && !error[1]?.reason) {
      return null;
    }

    const errorMessage: React.ReactNode[] = [];

    if (error[0]) {
      errorMessage.push(<strong>{formatErrorKind(error[0])}</strong>);
    }

    if (error[1]?.reason) {
      errorMessage.push(<div>{capitalize(error[1].reason)}</div>);
    }

    return <div>{errorMessage}</div>;
  }

  if (!error) {
    return null;
  }

  return <Fragment>{formatErrorKind(error)}</Fragment>;
}

export function AnnotatedTextErrors({errors = []}: {errors: Array<MetaError>}) {
  if (!errors.length) {
    return null;
  }

  return (
    <StyledTooltip
      title={
        errors.length === 1 ? (
          <ErrorMessage error={errors[0]} />
        ) : (
          <Errors symbol="bullet">
            {errors.map((error, index) => (
              <Error key={index}>
                <ErrorMessage error={error} />
              </Error>
            ))}
          </Errors>
        )
      }
    >
      <StyledIconWarning color="errorText" />
    </StyledTooltip>
  );
}

const StyledTooltip = styled(Tooltip)`
  margin-left: ${space(0.75)};
`;

const StyledIconWarning = styled(IconWarning)`
  vertical-align: middle;
`;

const Errors = styled(List)``;

const Error = styled(ListItem)`
  text-align: left;
`;
