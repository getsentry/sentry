import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

class IssueSyncElement extends React.Component {
  static propTypes = {
    externalIssueLink: PropTypes.string,
    externalIssueId: PropTypes.string,
    openModal: PropTypes.func,
    onClose: PropTypes.func,
    integrationType: PropTypes.oneOf([
      'github',
      'github_enterprise',
      'jira',
      'vsts',
      'asana',
    ]),
  };

  static defaultProps = {
    externalIssueLink: '#',
  };

  isLinked() {
    return this.props.externalIssueLink && this.props.externalIssueId;
  }

  handleClick = evt => {
    return this.props.openModal();
  };

  handleDelete = evt => {
    return this.props.onClose(this.props.externalIssueId);
  };

  getHumanName() {
    const type = this.props.integrationType;

    switch (type) {
      case 'github_enterprise':
        return 'Github Enterprise';
      case 'vsts':
        return 'VSTS';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }

  getIcon() {
    switch (this.props.integrationType) {
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

  getPrefix() {
    switch (this.props.integrationType) {
      case 'github':
        return 'GH-';
      case 'github_enterprise':
        return 'GHE-';
      default:
        return this.getHumanName() + '-';
    }
  }

  getText() {
    return this.isLinked() ? (
      <IntegrationLink href={this.props.externalIssueLink}>
        {`${this.getPrefix()}${this.props.externalIssueId}`}
      </IntegrationLink>
    ) : (
      <IntegrationLink onClick={this.handleClick}>
        Link <IntegrationName>{this.props.integrationType}</IntegrationName> Issue
      </IntegrationLink>
    );
  }

  render() {
    return (
      <IssueSyncListElementContainer>
        <div>
          {this.getIcon()}
          {this.getText()}
        </div>
        <IconClose
          src="icon-close"
          onClick={this.handleDelete}
          isLinked={this.isLinked()}
        />
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
    padding-bottom: ${space(2)};
  }
`;

const IntegrationIcon = styled(InlineSvg)`
  color: ${p => p.theme.gray4};
  width: ${space(3)};
  height: ${space(3)};
`;

const IntegrationLink = styled('a')`
  text-decoration: none;
  padding-bottom: ${space(0.25)};
  margin-left: ${space(1)};
  color: ${p => p.theme.gray4};
  border-bottom: 1px solid ${p => p.theme.gray4};

  &,
  &:hover {
    border-bottom: 1px solid ${p => p.theme.linkColor};
  }
`;

const IntegrationName = styled('span')`
  text-transform: capitalize;
`;

const IconClose = styled(InlineSvg)`
  height: 1.25rem;
  color: ${p => p.theme.gray4};
  transition: 0.2s transform;
  ${p => (p.isLinked ? '' : 'transform: rotate(45deg) scale(0.75);')};
`;

export default IssueSyncElement;
