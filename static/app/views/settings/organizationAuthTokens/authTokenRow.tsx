import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelItem} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSubtract} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {tokenPreview, TokenWip} from 'sentry/views/settings/organizationAuthTokens';

function LastUsed({
  organization,
  dateLastUsed,
  projectLastUsed,
}: {
  organization: Organization;
  dateLastUsed?: Date;
  projectLastUsed?: Project;
}) {
  if (dateLastUsed && projectLastUsed) {
    return (
      <Fragment>
        {tct('Last used [date] in [project]', {
          date: (
            <TimeSince
              date={getDynamicText({
                value: dateLastUsed,
                fixed: new Date(1508208080000), // National Pasta Day
              })}
            />
          ),
          project: (
            <Link to={`/settings/${organization.slug}/${projectLastUsed.slug}/`}>
              {projectLastUsed.name}
            </Link>
          ),
        })}
      </Fragment>
    );
  }

  if (dateLastUsed) {
    return (
      <Fragment>
        {tct('Last used [date]', {
          date: (
            <TimeSince
              date={getDynamicText({
                value: dateLastUsed,
                fixed: new Date(1508208080000), // National Pasta Day
              })}
            />
          ),
        })}
      </Fragment>
    );
  }

  if (projectLastUsed) {
    return (
      <Fragment>
        {tct('Last used in [project]', {
          project: (
            <Link to={`/settings/${organization.slug}/${projectLastUsed.slug}/`}>
              {projectLastUsed.name}
            </Link>
          ),
        })}
      </Fragment>
    );
  }

  return <Fragment>{t('Never used')}</Fragment>;
}

export function OrganizationAuthTokensAuthTokenRow({
  organization,
  isRevoking,
  token,
  revokeToken,
  canRevoke,
}: {
  canRevoke: boolean;
  isRevoking: boolean;
  organization: Organization;
  revokeToken: (token: TokenWip) => void;
  token: TokenWip;
}) {
  return (
    <StyledPanelItem>
      <StyledPanelHeader>
        <Label>
          <Link to={`/settings/${organization.slug}/auth-tokens/${token.id}/`}>
            {token.name}
          </Link>
        </Label>

        <Actions>
          <Tooltip
            title={t(
              'You must be an organization owner, manager or admin to revoke a token.'
            )}
            disabled={canRevoke}
          >
            <Confirm
              disabled={!canRevoke || isRevoking}
              onConfirm={() => revokeToken(token)}
              message={t(
                'Are you sure you want to revoke this token? The token will not be usable anymore, and this cannot be undone.'
              )}
            >
              <Button
                size="sm"
                onClick={() => revokeToken(token)}
                disabled={isRevoking || !canRevoke}
                icon={
                  isRevoking ? (
                    <LoadingIndicator mini />
                  ) : (
                    <IconSubtract isCircled size="xs" />
                  )
                }
              >
                {t('Revoke')}
              </Button>
            </Confirm>
          </Tooltip>
        </Actions>
      </StyledPanelHeader>

      <StyledPanelBody>
        {token.tokenLastCharacters && (
          <TokenPreview>
            {tokenPreview(
              getDynamicText({
                value: token.tokenLastCharacters,
                fixed: 'ABCD',
              })
            )}
          </TokenPreview>
        )}

        <LastUsedDate>
          <LastUsed
            dateLastUsed={token.dateLastUsed}
            projectLastUsed={token.projectLastUsed}
            organization={organization}
          />
        </LastUsedDate>
      </StyledPanelBody>
    </StyledPanelItem>
  );
}

const StyledPanelItem = styled(PanelItem)`
  flex-direction: column;
  padding: ${space(2)};
  gap: ${space(1)};
`;

const StyledPanelHeader = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${space(0.25)} ${space(1)};
`;

const Label = styled('div')``;

const Actions = styled('div')`
  margin-left: auto;
`;

const StyledPanelBody = styled('div')`
  display: flex;
  align-items: center;
`;

const LastUsedDate = styled('div')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
  margin-left: auto;
`;

const TokenPreview = styled('div')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;
