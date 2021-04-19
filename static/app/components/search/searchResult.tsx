import React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';

import IdBadge from 'app/components/idBadge';
import {IconInput, IconLink, IconSettings} from 'app/icons';
import PluginIcon from 'app/plugins/components/pluginIcon';
import space from 'app/styles/space';
import highlightFuseMatches from 'app/utils/highlightFuseMatches';
import {StyledSettingsSearch} from 'app/views/settings/components/settingsSearch';

import {Result} from './sources/types';

type Props = WithRouterProps<{orgId: string}> & {
  highlighted: boolean;
  item: Result['item'];
  matches: Result['matches'];
};

class SearchResult extends React.Component<Props> {
  renderContent() {
    const {highlighted, item, matches, params} = this.props;
    const {sourceType, model, extra} = item;
    let {title, description} = item;

    if (matches) {
      // TODO(ts) Type this better.
      const HighlightedMarker = (p: any) => (
        <HighlightMarker highlighted={highlighted} {...p} />
      );

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
        {extra && <ExtraDetail>{extra}</ExtraDetail>}
      </React.Fragment>
    );
  }

  renderResultType() {
    const {item} = this.props;
    const {resultType, model} = item;

    const isSettings = resultType === 'settings';
    const isField = resultType === 'field';
    const isRoute = resultType === 'route';
    const isIntegration = resultType === 'integration';

    if (isSettings) {
      return <IconSettings />;
    }

    if (isField) {
      return <IconInput />;
    }

    if (isRoute) {
      return <IconLink />;
    }

    if (isIntegration) {
      return <StyledPluginIcon pluginId={model.slug} />;
    }

    return null;
  }

  render() {
    return (
      <Wrapper>
        <Content>{this.renderContent()}</Content>
        <IconWrapper>{this.renderResultType()}</IconWrapper>
      </Wrapper>
    );
  }
}

export default withRouter(SearchResult);

// This is for tests
const SearchTitle = styled('span')``;

const SearchDetail = styled('div')`
  font-size: 0.8em;
  line-height: 1.3;
  margin-top: 4px;
  opacity: 0.8;
`;

const ExtraDetail = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-top: ${space(0.5)};
`;

const BadgeDetail = styled('div')<{highlighted: boolean}>`
  line-height: 1.3;
  color: ${p => (p.highlighted ? p.theme.purple300 : null)};
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

const IconWrapper = styled('div')`
  ${/* sc-selector*/ StyledSettingsSearch} & {
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
  color: ${p => p.theme.active};
`;
