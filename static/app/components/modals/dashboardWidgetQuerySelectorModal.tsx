import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {IconChevron} from '@sentry/icons/chevron';
import {IconSearch} from '@sentry/icons/search';

import {Button} from '@sentry/scraps/button';
import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import type {ModalRenderProps} from '@sentry/scraps/modal';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {getWidgetDiscoverUrl} from 'sentry/views/dashboards/utils';

export type DashboardWidgetQuerySelectorModalOptions = {
  dashboardFilters: DashboardFilters | undefined;
  organization: Organization;
  widget: Widget;
};

type Props = ModalRenderProps & DashboardWidgetQuerySelectorModalOptions;

function DashboardWidgetQuerySelectorModal(props: Props) {
  const {organization, widget, Body, Header, dashboardFilters} = props;
  const {selection} = usePageFilters();

  const renderQueries = () => {
    const querySearchBars = widget.queries.map((query, index) => {
      const discoverLocation = getWidgetDiscoverUrl(
        {
          ...widget,
          queries: [query],
        },
        dashboardFilters,
        selection,
        organization
      );
      return (
        <Fragment key={index}>
          <Flex marginBottom="md">
            <Container>
              <SearchLabel htmlFor="smart-search-input" aria-label={t('Search events')}>
                <IconSearch />
              </SearchLabel>
              <StyledInput value={query.conditions} disabled />
            </Container>
            <Link to={discoverLocation}>
              <OpenInDiscoverButton
                variant="primary"
                icon={<IconChevron size="xs" direction="right" />}
                onClick={() => {
                  trackAnalytics('dashboards_views.query_selector.selected', {
                    organization,
                    widget_type: widget.displayType,
                  });
                }}
                aria-label={t('Open in Explore')}
              />
            </Link>
          </Flex>
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
            'Multiple queries were used to create this widget visualization. Which query would you like to view in Explore?'
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
const OpenInDiscoverButton = styled(Button)`
  margin-left: ${p => p.theme.space.md};
`;

const Container = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.secondary};
  padding: 7px ${p => p.theme.space.md};
  position: relative;
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${p => p.theme.space.md};
  align-items: start;
  flex-grow: 1;
  border-radius: ${p => p.theme.radius.md};
`;

const SearchLabel = styled('label')`
  display: flex;
  padding: ${p => p.theme.space.xs} 0;
  margin: 0;
  color: ${p => p.theme.tokens.content.secondary};
`;

export const modalCss = css`
  width: 100%;
  max-width: 700px;
  margin: 70px auto;
`;

export default DashboardWidgetQuerySelectorModal;
