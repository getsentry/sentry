import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

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
        'help',
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
        'doc',
        'faq',
      ]),

      resultIcon: PropTypes.node,
      title: PropTypes.node,
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
    const {highlighted, item, matches, params} = this.props;
    const {sourceType, model} = item;
    let {title, description} = item;

    if (matches) {
      const HighlightedMarker = p => <HighlightMarker highlighted={highlighted} {...p} />;

      const matchedTitle = matches && matches.find(({key}) => key === 'title');
      const matchedDescription =
        matches && matches.find(({key}) => key === 'description');

      title = matchedTitle
        ? highlightFuseMatches(matchedTitle, HighlightedMarker)
        : title;
      description = matchedDescription
        ? highlightFuseMatches(matchedDescription, HighlightedMarker)
        : description;
    }

    if (['organization', 'member', 'project', 'team'].includes(sourceType)) {
      const DescriptionNode = (
        <BadgeDetail highlighted={highlighted}>{description}</BadgeDetail>
      );

      const badgeProps = {
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
        {description && <SearchDetail>{description}</SearchDetail>}
      </React.Fragment>
    );
  }

  renderResultType() {
    const {item} = this.props;
    const {resultIcon, resultType, model} = item;

    const isSettings = resultType === 'settings';
    const isField = resultType === 'field';
    const isRoute = resultType === 'route';
    const isIntegration = resultType === 'integration';

    if (resultIcon) {
      return resultIcon;
    }

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
      <Wrapper>
        <Content>{this.renderContent()}</Content>
        {this.renderResultType()}
      </Wrapper>
    );
  }
}

export default withRouter(SearchResult);

// This is for tests
const SearchTitle = styled('span')`
  /* stylelint-disable-next-line no-empty-block */
`;

const SearchDetail = styled('div')`
  font-size: 0.8em;
  line-height: 1.3;
  margin-top: 4px;
  opacity: 0.8;
`;

const BadgeDetail = styled('div')`
  line-height: 1.3;
  color: ${p => (p.highlighted ? p.theme.purpleDarkest : null)};
`;

const Wrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Content = styled('div')`
  display: flex;
  flex-direction: column;
`;

const ResultTypeIcon = styled(InlineSvg)`
  font-size: 1.2em;
  flex-shrink: 0;

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
