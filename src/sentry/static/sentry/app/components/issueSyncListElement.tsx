import {ClassNames} from '@emotion/core';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {
  IconClose,
  IconBitbucket,
  IconGeneric,
  IconGithub,
  IconGitlab,
  IconJira,
  IconAdd,
  IconVsts,
} from 'app/icons';
import space from 'app/styles/space';
import Hovercard from 'app/components/hovercard';
import {callIfFunction} from 'app/utils/callIfFunction';

type Props = {
  externalIssueLink?: string | null;
  externalIssueId?: string | null;
  externalIssueKey?: string | null;
  externalIssueDisplayName?: string | null;
  onOpen?: () => void;
  onClose?: (externalIssueId?: string | null) => void;
  integrationType?: string;
  hoverCardHeader?: React.ReactNode;
  hoverCardBody?: React.ReactNode;
};

class IssueSyncListElement extends React.Component<Props> {
  static propTypes = {
    externalIssueLink: PropTypes.string,
    externalIssueId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    externalIssueKey: PropTypes.string,
    externalIssueDisplayName: PropTypes.string,
    onOpen: PropTypes.func,
    onClose: PropTypes.func,
    integrationType: PropTypes.string,
    hoverCardHeader: PropTypes.node,
    hoverCardBody: PropTypes.node,
  };

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
    switch (this.props.integrationType) {
      case 'bitbucket':
        return <IconBitbucket size="md" />;
      case 'gitlab':
        return <IconGitlab size="md" />;
      case 'github':
        return <IconGithub size="md" />;
      case 'github_enterprise':
        return <IconGithub size="md" />;
      case 'jira':
      case 'jira_server':
        return <IconJira size="md" />;
      case 'vsts':
        return <IconVsts size="md" />;
      default:
        return <IconGeneric size="md" />;
    }
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
  color: ${p => p.theme.gray700};
  border-bottom: 1px solid ${p => p.theme.gray700};
  cursor: pointer;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &,
  &:hover {
    border-bottom: 1px solid ${p => p.theme.blue400};
  }
`;

const StyledIcon = styled('span')`
  color: ${p => p.theme.gray700};
  cursor: pointer;
`;

export default IssueSyncListElement;
