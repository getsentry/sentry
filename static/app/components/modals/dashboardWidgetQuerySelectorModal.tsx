import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import Input from 'sentry/components/input';
import Link from 'sentry/components/links/link';
import {IconChevron, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import withApi from 'sentry/utils/withApi';
import withPageFilters from 'sentry/utils/withPageFilters';
import type {Widget} from 'sentry/views/dashboards/types';
import {getWidgetDiscoverUrl} from 'sentry/views/dashboards/utils';

export type DashboardWidgetQuerySelectorModalOptions = {
  organization: Organization;
  widget: Widget;
  isMetricsData?: boolean;
};

type Props = ModalRenderProps &
  DashboardWidgetQuerySelectorModalOptions & {
    api: Client;
    organization: Organization;
    selection: PageFilters;
  };

function DashboardWidgetQuerySelectorModal(props: Props) {
  const {organization, widget, selection, isMetricsData, Body, Header} = props;

  const renderQueries = () => {
    const querySearchBars = widget.queries.map((query, index) => {
      const discoverLocation = getWidgetDiscoverUrl(
        {
          ...widget,
          queries: [query],
        },
        selection,
        organization,
        0,
        isMetricsData
      );
      return (
        <Fragment key={index}>
          <QueryContainer>
            <Container>
              <SearchLabel htmlFor="smart-search-input" aria-label={t('Search events')}>
                <IconSearch />
              </SearchLabel>
              <StyledInput value={query.conditions} disabled />
            </Container>
            <Link to={discoverLocation}>
              <OpenInDiscoverButton
                priority="primary"
                icon={<IconChevron size="xs" direction="right" />}
                onClick={() => {
                  trackAnalytics('dashboards_views.query_selector.selected', {
                    organization,
                    widget_type: widget.displayType,
                  });
                }}
                aria-label={t('Open in Discover')}
              />
            </Link>
          </QueryContainer>
        </Fragment>
      );
    });
    return querySearchBars;
  };

  return (
    <Fragment>
      <Header closeButton>
        <h4>{widget.title}</h4>
      </Header>
      <Body>
        <p>
          {t(
            'Multiple queries were used to create this widget visualization. Which query would you like to view in Discover?'
          )}
        </p>
        {renderQueries()}
      </Body>
    </Fragment>
  );
}

const StyledInput = styled(Input)`
  text-overflow: ellipsis;
  padding: 0px;
  box-shadow: none;
  height: auto;
  &:disabled {
    border: none;
    cursor: default;
  }
`;
const QueryContainer = styled('div')`
  display: flex;
  margin-bottom: ${space(1)};
`;
const OpenInDiscoverButton = styled(Button)`
  margin-left: ${space(1)};
`;

const Container = styled('div')`
  border: 1px solid ${p => p.theme.border};
  box-shadow: inset ${p => p.theme.dropShadowMedium};
  background: ${p => p.theme.backgroundSecondary};
  padding: 7px ${space(1)};
  position: relative;
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${space(1)};
  align-items: start;
  flex-grow: 1;
  border-radius: ${p => p.theme.borderRadius};
`;

const SearchLabel = styled('label')`
  display: flex;
  padding: ${space(0.5)} 0;
  margin: 0;
  color: ${p => p.theme.gray300};
`;

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;

export default withApi(withPageFilters(DashboardWidgetQuerySelectorModal));
