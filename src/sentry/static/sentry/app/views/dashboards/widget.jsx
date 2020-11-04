import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody} from 'app/components/panels';
import {t} from 'app/locale';
import ErrorBoundary from 'app/components/errorBoundary';
import LoadingMask from 'app/components/loadingMask';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import DiscoverQuery from './discoverQuery';
import ExploreWidget from './exploreWidget';
import WidgetChart from './widgetChart';

class Widget extends React.Component {
  static propTypes = {
    releasesLoading: PropTypes.bool,
    releases: PropTypes.arrayOf(SentryTypes.Release),
    widget: SentryTypes.Widget,
    organization: SentryTypes.Organization,
    selection: SentryTypes.GlobalSelection,
    router: PropTypes.object,
  };

  render() {
    const {
      organization,
      releasesLoading,
      router,
      widget,
      releases,
      selection,
    } = this.props;
    const {title, includePreviousPeriod, compareToPeriod} = widget;

    return (
      <ErrorBoundary customComponent={<ErrorCard>{t('Error loading widget')}</ErrorCard>}>
        <DiscoverQuery
          releasesLoading={releasesLoading}
          releases={releases}
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
              <WidgetWrapperForMask>
                {reloading && <ReloadingMask />}
                <StyledPanel>
                  <WidgetHeader>{title}</WidgetHeader>
                  <StyledPanelBody>
                    <WidgetChart {...widgetChartProps} />
                  </StyledPanelBody>
                  <WidgetFooter>
                    <div />
                    <ExploreWidget {...{widget, queries, router, selection}} />
                  </WidgetFooter>
                </StyledPanel>
              </WidgetWrapperForMask>
            );
          }}
        </DiscoverQuery>
      </ErrorBoundary>
    );
  }
}

export default withOrganization(withGlobalSelection(Widget));
export {Widget};

const StyledPanel = styled(Panel)`
  margin-bottom: ${space(2)};
`;

const StyledPanelBody = styled(PanelBody)`
  height: 200px;
`;

const Placeholder = styled('div')`
  background-color: ${p => p.theme.gray100};
  height: 237px;
`;

const WidgetWrapperForMask = styled('div')`
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
  margin-bottom: ${space(2)};
`;

const WidgetHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;
const WidgetFooter = styled(WidgetHeader)`
  border-top: 1px solid ${p => p.theme.border};
  padding: 0;
`;
