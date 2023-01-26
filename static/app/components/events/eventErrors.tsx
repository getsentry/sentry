import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import uniqWith from 'lodash/uniqWith';

import {Alert} from 'sentry/components/alert';
import {ErrorItem, EventErrorData} from 'sentry/components/events/errorItem';
import List from 'sentry/components/list';
import {JavascriptProcessingErrors} from 'sentry/constants/eventErrors';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Artifact, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {useQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {DataSection} from './styles';

const MAX_ERRORS = 100;

type EventErrorsProps = {
  event: Event;
  proGuardErrors: Array<EventErrorData>;
  projectSlug: Project['slug'];
};

const getURLPathname = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return undefined;
  }
};

export const EventErrors = ({event, proGuardErrors, projectSlug}: EventErrorsProps) => {
  const organization = useOrganization();
  const orgSlug = organization.slug;

  const releaseVersion = event.release?.version;
  const pathNames = (event.errors ?? [])
    .filter(
      error =>
        error.type === 'js_no_source' && error.data.url && getURLPathname(error.data.url)
    )
    .map(sourceCodeError => getURLPathname(sourceCodeError.data.url));

  const {data: releaseArtifacts} = useQuery<Artifact[]>(
    [
      `/projects/${orgSlug}/${projectSlug}/releases/${encodeURIComponent(
        releaseVersion ?? ''
      )}/files/`,
      {query: {query: pathNames}},
    ],
    {staleTime: Infinity, enabled: pathNames.length > 0 && defined(releaseVersion)}
  );

  const {dist: eventDistribution, errors: eventErrors = [], _meta} = event;

  // XXX: uniqWith returns unique errors and is not performant with large datasets
  const otherErrors: Array<EventErrorData> =
    eventErrors.length > MAX_ERRORS ? eventErrors : uniqWith(eventErrors, isEqual);

  const errors = [...otherErrors, ...proGuardErrors];

  return (
    <StyledDataSection>
      <StyledAlert
        type="error"
        showIcon
        data-test-id="event-error-alert"
        expand={
          <ErrorList data-test-id="event-error-details" symbol="bullet">
            {errors.map((error, errorIdx) => {
              const data = error.data ?? {};
              const meta = _meta?.errors?.[errorIdx];

              if (
                error.type === JavascriptProcessingErrors.JS_MISSING_SOURCE &&
                data.url &&
                !!releaseArtifacts?.length
              ) {
                const releaseArtifact = releaseArtifacts.find(releaseArt => {
                  const pathname = data.url ? getURLPathname(data.url) : undefined;

                  if (pathname) {
                    return releaseArt.name.includes(pathname);
                  }
                  return false;
                });

                const releaseArtifactDistribution = releaseArtifact?.dist ?? null;

                // Neither event nor file have dist -> matching
                // Event has dist, file doesn’t -> not matching
                // File has dist, event doesn’t -> not matching
                // Both have dist, same value -> matching
                // Both have dist, different values -> not matching
                if (releaseArtifactDistribution !== eventDistribution) {
                  error.message = t(
                    'Source code was not found because the distribution did not match'
                  );
                  data['expected-distribution'] = eventDistribution;
                  data['current-distribution'] = releaseArtifactDistribution;
                }
              }

              return <ErrorItem key={errorIdx} error={{...error, data}} meta={meta} />;
            })}
          </ErrorList>
        }
      >
        {tn(
          'There was %s problem processing this event',
          'There were %s problems processing this event',
          errors.length
        )}
      </StyledAlert>
    </StyledDataSection>
  );
};

const StyledDataSection = styled(DataSection)`
  border-top: none;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    padding-top: 0;
  }
`;

const StyledAlert = styled(Alert)`
  margin: ${space(0.5)} 0;
`;

const ErrorList = styled(List)`
  li:last-child {
    margin-bottom: 0;
  }
`;
