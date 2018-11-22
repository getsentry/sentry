import PropTypes from 'prop-types';
import React from 'react';
import styled, {css} from 'react-emotion';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import {capitalize} from 'lodash';
import Hovercard from 'app/components/hovercard';

const hoverCardContainer = css`
  display: flex;
  align-items: center;
  min-width: 0; /* flex-box overflow workaround */
`;

const hoverCardStyles = css`
  min-height: 0;
  bottom: ${28 + 10}px; /* 28px is the current bottom value called in hovercard.less */
`;

class IssueSyncElement extends React.Component {
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

  isLinked() {
    return this.props.externalIssueLink && this.props.externalIssueId;
  }

  handleDelete = evt => {
    return this.props.onClose(this.props.externalIssueId);
  };

  getIcon() {
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
        return <IntegrationIcon src="icon-jira" />;
      case 'vsts':
        return <IntegrationIcon src="icon-vsts" />;
      default:
        return <IntegrationIcon src="icon-generic-box" />;
    }
  }

  getPrettyName() {
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
      default:
        return capitalize(type);
    }
  }

  getLink() {
    return (
      <IntegrationLink
        href={this.props.externalIssueLink}
        onClick={!this.isLinked() ? this.props.onOpen : undefined}
      >
        {this.getText()}
      </IntegrationLink>
    );
  }

  getText() {
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
        <Hovercard
          containerClassName={hoverCardContainer}
          header={this.props.hoverCardHeader}
          body={this.props.hoverCardBody}
          className={hoverCardStyles}
        >
          {this.getIcon()}
          {this.getLink()}
        </Hovercard>
        {this.props.onOpen &&
          this.props.onClose && (
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

const IssueSyncListElementContainer = styled('div')`
  line-height: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  &:not(:last-child) {
    margin-bottom: ${space(2)};
  }
`;

const IntegrationIcon = styled(InlineSvg)`
  color: ${p => p.theme.gray4};
  width: ${space(3)};
  height: ${space(3)};
  cursor: pointer;
  flex-shrink: 0;
`;

const IntegrationLink = styled('a')`
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
    border-bottom: 1px solid ${p => p.theme.linkColor};
  }
`;

const OpenCloseIcon = styled(InlineSvg)`
  height: ${space(1.5)};
  color: ${p => p.theme.gray4};
  transition: 0.2s transform;
  cursor: pointer;
  box-sizing: content-box;
  padding: ${space(1)};
  margin: -${space(1)};
  ${p => (p.isLinked ? '' : 'transform: rotate(45deg) scale(0.9);')};
`;

export default IssueSyncElement;
