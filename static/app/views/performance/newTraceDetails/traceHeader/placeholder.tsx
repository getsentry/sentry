import {Container, Flex, Grid} from '@sentry/scraps/layout';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {TopBar} from 'sentry/views/navigation/topBar';

import {getTraceViewBreadcrumbs} from './breadcrumbs';
import {TraceHeaderComponents} from './styles';

const traceViewFeedbackOptions = {
  messagePlaceholder: t('How can we make the trace view better for you?'),
  tags: {
    ['feedback.source']: 'trace-view',
    ['feedback.owner']: 'performance',
  },
};

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
        <Flex justify="between" align="center" gap="md">
          <TopBar.Slot name="title">
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
          </TopBar.Slot>
          <Grid flow="column" align="center" gap="md">
            <TopBar.Slot name="feedback">
              <FeedbackButton
                feedbackOptions={traceViewFeedbackOptions}
                aria-label={t('Give Feedback')}
                tooltipProps={{title: t('Give Feedback')}}
              >
                {null}
              </FeedbackButton>
            </TopBar.Slot>
          </Grid>
        </Flex>
        <TraceHeaderComponents.HeaderGrid>
          <Container area="title" minWidth={0}>
            <TraceHeaderComponents.StyledPlaceholder _width={300} _height={20} />
          </Container>
          <Container area="meta" justifySelf={{zero: 'start', xl: 'end'}}>
            <Flex align="center" gap="xl" wrap="wrap">
              <TraceHeaderComponents.StyledPlaceholder _width={80} _height={42} />
              <TraceHeaderComponents.StyledPlaceholder _width={80} _height={42} />
              <TraceHeaderComponents.StyledPlaceholder _width={80} _height={42} />
            </Flex>
          </Container>
          <Container area="highlights" minWidth={0} overflow="hidden">
            <Flex align="center" gap="md">
              <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
              <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
              <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
            </Flex>
          </Container>
          <Container area="projects" justifySelf={{zero: 'start', xl: 'end'}}>
            <TraceHeaderComponents.StyledPlaceholder _width={50} _height={28} />
          </Container>
        </TraceHeaderComponents.HeaderGrid>
      </TraceHeaderComponents.HeaderContent>
    </TraceHeaderComponents.HeaderLayout>
  );
}
