import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import {Alert} from 'sentry/components/core/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {space} from 'sentry/styles/space';
import type {CodeOwner, RepositoryProjectPathConfig} from 'sentry/types/integrations';

type CodeOwnerErrorKeys = keyof CodeOwner['errors'];

function ErrorMessage({
  message,
  values,
  link,
  linkValue,
}: {
  link: string;
  linkValue: React.ReactNode;
  message: string;
  values: string[];
}) {
  return (
    <Fragment>
      <ErrorMessageContainer>
        <span>{message}</span>
        <b>{values.join(', ')}</b>
      </ErrorMessageContainer>
      <ErrorCtaContainer>
        <ExternalLink href={link}>{linkValue}</ExternalLink>
      </ErrorCtaContainer>
    </Fragment>
  );
}

function ErrorMessageList({
  message,
  values,
  linkFunction,
  linkValueFunction,
}: {
  linkFunction: (s: string) => string;
  linkValueFunction: (s: string) => string;
  message: string;
  values: string[];
}) {
  return (
    <Fragment>
      <ErrorMessageContainer>
        <span>{message}</span>
      </ErrorMessageContainer>
      <ErrorMessageListContainer>
        {values.map((value, index) => (
          <ErrorInlineContainer key={index}>
            <b>{value}</b>
            <ErrorCtaContainer>
              <ExternalLink href={linkFunction(value)} key={index}>
                {linkValueFunction(value)}
              </ExternalLink>
            </ErrorCtaContainer>
          </ErrorInlineContainer>
        ))}
      </ErrorMessageListContainer>
    </Fragment>
  );
}

interface CodeOwnerErrorsProps {
  codeowners: CodeOwner[];
  orgSlug: string;
  projectSlug: string;
}

export function CodeOwnerErrors({
  codeowners,
  orgSlug,
  projectSlug,
}: CodeOwnerErrorsProps) {
  const filteredCodeowners = useMemo(() => {
    const owners = codeowners.filter(({errors}) => {
      // Remove codeowners files with no errors
      return Object.values(errors).some(values => values.length);
    });

    // Uniq errors
    return uniqBy(owners, codeowner => JSON.stringify(codeowner.errors));
  }, [codeowners]);

  const errMessage = (
    codeMapping: RepositoryProjectPathConfig,
    type: CodeOwnerErrorKeys,
    values: string[]
  ) => {
    switch (type) {
      case 'missing_external_teams':
        return (
          <ErrorMessage
            message="There’s a problem linking teams and members from an integration"
            values={values}
            link={`/settings/${orgSlug}/integrations/${codeMapping?.provider?.slug}/${codeMapping?.integrationId}/?tab=teamMappings`}
            linkValue="Configure Team Mappings"
          />
        );

      case 'missing_external_users':
        return (
          <ErrorMessage
            message={`The following usernames do not have an association in the organization: ${orgSlug}`}
            values={values}
            link={`/settings/${orgSlug}/integrations/${codeMapping?.provider?.slug}/${codeMapping?.integrationId}/?tab=userMappings`}
            linkValue="Configure User Mappings"
          />
        );
      case 'missing_user_emails':
        return (
          <ErrorMessage
            message={`The following emails do not have an Sentry user in the organization: ${orgSlug}`}
            values={values}
            link={`/settings/${orgSlug}/members/`}
            linkValue="Invite Users"
          />
        );

      case 'teams_without_access':
        return (
          <ErrorMessageList
            message={`The following teams do not have access to the project: ${projectSlug}`}
            values={values}
            linkFunction={value =>
              `/settings/${orgSlug}/teams/${value.slice(1)}/projects/`
            }
            linkValueFunction={value => `Configure ${value} Permissions`}
          />
        );

      case 'users_without_access':
        return (
          <ErrorMessageList
            message={`The following users are not on a team that has access to the project: ${projectSlug}`}
            values={values}
            linkFunction={email => `/settings/${orgSlug}/members/?query=${email}`}
            linkValueFunction={() => `Configure Member Settings`}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Fragment>
      {filteredCodeowners.map(({id, codeMapping, errors}) => {
        const errorPairs = Object.entries(errors).filter(
          ([_, values]) => values.length
        ) as Array<[CodeOwnerErrorKeys, string[]]>;
        const errorCount = errorPairs.reduce(
          (acc, [_, values]) => acc + values.length,
          0
        );
        return (
          <Alert.Container key={id}>
            <Alert
              key={id}
              type="error"
              showIcon
              expand={
                <AlertContentContainer key="container">
                  {errorPairs.map(([type, values]) => (
                    <ErrorContainer key={`${id}-${type}`}>
                      {errMessage(codeMapping!, type, values)}
                    </ErrorContainer>
                  ))}
                </AlertContentContainer>
              }
            >
              {errorCount === 1
                ? `There was ${errorCount} ownership issue within Sentry on the latest sync with the CODEOWNERS file`
                : `There were ${errorCount} ownership issues within Sentry on the latest sync with the CODEOWNERS file`}
            </Alert>
          </Alert.Container>
        );
      })}
    </Fragment>
  );
}

const AlertContentContainer = styled('div')`
  overflow-y: auto;
  max-height: 350px;
`;

const ErrorContainer = styled('div')`
  display: grid;
  grid-template-areas: 'message cta';
  grid-template-columns: 2fr 1fr;
  gap: ${space(2)};
  padding: ${space(1.5)} 0;
`;

const ErrorInlineContainer = styled(ErrorContainer)`
  gap: ${space(1.5)};
  grid-template-columns: 1fr 2fr;
  align-items: center;
  padding: 0;
`;

const ErrorMessageContainer = styled('div')`
  grid-area: message;
  display: grid;
  gap: ${space(1.5)};
`;

const ErrorMessageListContainer = styled('div')`
  grid-column: message / cta-end;
  gap: ${space(1.5)};
`;

const ErrorCtaContainer = styled('div')`
  grid-area: cta;
  justify-self: flex-end;
  text-align: right;
  line-height: 1.5;
`;
