import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {LoadingMask} from 'app/views/organizationEvents/loadingPanel';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {WIDGET_DISPLAY} from 'app/views/organizationDashboard/constants';
import {t} from 'app/locale';
import ErrorBoundary from 'app/components/errorBoundary';
import ExploreWidget from 'app/views/organizationDashboard/exploreWidget';
import SentryTypes from 'app/sentryTypes';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import DiscoverQuery from './discoverQuery';
import WidgetChart from './widgetChart';

class Widget extends React.Component {
  static propTypes = {
    releases: PropTypes.arrayOf(SentryTypes.Release),
    widget: SentryTypes.Widget,
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
    router: PropTypes.object,
  };

  render() {
    const {organization, router, widget, releases, selection} = this.props;
    const {type, title, includePreviousPeriod, compareToPeriod} = widget;
    const isTable = type === WIDGET_DISPLAY.TABLE;

    return (
      <ErrorBoundary renderer={<ErrorCard>{t('Error loading widget')}</ErrorCard>}>
        <DiscoverQuery
          organization={organization}
          selection={selection}
          queries={widget.queries.discover}
          includePreviousPeriod={includePreviousPeriod}
          compareToPeriod={compareToPeriod}
        >
          {({queries, results, reloading}) => {
            // Show a placeholder "square" during initial load
            if (results === null) {
              return <Placeholder />;
            }

            const widgetChartProps = {
              releases,
              selection,
              results,
              widget,
              reloading,
              router,
              organization,
            };

            return (
              <WidgetWrapper>
                {reloading && <ReloadingMask />}
                {isTable && <WidgetChart {...widgetChartProps} />}
                {!isTable && (
                  <Panel>
                    <PanelHeader hasButtons>
                      {title}

                      <ExploreWidget {...{widget, queries, router, selection}} />
                    </PanelHeader>

                    <StyledPanelBody>
                      <WidgetChart {...widgetChartProps} />
                    </StyledPanelBody>
                  </Panel>
                )}
              </WidgetWrapper>
            );
          }}
        </DiscoverQuery>
      </ErrorBoundary>
    );
  }
}

export default withRouter(withOrganization(withGlobalSelection(Widget)));
export {Widget};

const StyledPanelBody = styled(PanelBody)`
  height: 200px;
`;

const Placeholder = styled('div')`
  background-color: ${p => p.theme.offWhite};
  height: 237px;
`;

const WidgetWrapper = styled('div')`
  position: relative;
`;

const ReloadingMask = styled(LoadingMask)`
  z-index: 1;
  opacity: 0.6;
`;

const ErrorCard = styled(Placeholder)`
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${p => p.theme.alert.error.backgroundLight};
  border: 1px solid ${p => p.theme.alert.error.border};
  color: ${p => p.theme.alert.error.textLight};
  border-radius: ${p => p.theme.borderRadius};
`;
