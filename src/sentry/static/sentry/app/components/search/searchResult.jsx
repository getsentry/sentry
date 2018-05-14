import {Flex} from 'grid-emotion';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Avatar from 'app/components/avatar';
import InlineSvg from 'app/components/inlineSvg';
import SentryTypes from 'app/proptypes';
import IdBadge from 'app/components/idBadge';
import highlightFuseMatches from 'app/utils/highlightFuseMatches';

class SearchResult extends React.Component {
  static propTypes = {
    item: PropTypes.shape({
      /**
     * The source of the search result (i.e. a model type)
     */
      sourceType: PropTypes.oneOf([
        'organization',
        'project',
        'team',
        'member',
        'field',
        'route',
      ]),
      /**
     * The type of result this is, for example:
     * - can be a setting route,
     * - an application route (e.g. org dashboard)
     * - form field
     */
      resultType: PropTypes.oneOf(['settings', 'route', 'field']),
      title: PropTypes.string,
      description: PropTypes.string,
      model: PropTypes.oneOfType([
        SentryTypes.Organization,
        SentryTypes.Project,
        SentryTypes.Team,
        SentryTypes.Member,
      ]),
    }),
    matches: PropTypes.array,
  };

  renderContent() {
    let {item, matches, params} = this.props;
    let {sourceType, title, description, model} = item;

    let matchedTitle = matches && matches.find(({key}) => key === 'title');
    let matchedDescription = matches && matches.find(({key}) => key === 'description');
    let highlightedTitle = matchedTitle ? highlightFuseMatches(matchedTitle) : title;
    let highlightedDescription = matchedDescription
      ? highlightFuseMatches(matchedDescription)
      : description;

    if (sourceType === 'member') {
      return (
        <IdBadge
          displayName={highlightedTitle}
          displayEmail={highlightedDescription}
          userLink={false}
          orgId={params.orgId}
          member={model}
          avatarSize={32}
        />
      );
    }

    return (
      <React.Fragment>
        <div>
          {sourceType === 'team' && <TeamAvatar team={model} size={32} />}
          <SearchTitle>{highlightedTitle}</SearchTitle>
        </div>

        <SearchDetail>{highlightedDescription}</SearchDetail>
      </React.Fragment>
    );
  }

  renderResultType() {
    let {item} = this.props;
    let {resultType} = item;

    let isSettings = resultType === 'settings';
    let isField = resultType === 'field';

    if (isSettings) {
      return <ResultTypeIcon src="icon-settings" />;
    }

    if (isField) {
      return <ResultTypeIcon src="icon-input" />;
    }

    return <ResultTypeIcon src="icon-location" />;
  }

  render() {
    return (
      <Flex justify="space-between" align="center">
        <Content>{this.renderContent()}</Content>
        {this.renderResultType()}
      </Flex>
    );
  }
}

export default withRouter(SearchResult);

// This is for tests
const SearchTitle = styled.span`
  /* stylelint-disable-next-line no-empty-block */
`;

const SearchDetail = styled.div`
  font-size: 0.8em;
  line-height: 1.3;
  margin-top: 4px;
  opacity: 0.8;
`;

const Content = styled(props => <Flex direction="column" {...props} />)`
  /* stylelint-disable-next-line no-empty-block */
`;

const ResultTypeIcon = styled(InlineSvg)`
  color: ${p => p.theme.gray1};
  font-size: 1.2em;
  flex-shrink: 0;
`;

const TeamAvatar = styled(Avatar)`
  margin-right: 0.5em;
`;
