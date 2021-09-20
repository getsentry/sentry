import * as React from 'react';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {IconChevron, IconSearch} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {Widget} from 'app/views/dashboardsV2/types';
import {eventViewFromWidget} from 'app/views/dashboardsV2/utils';
import Input from 'app/views/settings/components/forms/controls/input';

export type DashboardWidgetQuerySelectorModalOptions = {
  organization: Organization;
  widget: Widget;
};

type Props = ModalRenderProps &
  DashboardWidgetQuerySelectorModalOptions & {
    api: Client;
    organization: Organization;
    selection: GlobalSelection;
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
      discoverLocation.query.yAxis = query.fields
        .filter(field => yAxisOptions.includes(field))
        .slice(0, 3);
      return (
        <React.Fragment key={index}>
          <QueryContainer>
            <Container>
              <SearchLabel htmlFor="smart-search-input" aria-label={t('Search events')}>
                <IconSearch />
              </SearchLabel>
              <StyledInput value={query.conditions} disabled />
            </Container>
            <OpenInDiscoverButton
              priority="primary"
              icon={<IconChevron size="xs" direction="right" />}
              onClick={() => {
                browserHistory.push(discoverLocation);
              }}
            />
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
  grid-gap: ${space(1)};
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

export default withApi(withGlobalSelection(DashboardWidgetQuerySelectorModal));
