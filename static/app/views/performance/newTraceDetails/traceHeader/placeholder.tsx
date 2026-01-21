import {Flex, Stack} from '@sentry/scraps/layout';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
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
          <ButtonBar>
            <FeedbackButton
              size="xs"
              feedbackOptions={{
                messagePlaceholder: t('How can we make the trace view better for you?'),
                tags: {
                  ['feedback.source']: 'trace-view',
                  ['feedback.owner']: 'performance',
                },
              }}
            />
          </ButtonBar>
        </TraceHeaderComponents.HeaderRow>
        <TraceHeaderComponents.HeaderRow>
          <Stack gap="xs">
            <TraceHeaderComponents.StyledPlaceholder _width={300} _height={20} />
            <TraceHeaderComponents.StyledPlaceholder _width={200} _height={18} />
          </Stack>
          <Stack gap="xs">
            <TraceHeaderComponents.StyledPlaceholder _width={300} _height={18} />
            <TraceHeaderComponents.StyledPlaceholder _width={300} _height={24} />
          </Stack>
        </TraceHeaderComponents.HeaderRow>
        <TraceHeaderComponents.StyledBreak />
        <TraceHeaderComponents.HeaderRow>
          <Flex align="center" gap="md">
            <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
            <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
            <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
          </Flex>
          <TraceHeaderComponents.StyledPlaceholder _width={50} _height={28} />
        </TraceHeaderComponents.HeaderRow>
      </TraceHeaderComponents.HeaderContent>
    </TraceHeaderComponents.HeaderLayout>
  );
}
