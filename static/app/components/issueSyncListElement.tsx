import {useMemo} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {Body, Hovercard} from 'sentry/components/hovercard';
import {IconAdd, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';

type Props = {
  children?: React.ReactNode;
  disabled?: boolean;
  externalIssueDisplayName?: string | null;
  externalIssueId?: string | null;
  externalIssueKey?: string | null;
  externalIssueLink?: string | null;
  hoverCardBody?: React.ReactNode;
  hoverCardHeader?: React.ReactNode;
  integrationType?: string;
  onClose?: (externalIssueId?: string | null) => void;
  onOpen?: () => void;
  showHoverCard?: boolean;
};

function IssueSyncListElement({
  children,
  disabled,
  externalIssueDisplayName,
  externalIssueId,
  externalIssueKey,
  externalIssueLink,
  hoverCardBody,
  hoverCardHeader,
  integrationType,
  onClose,
  onOpen,
  showHoverCard,
}: Props) {
  const isLinked = !!(externalIssueLink && externalIssueId);

  const handleIconClick = () => {
    if (isLinked) {
      onClose?.(externalIssueId);
    } else {
      onOpen?.();
    }
  };

  const icon = getIntegrationIcon(integrationType);

  const prettyName = useMemo(() => {
    switch (integrationType) {
      case 'gitlab':
        return 'GitLab';
      case 'github':
        return 'GitHub';
      case 'github_enterprise':
        return 'GitHub Enterprise';
      case 'vsts':
        return 'Azure DevOps';
      case 'jira_server':
        return 'Jira Server';
      default:
        return capitalize(integrationType);
    }
  }, [integrationType]);

  const text =
    children || externalIssueDisplayName || externalIssueKey || `${prettyName} Issue`;

  const link = (
    <IntegrationLink
      href={externalIssueLink || undefined}
      onClick={!isLinked ? onOpen : undefined}
      disabled={disabled}
    >
      {text}
    </IntegrationLink>
  );

  return (
    <IssueSyncListElementContainer data-test-id="external-issue-item">
      <ClassNames>
        {({css}) => (
          <StyledHovercard
            containerClassName={css`
              display: flex;
              align-items: center;
              min-width: 0; /* flex-box overflow workaround */

              svg {
                flex-shrink: 0;
              }
            `}
            header={hoverCardHeader}
            body={hoverCardBody}
            bodyClassName="issue-list-body"
            forceVisible={showHoverCard}
          >
            {icon}
            {link}
          </StyledHovercard>
        )}
      </ClassNames>
      {(onClose || onOpen) && (
        <StyledIcon
          role="button"
          aria-label={isLinked ? t('Close') : t('Add')}
          onClick={handleIconClick}
        >
          {isLinked ? <IconClose /> : onOpen ? <IconAdd /> : null}
        </StyledIcon>
      )}
    </IssueSyncListElementContainer>
  );
}

export const IssueSyncListElementContainer = styled('div')`
  line-height: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:not(:last-child) {
    margin-bottom: ${space(2)};
  }
`;

export const IntegrationLink = styled('a')<{disabled?: boolean}>`
  text-decoration: none;
  margin-left: ${space(1)};
  color: ${p => p.theme.textColor};
  cursor: pointer;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    color: ${({disabled, theme}) => (disabled ? theme.disabled : theme.linkColor)};
  }
`;

const StyledHovercard = styled(Hovercard)`
  ${Body} {
    max-height: 300px;
    overflow-y: auto;
  }
`;

const StyledIcon = styled('span')`
  color: ${p => p.theme.textColor};
  cursor: pointer;
`;

export default IssueSyncListElement;
