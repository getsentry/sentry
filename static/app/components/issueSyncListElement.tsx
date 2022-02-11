import * as React from 'react';
import {ClassNames} from '@emotion/react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {Hovercard} from 'sentry/components/hovercard';
import {IconAdd, IconClose} from 'sentry/icons';
import space from 'sentry/styles/space';
import {callIfFunction} from 'sentry/utils/callIfFunction';
import {getIntegrationIcon} from 'sentry/utils/integrationUtil';

type Props = {
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

class IssueSyncListElement extends React.Component<Props> {
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

    return `Link ${this.getPrettyName()} Issue`;
  }

  render() {
    return (
      <IssueSyncListElementContainer>
        <ClassNames>
          {({css}) => (
            <Hovercard
              containerClassName={css`
                display: flex;
                align-items: center;
                min-width: 0; /* flex-box overflow workaround */
              `}
              header={this.props.hoverCardHeader}
              body={this.props.hoverCardBody}
              bodyClassName="issue-list-body"
              show={this.props.showHoverCard}
            >
              {this.getIcon()}
              {this.getLink()}
            </Hovercard>
          )}
        </ClassNames>
        {(this.props.onClose || this.props.onOpen) && (
          <StyledIcon onClick={this.handleIconClick}>
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

export const IntegrationLink = styled('a')`
  text-decoration: none;
  padding-bottom: ${space(0.25)};
  margin-left: ${space(1)};
  color: ${p => p.theme.textColor};
  border-bottom: 1px solid ${p => p.theme.textColor};
  cursor: pointer;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &,
  &:hover {
    border-bottom: 1px solid ${p => p.theme.blue300};
  }
`;

const StyledIcon = styled('span')`
  color: ${p => p.theme.textColor};
  cursor: pointer;
`;

export default IssueSyncListElement;
