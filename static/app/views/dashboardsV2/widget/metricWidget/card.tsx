import {InjectedRouter} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import {HeaderTitle} from 'app/components/charts/styles';
import ErrorBoundary from 'app/components/errorBoundary';
import {Panel} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {GlobalSelection, Organization, Project} from 'app/types';

import Chart from './chart';
import StatsRequest from './statsRequest';
import {MetricWidget} from './types';

type Props = {
  widget: MetricWidget;
  api: Client;
  location: Location;
  organization: Organization;
  selection: GlobalSelection;
  router: InjectedRouter;
  project: Project;
};

function Card({widget, api, location, router, organization, project, selection}: Props) {
  const {groupings, searchQuery, title, displayType} = widget;

  return (
    <ErrorBoundary
      customComponent={<ErrorCard>{t('Error loading widget data')}</ErrorCard>}
    >
      <StyledPanel>
        <Title>{title}</Title>
        <StatsRequest
          api={api}
          location={location}
          organization={organization}
          projectSlug={project.slug}
          groupings={groupings}
          searchQuery={searchQuery}
          environments={selection.environments}
          datetime={selection.datetime}
        >
          {({isLoading, errored, series}) => {
            return (
              <Chart
                displayType={displayType}
                series={series}
                isLoading={isLoading}
                errored={errored}
                location={location}
                platform={project.platform}
                selection={selection}
                router={router}
              />
            );
          }}
        </StatsRequest>
      </StyledPanel>
    </ErrorBoundary>
  );
}

export default Card;

const StyledPanel = styled(Panel)`
  margin: 0;
  /* If a panel overflows due to a long title stretch its grid sibling */
  height: 100%;
  min-height: 96px;
  padding: ${space(2)} ${space(3)};
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

const Title = styled(HeaderTitle)`
  ${overflowEllipsis};
`;
