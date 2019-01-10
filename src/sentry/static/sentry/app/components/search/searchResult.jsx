import {Flex} from 'grid-emotion';
import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import IdBadge from 'app/components/idBadge';
import InlineSvg from 'app/components/inlineSvg';
import PluginIcon from 'app/plugins/components/pluginIcon';
import SentryTypes from 'app/sentryTypes';
import SettingsSearch from 'app/views/settings/components/settingsSearch';
import highlightFuseMatches from 'app/utils/highlightFuseMatches';

class SearchResult extends React.Component {
  static propTypes = {
    highlighted: PropTypes.bool,
    item: PropTypes.shape({
      /**
     * The source of the search result (i.e. a model type)
     */
      sourceType: PropTypes.oneOf([
        'organization',
        'project',
        'command',
        'team',
        'member',
        'field',
        'route',
        'issue',
        'event',
        'plugin',
        'integration',
      ]),
      /**
     * The type of result this is, for example:
     * - can be a setting route,
     * - an application route (e.g. org dashboard)
     * - form field
     */
      resultType: PropTypes.oneOf([
        'settings',
        'command',
        'route',
        'field',
        'issue',
        'event',
        'integration',
      ]),
      title: PropTypes.string,
      description: PropTypes.node,
      model: PropTypes.oneOfType([
        SentryTypes.Organization,
        SentryTypes.Project,
        SentryTypes.Team,
        SentryTypes.Member,
        SentryTypes.Group,
        SentryTypes.Event,
      ]),
    }),
    matches: PropTypes.array,
  };

  renderContent() {
    let {highlighted, item, matches, params} = this.props;
    let {sourceType, title, description, model} = item;

    if (matches) {
      const HighlightedMarker = p => <HighlightMarker highlighted={highlighted} {...p} />;

      let matchedTitle = matches && matches.find(({key}) => key === 'title');
      let matchedDescription = matches && matches.find(({key}) => key === 'description');

      title = matchedTitle
        ? highlightFuseMatches(matchedTitle, HighlightedMarker)
        : title;
      description = matchedDescription
        ? highlightFuseMatches(matchedDescription, HighlightedMarker)
        : description;
    }

    if (['organization', 'member', 'project', 'team'].includes(sourceType)) {
      let DescriptionNode = (
        <BadgeDetail highlighted={highlighted}>{description}</BadgeDetail>
      );

      let badgeProps = {
        displayName: title,
        displayEmail: DescriptionNode,
        description: DescriptionNode,
        useLink: false,
        orgId: params.orgId,
        avatarSize: 32,
        [sourceType]: model,
      };

      return <IdBadge {...badgeProps} />;
    }

    return (
      <React.Fragment>
        <div>
          <SearchTitle>{title}</SearchTitle>
        </div>

        <SearchDetail>{description}</SearchDetail>
      </React.Fragment>
    );
  }

  renderResultType() {
    let {item} = this.props;
    let {resultType, model} = item;

    let isSettings = resultType === 'settings';
    let isField = resultType === 'field';
    let isRoute = resultType === 'route';
    let isIntegration = resultType === 'integration';

    if (isSettings) {
      return <ResultTypeIcon src="icon-settings" />;
    }

    if (isField) {
      return <ResultTypeIcon src="icon-input" />;
    }

    if (isRoute) {
      return <ResultTypeIcon src="icon-link" />;
    }

    if (isIntegration) {
      return <StyledPluginIcon pluginId={model.key || model.id} />;
    }

    return null;
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

const BadgeDetail = styled.div`
  line-height: 1.3;
  color: ${p => (p.highlighted ? p.theme.purpleDarkest : null)};
`;

const Content = styled(props => <Flex direction="column" {...props} />)`
  /* stylelint-disable-next-line no-empty-block */
`;

const ResultTypeIcon = styled(InlineSvg)`
  font-size: 1.2em;
  flex-shrink: 0;

  /* stylelint-disable-next-line no-duplicate-selectors */
  ${SettingsSearch} & {
    color: inherit;
  }
`;

const StyledPluginIcon = styled(PluginIcon)`
  flex-shrink: 0;
`;

const HighlightMarker = styled('mark')`
  padding: 0;
  background: transparent;
  font-weight: bold;
  color: inherit;
`;
