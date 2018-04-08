import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import InlineSvg from '../../../../components/inlineSvg';
import SentryTypes from '../../../../proptypes';
import TeamAvatar from '../../../../components/avatar/teamAvatar';
import UserBadge from '../../../../components/userBadge';
import highlightFuseMatches from '../../../../utils/highlightFuseMatches';

export default class SearchResult extends React.Component {
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

    let matchedTitle = matches.find(({key}) => key === 'title');
    let matchedDescription = matches.find(({key}) => key === 'description');
    let highlightedTitle = matchedTitle ? highlightFuseMatches(matchedTitle) : title;
    let highlightedDescription = matchedDescription
      ? highlightFuseMatches(matchedDescription)
      : description;

    if (sourceType === 'member') {
      return (
        <UserBadge
          displayName={highlightedTitle}
          displayEmail={highlightedDescription}
          userLink={false}
          orgId={params.orgId}
          user={model}
        />
      );
    }

    return (
      <React.Fragment>
        <div>
          {sourceType === 'team' && <StyledTeamAvatar team={model} size={32} />}
          <span>{highlightedTitle}</span>
        </div>

        <SearchDetail>{highlightedDescription}</SearchDetail>
      </React.Fragment>
    );
  }

  renderResultType() {
    let {item} = this.props;
    let {resultType} = item;

    // let isRoute = resultType === 'route';
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

const SearchDetail = styled.div`
  font-size: 0.8em;
  line-height: 1.3;
  margin-top: 4px;
  opacity: 0.9;
  color: ${p => p.theme.gray3};
`;

const Content = styled(props => <Flex direction="column" {...props} />)``;

const ResultTypeIcon = styled(InlineSvg)`
  color: ${p => p.theme.gray1};
  font-size: 1.2em;
  flex-shrink: 0;
`;

const StyledTeamAvatar = styled(TeamAvatar)`
  margin-right: 0.5em;
`;
