import {ClassNames} from '@emotion/core';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import capitalize from 'lodash/capitalize';
import Hovercard from 'app/components/hovercard';
import {callIfFunction} from 'app/utils/callIfFunction';

type Props = {
  externalIssueLink: string | null;
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

  getIcon(): React.ReactNode {
    switch (this.props.integrationType) {
      case 'bitbucket':
        return <IntegrationIcon src="icon-bitbucket" />;
      case 'gitlab':
        return <IntegrationIcon src="icon-gitlab" />;
      case 'github':
        return <IntegrationIcon src="icon-github" />;
      case 'github_enterprise':
        return <IntegrationIcon src="icon-github" />;
      case 'jira':
      case 'jira_server':
        return <IntegrationIcon src="icon-jira" />;
      case 'vsts':
        return <IntegrationIcon src="icon-vsts" />;
      default:
        return <IntegrationIcon src="icon-generic-box" />;
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
        {this.props.onOpen && this.props.onClose && (
          <OpenCloseIcon
            src="icon-close"
            onClick={this.isLinked() ? this.handleDelete : this.props.onOpen}
            isLinked={this.isLinked()}
          />
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

export const IntegrationIcon = styled(InlineSvg)`
  color: ${p => p.theme.gray4};
  width: ${space(3)};
  height: ${space(3)};
  cursor: pointer;
  flex-shrink: 0;
`;

export const IntegrationLink = styled('a')`
  text-decoration: none;
  padding-bottom: ${space(0.25)};
  margin-left: ${space(1)};
  color: ${p => p.theme.gray4};
  border-bottom: 1px solid ${p => p.theme.gray4};
  cursor: pointer;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &,
  &:hover {
    border-bottom: 1px solid ${p => p.theme.blue};
  }
`;

export const OpenCloseIcon = styled(InlineSvg)<{isLinked: boolean}>`
  height: ${space(1.5)};
  color: ${p => p.theme.gray4};
  transition: 0.2s transform;
  cursor: pointer;
  box-sizing: content-box;
  padding: ${space(1)};
  margin: -${space(1)};
  ${p => (p.isLinked ? '' : 'transform: rotate(45deg) scale(0.9);')};
`;

export default IssueSyncListElement;
