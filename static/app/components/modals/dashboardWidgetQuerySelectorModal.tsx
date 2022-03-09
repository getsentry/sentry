import * as React from 'react';
import {Link} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Button from 'sentry/components/button';
import Input from 'sentry/components/forms/controls/input';
import {IconChevron, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {DisplayModes} from 'sentry/utils/discover/types';
import withApi from 'sentry/utils/withApi';
import withPageFilters from 'sentry/utils/withPageFilters';
import {Widget} from 'sentry/views/dashboardsV2/types';
import {eventViewFromWidget} from 'sentry/views/dashboardsV2/utils';
import {DisplayType} from 'sentry/views/dashboardsV2/widgetBuilder/utils';

export type DashboardWidgetQuerySelectorModalOptions = {
  organization: Organization;
  widget: Widget;
};

type Props = ModalRenderProps &
  DashboardWidgetQuerySelectorModalOptions & {
    api: Client;
    organization: Organization;
    selection: PageFilters;
  };

class DashboardWidgetQuerySelectorModal extends React.Component<Props> {
  renderQueries() {
    const {organization, widget, selection} = this.props;
    const querySearchBars = widget.queries.map((query, index) => {
      const eventView = eventViewFromWidget(
        widget.title,
        query,
        selection,
        widget.displayType
      );
      const discoverLocation = eventView.getResultsViewUrlTarget(organization.slug);
      // Pull a max of 3 valid Y-Axis from the widget
      const yAxisOptions = eventView.getYAxisOptions().map(({value}) => value);
      discoverLocation.query.yAxis = [
        ...new Set(query.fields.filter(field => yAxisOptions.includes(field))),
      ].slice(0, 3);
      switch (widget.displayType) {
        case DisplayType.BAR:
          discoverLocation.query.display = DisplayModes.BAR;
          break;
        default:
          break;
      }
      return (
        <React.Fragment key={index}>
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
                  trackAdvancedAnalyticsEvent(
                    'dashboards_views.query_selector.selected',
                    {
                      organization,
                      widget_type: widget.displayType,
                    }
                  );
                }}
                aria-label={t('Open in Discover')}
              />
            </Link>
          </QueryContainer>
        </React.Fragment>
      );
    });
    return querySearchBars;
  }

  render() {
    const {Body, Header, widget} = this.props;
    return (
      <React.Fragment>
        <Header closeButton>
          <h4>{widget.title}</h4>
        </Header>
        <Body>
          <p>
            {t(
              'Multiple queries were used to create this widget visualization. Which query would you like to view in Discover?'
            )}
          </p>
          {this.renderQueries()}
        </Body>
      </React.Fragment>
    );
  }
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
  box-shadow: inset ${p => p.theme.dropShadowLight};
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
