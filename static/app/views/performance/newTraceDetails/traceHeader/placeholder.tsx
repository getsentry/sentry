import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

import {getTraceViewBreadcrumbs} from './breadcrumbs';
import {TraceHeaderComponents} from './styles';

export function PlaceHolder({
  organization,
  project,
  traceSlug,
}: {
  organization: Organization;
  traceSlug: string;
  project?: Project;
}) {
  const {view} = useDomainViewFilters();
  const moduleURLBuilder = useModuleURLBuilder(true);
  const location = useLocation();

  return (
    <TraceHeaderComponents.HeaderLayout>
      <TraceHeaderComponents.HeaderContent>
        <TraceHeaderComponents.HeaderRow>
          <Breadcrumbs
            crumbs={getTraceViewBreadcrumbs({
              organization,
              location,
              moduleURLBuilder,
              traceSlug,
              project,
              view,
            })}
          />
          <ButtonBar gap={1}>
            <TraceHeaderComponents.ToggleTraceFormatButton
              location={location}
              organization={organization}
            />
            <TraceHeaderComponents.FeedbackButton />
          </ButtonBar>
        </TraceHeaderComponents.HeaderRow>
        <TraceHeaderComponents.HeaderRow>
          <PlaceHolderTitleWrapper>
            <TraceHeaderComponents.StyledPlaceholder _width={300} _height={20} />
            <TraceHeaderComponents.StyledPlaceholder _width={200} _height={18} />
          </PlaceHolderTitleWrapper>
          <PlaceHolderTitleWrapper>
            <TraceHeaderComponents.StyledPlaceholder _width={300} _height={18} />
            <TraceHeaderComponents.StyledPlaceholder _width={300} _height={24} />
          </PlaceHolderTitleWrapper>
        </TraceHeaderComponents.HeaderRow>
        <TraceHeaderComponents.StyledBreak />
        <TraceHeaderComponents.HeaderRow>
          <PlaceHolderHighlightWrapper>
            <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
            <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
            <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
          </PlaceHolderHighlightWrapper>
          <TraceHeaderComponents.StyledPlaceholder _width={50} _height={28} />
        </TraceHeaderComponents.HeaderRow>
      </TraceHeaderComponents.HeaderContent>
    </TraceHeaderComponents.HeaderLayout>
  );
}

const PlaceHolderTitleWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const PlaceHolderHighlightWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
