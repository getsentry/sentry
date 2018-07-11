import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';

class IssueSyncElement extends React.Component {
  static propTypes = {
    externalIssueLink: PropTypes.string,
    externalIssueId: PropTypes.string,
    onClose: PropTypes.func,
    integrationType: PropTypes.oneOf(['github', 'jira', 'vsts']),
  };

  static defaultProps = {
    extenalIssueLink: '#',
  };

  getIcon() {
    switch (this.props.integrationType) {
      case 'github':
        return <IntegrationIcon src="icon-github" />;
      case 'jira':
        return <IntegrationIcon src="icon-jira" />;
      case 'vsts':
        return <IntegrationIcon src="icon-vsts" />;
      default:
        return null;
    }
  }

  getText() {
    return this.props.externalIssueLink && this.props.externalIssueId ? (
      <IntegrationLink href={this.props.externalIssueLink}>
        {this.props.externalIssueId}
      </IntegrationLink>
    ) : (
      <IntegrationLink href={'#'}>
        Link <IntegrationName>{this.props.integrationType}</IntegrationName> Issue
      </IntegrationLink>
    );
  }

  render() {
    return (
      <Flex align="center" justify="space-between" p={1}>
        <div>
          {this.getIcon()}
          {this.getText()}
        </div>
        <IconClose src="icon-close" onClick={this.props.onClose} />
      </Flex>
    );
  }
}

const IntegrationIcon = styled(InlineSvg)`
  color: ${p => p.theme.gray4};
  width: ${space(3)};
  height: ${space(3)};
`;

const IntegrationLink = styled('a')`
  text-decoration: none;
  border-bottom: 1px solid ${p => p.theme.gray4};
  padding-bottom: ${space(0.25)};
  color: ${p => p.theme.gray4};
  margin-left: ${space(1)};
`;

const IntegrationName = styled('span')`
  text-transform: capitalize;
`;

const IconClose = styled(InlineSvg)`
  height: 1.25rem;
  color: ${p => p.theme.gray4};
`;

export default IssueSyncElement;
