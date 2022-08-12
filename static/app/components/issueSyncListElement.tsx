import {Component} from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {Body, Hovercard} from 'sentry/components/hovercard';
import {IconAdd, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';

type Props = {
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

class IssueSyncListElement extends Component<Props> {
  isLinked(): boolean {
    return !!(this.props.externalIssueLink && this.props.externalIssueId);
  }

  handleDelete = (): void => {
    callIfFunction(this.props.onClose, this.props.externalIssueId);
  };

  handleIconClick = () => {
    if (this.isLinked()) {
      this.handleDelete();
    } else if (this.props.onOpen) {
      this.props.onOpen();
    }
  };

  getIcon(): React.ReactNode {
    return getIntegrationIcon(this.props.integrationType);
  }

  getPrettyName(): string {
    const type = this.props.integrationType;
    switch (type) {
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
        return capitalize(type);
    }
  }

  getLink(): React.ReactElement {
    return (
      <IntegrationLink
        href={this.props.externalIssueLink || undefined}
        onClick={!this.isLinked() ? this.props.onOpen : undefined}
        disabled={this.props.disabled}
      >
        {this.getText()}
      </IntegrationLink>
    );
  }

  getText(): React.ReactNode {
    if (this.props.children) {
      return this.props.children;
    }
    if (this.props.externalIssueDisplayName) {
      return this.props.externalIssueDisplayName;
    }
    if (this.props.externalIssueKey) {
      return this.props.externalIssueKey;
    }

    return `${this.getPrettyName()} Issue`;
  }

  render() {
    return (
      <IssueSyncListElementContainer>
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
              header={this.props.hoverCardHeader}
              body={this.props.hoverCardBody}
              bodyClassName="issue-list-body"
              forceVisible={this.props.showHoverCard}
            >
              {this.getIcon()}
              {this.getLink()}
            </StyledHovercard>
          )}
        </ClassNames>
        {(this.props.onClose || this.props.onOpen) && (
          <StyledIcon
            role="button"
            aria-label={this.isLinked() ? t('Close') : t('Add')}
            onClick={this.handleIconClick}
          >
            {this.isLinked() ? <IconClose /> : this.props.onOpen ? <IconAdd /> : null}
          </StyledIcon>
        )}
      </IssueSyncListElementContainer>
    );
  }
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
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover {
    color: ${({disabled, theme}) => (disabled ? theme.disabled : theme.blue300)};
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
